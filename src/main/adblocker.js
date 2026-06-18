const { session } = require('electron');
const path = require('path');
const fs = require('fs');

class AdBlocker {
  constructor() {
    this.filters = [];
    this.exceptions = [];
    this.userDataPath = null;
  }

  init(userDataPath) {
    this.userDataPath = userDataPath;
    const listPath = path.join(userDataPath, 'adblock-list.txt');
    if (fs.existsSync(listPath)) {
      this.loadList(fs.readFileSync(listPath, 'utf-8'));
    } else {
      this.loadList(this.getBuiltinList());
      try {
        fs.writeFileSync(listPath, this.getBuiltinList(), 'utf-8');
      } catch (e) {}
    }
    return this;
  }

  applyToSession(ses) {
    if (!this.enabled) return;
    const self = this;
    try {
      ses.webRequest.onBeforeRequest((details, callback) => {
        if (self.match(details)) {
          callback({ cancel: true });
          return;
        }
        callback({ cancel: false });
      });
    } catch (e) {}
  }

  match(details) {
    if (!this.enabled || this.filters.length === 0) return false;
    const url = details.url;
    const urlLower = url.toLowerCase();
    const hostname = this._extractHostname(url);
    const resourceType = details.resourceType || 'other';

    for (let i = 0; i < this.exceptions.length; i++) {
      if (this.exceptions[i].test(url, hostname, urlLower, resourceType)) {
        return false;
      }
    }

    for (let i = 0; i < this.filters.length; i++) {
      if (this.filters[i].test(url, hostname, urlLower, resourceType)) {
        return true;
      }
    }
    return false;
  }

  _extractHostname(url) {
    try {
      const u = new URL(url);
      return u.hostname;
    } catch (e) {
      return '';
    }
  }

