/**
 * Capacitor bridge for Orbital mobile.
 * Replaces Electron-specific APIs with Capacitor-native equivalents.
 * This file is injected on mobile in place of the Electron preload.
 */
(function() {
  var isMobile = typeof Capacitor !== 'undefined' || navigator.userAgent.indexOf('Android') !== -1 || navigator.userAgent.indexOf('iPhone') !== -1;

  if (!isMobile) return;

  var storage = {
    _data: {},
    _save: function() {
      try { localStorage.setItem('orbital-state', JSON.stringify(this._data)); } catch(e) {}
    },
    getSettings: function() { return this._data.settings || { homepage: 'about:newtab', searchEngine: 'google', alwaysShowBookmarkBar: false, restoreLastSession: true }; },
    updateSettings: function(updates) {
      if (!this._data.settings) this._data.settings = {};
      Object.assign(this._data.settings, updates);
      this._save();
      return Promise.resolve();
    },
    getBookmarks: function() { return this._data.bookmarks || []; },
    addBookmark: function(bm) {
      if (!this._data.bookmarks) this._data.bookmarks = [];
      bm.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      bm.createdAt = Date.now();
      this._data.bookmarks.push(bm);
      this._save();
      return Promise.resolve(bm);
    },
    removeBookmark: function(id) {
      if (!this._data.bookmarks) return Promise.resolve();
      this._data.bookmarks = this._data.bookmarks.filter(function(b) { return b.id !== id; });
      this._save();
      return Promise.resolve();
    },
    searchBookmarks: function(query) {
      var q = query.toLowerCase();
      var bms = this.getBookmarks();
      return Promise.resolve(bms.filter(function(b) { return (b.title||'').toLowerCase().indexOf(q) !== -1 || (b.url||'').toLowerCase().indexOf(q) !== -1; }));
    },
    getHistory: function() { return this._data.history || []; },
    addHistoryEntry: function(entry) {
      if (!this._data.history) this._data.history = [];
      entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      entry.lastVisit = Date.now();
      this._data.history.unshift(entry);
      if (this._data.history.length > 1000) this._data.history = this._data.history.slice(0, 1000);
      this._save();
    },
    searchHistory: function(query) {
      var q = query.toLowerCase();
      var hist = this.getHistory();
      return Promise.resolve(hist.filter(function(h) { return (h.title||'').toLowerCase().indexOf(q) !== -1 || (h.url||'').toLowerCase().indexOf(q) !== -1; }));
    },
    clearHistory: function() { this._data.history = []; this._save(); return Promise.resolve(); },
    deleteHistoryEntry: function(id) {
      if (!this._data.history) return Promise.resolve();
      this._data.history = this._data.history.filter(function(h) { return h.id !== id; });
      this._save();
      return Promise.resolve();
    },
    getDownloads: function() { return this._data.downloads || []; },
    addDownload: function(d) {
      if (!this._data.downloads) this._data.downloads = [];
      d.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      this._data.downloads.push(d);
      this._save();
    },
    removeDownload: function(id) {
      if (!this._data.downloads) return Promise.resolve();
      this._data.downloads = this._data.downloads.filter(function(d) { return d.id !== id; });
      this._save();
      return Promise.resolve();
    },
    getPasswords: function() { return this._data.passwords || []; },
  };

  // Load persisted state
  try {
    var saved = localStorage.getItem('orbital-state');
    if (saved) storage._data = JSON.parse(saved);
  } catch(e) {}

  // Mobile WebView polyfill — replaces webview with iframe
  var TabManager = window.__tabManager;
  if (TabManager) {
    var origCreateWebView = TabManager.createWebView;
    TabManager.createWebView = function(tab) {
      var iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.position = 'absolute';
      iframe.style.top = '0';
      iframe.style.left = '0';
      iframe.style.border = 'none';
      iframe.style.display = 'none';
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
      tab.webview = iframe;
      tab.webviewContainer.appendChild(iframe);
    };

    TabManager.navigateTab = function(tabId, url) {
      var tab = this.tabs.get(tabId);
      if (!tab || !url) return;
      if (url.startsWith('about:')) {
        this.loadInternalPage(tab, url);
        return;
      }
      var fullUrl = url.match(/^[a-zA-Z]+:\/\//) ? url : 'https://' + url;
      tab.webview.src = fullUrl;
      tab.url = fullUrl;
      tab.loading = false;
      this.updateTabElement(tabId);
      this.updateUrlBar(tab);
    };

    TabManager.loadNewTabPage = function(tab) {
      tab.url = 'about:newtab';
      tab.title = 'New Tab';
      tab.icon = '';
      tab.loading = false;
    };

    TabManager.loadInternalPage = function(tab, url) {
      tab.url = url;
      var page = url.replace('about:', '');
      tab.title = page.charAt(0).toUpperCase() + page.slice(1);
    };
  }

  // Expose bridge API
  window.browserAPI = {
    getInitialState: function() { return Promise.resolve({ settings: storage.getSettings(), isPrivateMode: false, preloadPath: null, bookmarks: [], history: [], downloads: [] }); },
    getSettings: function() { return Promise.resolve(storage.getSettings()); },
    updateSettings: function(updates) { return storage.updateSettings(updates); },
    getPrivacySettings: function() { return Promise.resolve({ blockKnownTrackers: false, blockFingerprinting: false, blockThirdPartyCookies: false, doNotTrack: false, upgradeHttps: false }); },
    toggleTrackerBlocking: function() { return Promise.resolve(false); },
    toggleFingerprintNoise: function() { return Promise.resolve(false); },
    toggleThirdPartyCookies: function() { return Promise.resolve(false); },
    toggleDnt: function() { return Promise.resolve(false); },
    toggleHttpsUpgrade: function() { return Promise.resolve(false); },
    getBookmarks: function() { return Promise.resolve(storage.getBookmarks()); },
    addBookmark: function(bm) { return storage.addBookmark(bm); },
    removeBookmark: function(id) { return storage.removeBookmark(id); },
    searchBookmarks: function(q) { return storage.searchBookmarks(q); },
    updateBookmark: function() { return Promise.resolve(); },
    getHistory: function() { return Promise.resolve(storage.getHistory()); },
    addHistory: function(entry) { storage.addHistoryEntry(entry); },
    searchHistory: function(q) { return storage.searchHistory(q); },
    clearHistory: function() { return storage.clearHistory(); },
    deleteHistoryEntry: function(id) { return storage.deleteHistoryEntry(id); },
    getDownloads: function() { return Promise.resolve(storage.getDownloads()); },
    addDownload: function(d) { storage.addDownload(d); },
    removeDownload: function(id) { return storage.removeDownload(id); },
    updateDownload: function() { return Promise.resolve(); },
    getPasswords: function() { return Promise.resolve(storage.getPasswords()); },
    getExtensions: function() { return Promise.resolve([]); },
    installExtension: function() { return Promise.resolve({ success: false, error: 'Not supported on mobile' }); },
    uninstallExtension: function() { return Promise.resolve(); },
    toggleExtension: function() { return Promise.resolve(); },
    showOpenDialog: function() { return Promise.resolve({ canceled: true }); },
    showSaveDialog: function() { return Promise.resolve({ canceled: true }); },
    getUserDataPath: function() { return Promise.resolve(''); },
    getDownloadsPath: function() { return Promise.resolve(''); },
    openExternal: function(url) { window.open(url, '_blank'); },
    openPath: function() {},
    showItemInFolder: function() {},
    clipboardWriteText: function(text) { try { navigator.clipboard.writeText(text); } catch(e) {} },
    clipboardReadText: function() { return Promise.resolve(''); },
    getPlatform: function() { return Promise.resolve('android'); },
    setZoom: function() {},
    printPage: function() {},
    savePage: function() {},
    setFullscreen: function() {},
    isFullscreen: function() { return Promise.resolve(false); },
    getSystemInfo: function() { return Promise.resolve({ platform: 'android', arch: 'arm64', chromeVersion: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'N/A', electronVersion: 'N/A', nodeVersion: 'N/A' }); },
    clearBrowsingData: function() { try { localStorage.clear(); } catch(e) {} return Promise.resolve(); },
    getAppVersion: function() { return Promise.resolve('2.0.0'); },
    checkForUpdates: function() {},
    getUpdateStatus: function() { return Promise.resolve({ status: 'up-to-date' }); },
    downloadUpdate: function() {},
    installUpdate: function() {},
    newWindow: function() {},
    newPrivateWindow: function() {},
    openDevtools: function() {},
    navigateTo: function(url) { var tm = window.__tabManager; if (tm) tm.navigateTab(tm.activeTabId, url); },
    windowMinimize: function() {},
    windowMaximize: function() {},
    windowClose: function() {},
    windowIsMaximized: function() { return Promise.resolve(false); },
    invoke: function(channel) {
      if (channel === 'get-internal-page') {
        var page = arguments[1];
        var url = page + '.html';
        return fetch(url).then(function(r) { return r.text(); }).catch(function() { return null; });
      }
      return Promise.resolve(null);
    },
    onNavigate: function(cb) { window.__orbitalOnNavigate = cb; },
    onNewTab: function(cb) { window.__orbitalOnNewTab = cb; },
    onNewTabUrl: function(cb) { window.__orbitalOnNewTabUrl = cb; },
    onCloseTab: function(cb) { window.__orbitalOnCloseTab = cb; },
    onFocusUrlBar: function(cb) { window.__orbitalOnFocusUrlBar = cb; },
    onReloadTab: function(cb) { window.__orbitalOnReloadTab = cb; },
    onForceReloadTab: function(cb) { window.__orbitalOnForceReloadTab = cb; },
    onStopLoad: function(cb) { window.__orbitalOnStopLoad = cb; },
    onToggleBookmarkBar: function(cb) { window.__orbitalOnToggleBookmarkBar = cb; },
    onBookmarkCurrent: function(cb) { window.__orbitalOnBookmarkCurrent = cb; },
    onFindInPage: function(cb) { window.__orbitalOnFindInPage = cb; },
    onSavePage: function(cb) {},
    onPrintPage: function(cb) {},
    onExtensionBadgeUpdate: function(cb) {},
    onUpdateStatus: function(cb) {},
  };

  console.log('Orbital mobile bridge initialized');
})();
