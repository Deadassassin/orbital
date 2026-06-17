const { net, session } = require('electron');
const path = require('path');
const fs = require('fs');

class PrivacyManager {
  constructor(session, app) {
    this.app = app;
    this.trackerLists = new Set();
    this.blockedDomains = new Set();
    this.userBlockedDomains = new Set();
    this.fingerprintNoise = true;
    this.blockThirdPartyCookies = true;
    this.doNotTrack = true;
    this.blockKnownTrackers = true;
    this.upgradeHttps = true;
    this.blockCryptominers = true;
    this.blockFingerprinting = true;
    this.userAgentRandomization = false;

    this.loadTrackerLists();
  }

  loadTrackerLists() {
    const builtinTrackers = [
      'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
      'google-analytics.com', 'googletagmanager.com', 'facebook.com/tr',
      'connect.facebook.net', 'analytics.twitter.com', 'ads.linkedin.com',
      'bat.bing.com', 'ads.yahoo.com', 'adservice.google.com',
      'pagead2.googlesyndication.com', 'pixel.quantserve.com',
      'scorecardresearch.com', 'amazon-adsystem.com', 'criteo.com',
      'criteo.net', 'adnxs.com', 'rubiconproject.com', 'pubmatic.com',
      'openx.net', 'appnexus.com', 'casalemedia.com', 'moatads.com',
      'adsrvr.org', 'sharethrough.com', 'taboola.com', 'outbrain.com',
      'exponential.com', 'tidaltv.com', 'indexww.com', 'sovrn.com',
      'adsafeprotected.com', 'bluekai.com', 'exelator.com',
      'demdex.net', 'adsymptotic.com', 'krxd.net', 'rlcdn.com',
      'tremorhub.com', 'undertone.com', 'contextweb.com',
      'media.net', 'turn.com', 'beam.design', 'agkn.com',
      'yieldmo.com', 'smaato.com', 'pubnative.net', 'inmobi.com',
      'chartbeat.com', 'comscore.com', 'hotjar.com',
      'mouseflow.com', 'luckyorange.com', 'fullstory.com',
      'crazyegg.com', 'clicktale.com', 'sessioncam.com',
      'optimizely.com', 'mixpanel.com', 'amplitude.com',
      'segment.io', 'segment.com', 'heap.io', 'intercom.io',
      'drift.com', 'hubspot.com', 'salesforce.com',
      'marketo.com', 'pardot.com', 'eloqua.com',
      'qualtrics.com', 'medallia.com', 'sprinklr.com',
      'braze.com', 'leanplum.com', 'appboy.com',
      'mparticle.com', 'kochava.com', 'adjust.com',
      'appsflyer.com', 'branch.io', 'firebaseio.com',
      'pusher.com', 'pubnub.com', 'layer.com',
    ];

    const fingerprintingDomains = [
      'fingerprintjs.com', 'fingerprint.com', 'maxmind.com',
      'ip-api.com', 'ipinfo.io', 'ipstack.com',
      'browserleaks.com', 'browserspy.dk', 'whatsmybrowser.com',
      'deviceinfo.me', 'webglreport.com', 'audiocheck.net',
    ];

    const cryptominers = [
      'coinhive.com', 'coin-hive.com', 'cryptoloot.pro',
      'miner.pr0gramm.com', 'ppoi.org', 'reasedoper.pw',
      'mahproject.com', 'projectpoi.com', 'cloudcoins.co',
      'coinnebula.com', 'coinslab.net', 'coinimp.com',
      'monerominer.rocks', 'gatherminer.com', 'minero.cc',
      'webmine.cz', 'miner.bitcoin.xyz', 'crypto-loot.com',
      'coinerra.com', 'coinverti.com', 'wpmine.com',
      'xmrminer.cc', 'minethat.eu', 'cnhv.co',
    ];

    [...builtinTrackers, ...fingerprintingDomains, ...cryptominers].forEach(d => {
      this.trackerLists.add(d);
      this.blockedDomains.add(d);
    });
  }

  applyPrivacySettings(sessionObj) {
    const ses = sessionObj || session.defaultSession;

    if (this.blockThirdPartyCookies) {
      ses.setPermissionRequestHandler((wc, perm, cb) => {
        if (perm === 'clipboard-read' || perm === 'clipboard-write' || perm === 'media' || perm === 'fullscreen') {
          cb(true);
        } else if (perm === 'protected-media-identifier') {
          cb(true);
        } else {
          cb(false);
        }
      });
    }

    try {
      if (ses.registerPreloadScript) {
        ses.registerPreloadScript({
          id: 'shadow-privacy',
          file: path.join(__dirname, '..', 'preload', 'privacy-preload.js'),
          type: 'isolatedWorld',
          enabled: true,
        });
      } else {
        ses.setPreloads([
          path.join(__dirname, '..', 'preload', 'privacy-preload.js')
        ]);
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

    if (this.blockKnownTrackers) {
      try {
        ses.webRequest.onBeforeRequest((details, callback) => {
          const url = details.url.toLowerCase();
          for (const domain of this.blockedDomains) {
            if (url.includes(domain)) {
              if (this.blockFingerprinting && this.isFingerprintingScript(details)) {
                callback({ cancel: true });
                return;
              }
              if (details.resourceType === 'script' || details.resourceType === 'image' || details.resourceType === 'xmlhttprequest' || details.resourceType === 'subFrame' || details.resourceType === 'stylesheet' || details.resourceType === 'font' || details.resourceType === 'media') {
                callback({ cancel: true });
                return;
              }
            }
          }
          for (const domain of this.userBlockedDomains) {
            if (url.includes(domain)) {
              callback({ cancel: true });
              return;
            }
          }
          callback({ cancel: false });
        });
      } catch (e) {}
    }

    if (this.upgradeHttps) {
      try {
        ses.webRequest.onBeforeRequest((details, callback) => {
          if (details.url.startsWith('http://') && !details.url.startsWith('http://localhost') && !details.url.startsWith('http://127.0.0.1') && !details.url.startsWith('http://192.168.')) {
            const httpsUrl = details.url.replace(/^http:/, 'https:');
            callback({ redirectURL: httpsUrl });
            return;
          }
          callback({ cancel: false });
        });
      } catch (e) {}
    }

    const platform = process.platform === 'win32'
      ? 'Windows NT 10.0; Win64; x64'
      : process.platform === 'linux'
        ? 'X11; Linux x86_64'
        : 'Macintosh; Intel Mac OS X 10_15_7';
    ses.setUserAgent(
      `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36`
    );
  }

  isFingerprintingScript(details) {
    const fpIndicators = [
      '/fingerprint', 'fp.js', 'fingerprint2', 'clientjs',
      'canvas', 'webgl', 'getclientrects',
    ];
    const url = details.url.toLowerCase();
    return fpIndicators.some(ind => url.includes(ind));
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

  getSettings() {
    return {
      blockThirdPartyCookies: this.blockThirdPartyCookies,
      doNotTrack: this.doNotTrack,
      blockKnownTrackers: this.blockKnownTrackers,
      upgradeHttps: this.upgradeHttps,
      blockCryptominers: this.blockCryptominers,
      blockFingerprinting: this.blockFingerprinting,
      fingerprintNoise: this.fingerprintNoise,
      userAgentRandomization: this.userAgentRandomization,
    };
  }
}

module.exports = { PrivacyManager };