  loadList(raw) {
    this.filters = [];
    this.exceptions = [];
    this.cosmeticFilters = [];

    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('!') || line.startsWith('#')) continue;
      if (line.startsWith('@@')) {
        const f = this._parseFilter(line.slice(2), true);
        if (f) this.exceptions.push(f);
      } else {
        const f = this._parseFilter(line, false);
        if (f) this.filters.push(f);
      }
    }
  }

  _parseFilter(raw, isException) {
    const f = { raw, pattern: null, domain: null, options: {}, domains: null, thirdParty: false, types: null };
    let part = raw;
    const optIdx = raw.lastIndexOf('$');
    if (optIdx > 0) {
      const opts = raw.slice(optIdx + 1).split(',');
      part = raw.slice(0, optIdx);
      for (const o of opts) {
        const [k, v] = o.split('=');
        if (k === 'domain') {
          f.domains = v ? v.split('|') : null;
        } else if (k === 'third-party') {
          f.thirdParty = true;
        } else if (k === 'script' || k === 'image' || k === 'stylesheet' || k === 'xmlhttprequest' || k === 'sub_frame' || k === 'font' || k === 'media' || k === 'object' || k === 'other') {
          if (!f.types) f.types = [];
          f.types.push(k);
        }
      }
    }

    if (part.startsWith('/') && part.endsWith('/') && part.length > 2) {
      try {
        const re = new RegExp(part.slice(1, -1), 'i');
        return this._makeFilter(re, f, isException);
      } catch (e) { return null; }
    }

    if (part.startsWith('||')) {
      let dom = part.slice(2);
      const wildcard = dom.endsWith('^');
      if (wildcard) dom = dom.slice(0, -1);
      const hasPath = dom.includes('/');
      f.domain = dom;
      if (hasPath) {
        const slashIdx = dom.indexOf('/');
        const hostPart = dom.slice(0, slashIdx);
        const pathPart = dom.slice(slashIdx);
        const hostRe = this._domainToRegex(hostPart);
        return this._makeFilter(function(url, hostname, urlLower, type) {
          return hostRe.test(hostname) && urlLower.includes(pathPart.toLowerCase());
        }, f, isException);
      } else {
        const hostRe = this._domainToRegex(dom);
        return this._makeFilter(function(url, hostname, urlLower, type) {
          return hostRe.test(hostname);
        }, f, isException);
      }
    }

    if (part.startsWith('|') && part.endsWith('|') && part.length > 2) {
      const exact = part.slice(1, -1).toLowerCase();
      return this._makeFilter(function(url, hostname, urlLower, type) {
        return urlLower === exact;
      }, f, isException);
    }

    if (part.startsWith('|') && part.length > 1) {
      const prefix = part.slice(1).toLowerCase();
      return this._makeFilter(function(url, hostname, urlLower, type) {
        return urlLower.startsWith(prefix);
      }, f, isException);
    }

    if (part.endsWith('|') && part.length > 1) {
      const suffix = part.slice(0, -1).toLowerCase();
      return this._makeFilter(function(url, hostname, urlLower, type) {
        return urlLower.endsWith(suffix);
      }, f, isException);
    }

    if (part.endsWith('^')) {
      const dom = part.slice(0, -1).toLowerCase();
      return this._makeFilter(function(url, hostname, urlLower, type) {
        return urlLower.includes(dom);
      }, f, isException);
    }

    const lower = part.toLowerCase();
    if (lower.indexOf('/') !== -1) {
      return this._makeFilter(function(url, hostname, urlLower, type) {
        return urlLower.includes(lower);
      }, f, isException);
    }

    return this._makeFilter(function(url, hostname, urlLower, type) {
      return hostname.includes(lower);
    }, f, isException);
  }

  _domainToRegex(domain) {
    const escaped = domain.replace(/[.+?${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('(^|\\.)' + escaped + '$', 'i');
  }

  _makeFilter(testFn, filterData, isException) {
    const types = filterData.types;
    const domains = filterData.domains;
    const thirdParty = filterData.thirdParty;
    return {
      test: (url, hostname, urlLower, resourceType) => {
        if (domains) {
          let match = false;
          for (const d of domains) {
            const neg = d.startsWith('~');
            const dom = neg ? d.slice(1) : d;
            const re = this._domainToRegex(dom);
            if (re.test(hostname) === neg) { match = false; break; }
            if (re.test(hostname)) match = true;
          }
          if (!match) return false;
        }
        if (types) {
          const typeToFilter = { mainFrame: 'document', subFrame: 'sub_frame', object: 'object', script: 'script', image: 'image', stylesheet: 'stylesheet', font: 'font', media: 'media', xmlhttprequest: 'xmlhttprequest', other: 'other', ping: 'other', csp_report: 'other' };
          const mapped = typeToFilter[resourceType] || 'other';
          if (!types.includes(mapped)) return false;
        }
        if (thirdParty) {
          return testFn(url, hostname, urlLower, resourceType);
        }
        return testFn(url, hostname, urlLower, resourceType);
      }
    };
  }

  getBuiltinList() {
    return [
      '! Built-in blocklist (EasyList-based)',
      '! Updated 2025-06-18',
      '!',
      '! --- Ad servers ---',
      '||doubleclick.net^',
      '||googlesyndication.com^',
      '||googleadservices.com^',
      '||google-analytics.com^$script',
      '||googletagmanager.com^',
      '||adservice.google.com^',
      '||pagead2.googlesyndication.com^',
      '||adnxs.com^',
      '||rubiconproject.com^',
      '||pubmatic.com^',
      '||openx.net^',
      '||appnexus.com^',
      '||casalemedia.com^',
      '||moatads.com^',
      '||adsrvr.org^',
      '||sharethrough.com^',
      '||taboola.com^',
      '||outbrain.com^',
      '||exponential.com^',
      '||tidaltv.com^',
      '||indexww.com^',
      '||sovrn.com^',
      '||adsafeprotected.com^',
      '||bluekai.com^',
      '||exelator.com^',
      '||demdex.net^',
      '||adsymptotic.com^',
      '||krxd.net^',
      '||rlcdn.com^',
      '||tremorhub.com^',
      '||undertone.com^',
      '||contextweb.com^',
      '||media.net^',
      '||turn.com^',
      '||yieldmo.com^',
      '||smaato.com^',
      '||pubnative.net^',
      '||inmobi.com^',
      '||criteo.com^',
      '||criteo.net^',
      '||amazon-adsystem.com^',
      '||aax.amazon-adsystem.com^',
      '||servedbyadbutler.com^',
      '||propellerads.com^',
      '||popads.net^',
      '||trafficfactory.biz^',
      '||adsterra.com^',
      '||adcash.com^',
      '||exoclick.com^',
      '||adbrite.com^',
      '||advertising.com^',
      '||tribalfusion.com^',
      '||specificmedia.net^',
      '||burstnet.com^',
      '||kontera.com^',
      '||quantserve.com^',
      '||scorecardresearch.com^',
      '||comscore.com^',
      '||edgesuite.net^',
      '|https://edge.quantserve.com^',
      '',
      '! --- Analytics ---',
      '||mixpanel.com^',
      '||amplitude.com^',
      '||segment.io^',
      '||segment.com^',
      '||heap.io^',
      '||hotjar.com^',
      '||fullstory.com^',
      '||mouseflow.com^',
      '||luckyorange.com^',
      '||crazyegg.com^',
      '||clicktale.com^',
      '||sessioncam.com^',
      '||optimizely.com^',
      '||chartbeat.com^',
      '||pingdom.net^',
      '||newrelic.com^',
      '||datadoghq.com^',
      '||nr-data.net^',
      '||bugsnag.com^',
      '||rollbar.com^',
      '||sentry.io^',
      '||optimize.google.com^$script',
      '',
      '! --- Social widgets ---',
      '||facebook.com/tr^',
      '||connect.facebook.net^',
      '||platform.twitter.com^',
      '||analytics.twitter.com^',
      '||ads.linkedin.com^',
      '||bat.bing.com^',
      '||ads.yahoo.com^',
      '||pixel.quantserve.com^',
      '||pinterest.com/analytics^',
      '||snapchat.com/ads^',
      '||t.co/^',
      '||linkedin.com/analytics^',
      '',
      '! --- Video/player ads ---',
      '||imasdk.googleapis.com^',
      '||securepubads.g.doubleclick.net^',
      '||g.doubleclick.net^',
      '||aniview.com^',
      '||embedly.com^',
      '||video-ad-stats.googlevideo.com^',
      '',
      '! --- Banners & widgets ---',
      '||c.amazon-adsystem.com^',
      '||z-p3-adserver.com^',
      '||cdn.bannerads.com^',
      '||bannerconnect.com^',
      '||bannerflow.com^',
      '||adk2.com^',
      '||adserverpub.com^',
      '',
      '! --- Cryptominers ---',
      '||coinhive.com^',
      '||coin-hive.com^',
      '||cryptoloot.pro^',
      '||miner.pr0gramm.com^',
      '||reasedoper.pw^',
      '||mahproject.com^',
      '||projectpoi.com^',
      '||cloudcoins.co^',
      '||coinnebula.com^',
      '||coinslab.net^',
      '||coinimp.com^',
      '||monerominer.rocks^',
      '||gatherminer.com^',
      '||minero.cc^',
      '||crypto-loot.com^',
      '||coinerra.com^',
      '||coinverti.com^',
      '||wpmine.com^',
      '||xmrminer.cc^',
      '',
      '! --- Fingerprinting ---',
      '||fingerprintjs.com^',
      '||fingerprint.com^',
      '||maxmind.com^',
      '||ip-api.com^',
      '||ipinfo.io^',
      '||ipstack.com^',
      '||browserleaks.com^',
      '||browserspy.dk^',
      '||whatsmybrowser.com^',
      '||deviceinfo.me^',
      '||webglreport.com^',
      '||audiocheck.net^',
      '',
      '! --- Common ad paths ---',
      '/banner/',
      '/ads/',
      '/adserver/',
      '/pagead/',
      '/pagead/',
      '/imp',
      '/imp?',
      '/click?',
      '|https://www.googletagmanager.com/gtm.js|',
      '/gtag/js?',
      '/analytics.js',
      '/ga.js',
      '/fb pixel',
      '/pixel?id=',
      '/pixel?',
      '/beacon?',
      '/beacon/',
      '/conversion/',
      '/view.php',
      '/view?',
      '/track?',
      '/tracking/',
      '/tracking?',
      '/spacer.gif',
      '/pixel.gif',
      '/pixel.png',
      '/468x60',
      '/728x90',
      '/300x250',
      '/160x600',
      '/120x600',
      '/336x280',
      '/popup.',
      '/popunder.',
      '|https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js|',
      '/show_ads.js',
      '|https://www.googletagmanager.com/ns.html?id=',
      '',
      '! --- Exception for login/auth ---',
      '@@||accounts.google.com^',
      '@@||google.com^$script,xmlhttprequest',
      '@@||gstatic.com^',
      '@@||googleapis.com^',
      '@@||github.com^',
      '@@||youtube.com^',
    ].join('\n');
  }
}

module.exports = { AdBlocker };
