const { session } = require('electron');
const path = require('path');
const { AdBlocker } = require('./adblocker');

class PrivacyManager {
  constructor(session, app) {
    this.app = app;
    this.blockedDomains = new Set();
    this.userBlockedDomains = new Set();
    this.fingerprintNoise = true;
    this.blockThirdPartyCookies = false;
    this.doNotTrack = false;
    this.blockKnownTrackers = true;
    this.blockAds = true;
    this.upgradeHttps = true;
    this.blockFingerprinting = true;
    this.userAgentRandomization = false;
    this.adblocker = new AdBlocker();
    this._requestHandler = null;
    this._httpsHandler = null;

    this._loadTrackerLists();
  }

  init(userDataPath) {
    this.adblocker.init(userDataPath);
  }

  _loadTrackerLists() {
    const domains = [
      'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
      'google-analytics.com', 'googletagmanager.com', 'facebook.com/tr',
      'connect.facebook.net', 'analytics.twitter.com', 'ads.linkedin.com',
      'bat.bing.com', 'ads.yahoo.com', 'adservice.google.com',
      'pagead2.googlesyndication.com', 'pixel.quantserve.com',
      'scorecardresearch.com', 'amazon-adsystem.com', 'criteo.com', 'criteo.net',
      'adnxs.com', 'rubiconproject.com', 'pubmatic.com', 'openx.net',
      'appnexus.com', 'casalemedia.com', 'moatads.com', 'adsrvr.org',
      'sharethrough.com', 'taboola.com', 'outbrain.com', 'exponential.com',
      'tidaltv.com', 'indexww.com', 'sovrn.com', 'adsafeprotected.com',
      'bluekai.com', 'exelator.com', 'demdex.net', 'adsymptotic.com',
      'krxd.net', 'rlcdn.com', 'tremorhub.com', 'undertone.com',
      'contextweb.com', 'media.net', 'turn.com', 'yieldmo.com', 'smaato.com',
      'pubnative.net', 'inmobi.com', 'chartbeat.com', 'comscore.com',
      'hotjar.com', 'mouseflow.com', 'luckyorange.com', 'fullstory.com',
      'crazyegg.com', 'clicktale.com', 'sessioncam.com', 'optimizely.com',
      'mixpanel.com', 'amplitude.com', 'segment.io', 'segment.com', 'heap.io',
      'drift.com', 'hubspot.com', 'salesforce.com', 'marketo.com', 'pardot.com',
      'eloqua.com', 'qualtrics.com', 'medallia.com', 'sprinklr.com',
      'braze.com', 'leanplum.com', 'appboy.com', 'mparticle.com',
      'kochava.com', 'adjust.com', 'appsflyer.com', 'branch.io',
      'pusher.com', 'pubnub.com', 'fingerprintjs.com', 'fingerprint.com',
      'maxmind.com', 'ip-api.com', 'ipinfo.io', 'ipstack.com',
      'browserleaks.com', 'browserspy.dk', 'whatsmybrowser.com',
      'deviceinfo.me', 'webglreport.com', 'audiocheck.net',
    ];
    domains.forEach(d => this.blockedDomains.add(d));
  }

  applyPrivacySettings(sessionObj) {
    const ses = sessionObj || session.defaultSession;

    try {
      if (ses.registerPreloadScript) {
        ses.registerPreloadScript({
          id: 'shadow-privacy',
          file: path.join(__dirname, '..', 'preload', 'privacy-preload.js'),
          type: 'isolatedWorld',
          enabled: true,
        });
      } else {
        ses.setPreloads([path.join(__dirname, '..', 'preload', 'privacy-preload.js')]);
      }
    } catch (e) {}

    if (this.doNotTrack) {
      try {
        ses.webRequest.onBeforeSendHeaders((details, callback) => {
          details.requestHeaders['DNT'] = '1';
          details.requestHeaders['Sec-GPC'] = '1';
          callback({ requestHeaders: details.requestHeaders });
        });
      } catch (e) {}
    }

    const self = this;
    ses.webRequest.onBeforeRequest((details, callback) => {
      if (self.blockAds && self.adblocker.match(details)) {
        callback({ cancel: true });
        return;
      }
      if (self.blockKnownTrackers) {
        const url = details.url.toLowerCase();
        for (const domain of self.blockedDomains) {
          if (url.includes(domain) && ['script','image','xmlhttprequest','subFrame','stylesheet','font','media'].includes(details.resourceType)) {
            callback({ cancel: true });
            return;
          }
        }
        for (const domain of self.userBlockedDomains) {
          if (url.includes(domain)) {
            callback({ cancel: true });
            return;
          }
        }
      }
      if (self.upgradeHttps && details.url.startsWith('http://') && !details.url.startsWith('http://localhost') && !details.url.startsWith('http://127.0.0.1') && !details.url.startsWith('http://192.168.')) {
        callback({ redirectURL: details.url.replace(/^http:/, 'https:') });
        return;
      }
      callback({ cancel: false });
    });

    const platform = process.platform === 'win32'
      ? 'Windows NT 10.0; Win64; x64'
      : process.platform === 'linux'
        ? 'X11; Linux x86_64'
        : 'Macintosh; Intel Mac OS X 10_15_7';
    const chromeVer = process.versions?.chrome || '136.0.0.0';
    ses.setUserAgent(
      `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer} Safari/537.36`
    );
  }

  blockDomain(domain) {
    this.userBlockedDomains.add(domain);
  }

  unblockDomain(domain) {
    this.userBlockedDomains.delete(domain);
  }

  toggleFingerprintNoise() {
    this.fingerprintNoise = !this.fingerprintNoise;
    return this.fingerprintNoise;
  }

  toggleTrackerBlocking() {
    this.blockKnownTrackers = !this.blockKnownTrackers;
    return this.blockKnownTrackers;
  }

  toggleAdBlocking() {
    this.blockAds = !this.blockAds;
    return this.blockAds;
  }

  toggleThirdPartyCookies() {
    this.blockThirdPartyCookies = !this.blockThirdPartyCookies;
    return this.blockThirdPartyCookies;
  }

  toggleDnt() {
    this.doNotTrack = !this.doNotTrack;
    return this.doNotTrack;
  }

  toggleHttpsUpgrade() {
    this.upgradeHttps = !this.upgradeHttps;
    return this.upgradeHttps;
  }

  updateBlocklist(raw) {
    this.adblocker.loadList(raw);
  }

  getSettings() {
    return {
      blockThirdPartyCookies: this.blockThirdPartyCookies,
      doNotTrack: this.doNotTrack,
      blockKnownTrackers: this.blockKnownTrackers,
      blockAds: this.blockAds,
      upgradeHttps: this.upgradeHttps,
      blockFingerprinting: this.blockFingerprinting,
      fingerprintNoise: this.fingerprintNoise,
      userAgentRandomization: this.userAgentRandomization,
    };
  }
}

module.exports = { PrivacyManager };
