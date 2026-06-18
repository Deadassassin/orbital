// Capacitor bridge - minimal bootstrap for mobile.
// The mobile app is self-contained in index.html.
// This file provides Capacitor plugin initialization only.

(function() {
  var isMobile = typeof Capacitor !== 'undefined' || navigator.userAgent.indexOf('Android') !== -1 || navigator.userAgent.indexOf('iPhone') !== -1;
  if (!isMobile) return;

  // Expose a minimal browserAPI for any loaded scripts that check for it
  window.browserAPI = window.browserAPI || {
    getPlatform: function() { return Promise.resolve('android'); },
    getAppVersion: function() { return Promise.resolve('2.0.0'); },
    getSystemInfo: function() { return Promise.resolve({ platform: 'android', arch: 'arm64', chromeVersion: (navigator.userAgent.match(/Chrome\/(\d+)/) || [])[1] || 'N/A' }); },
  };

  console.log('Orbital Capacitor bridge loaded');
})();