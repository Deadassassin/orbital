const { contextBridge, ipcRenderer } = require('electron');

function setupMouseNav() {
  document.addEventListener('mouseup', function(e) {
    if (e.button === 3) { e.preventDefault(); ipcRenderer.sendToHost('mouse-back'); }
    else if (e.button === 4) { e.preventDefault(); ipcRenderer.sendToHost('mouse-forward'); }
  });
}
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', setupMouseNav);
} else {
  setupMouseNav();
}

contextBridge.exposeInMainWorld('browserAPI', {
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openPath: (p) => ipcRenderer.invoke('open-path', p),
  showItemInFolder: (p) => ipcRenderer.invoke('show-item-in-folder', p),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (updates) => ipcRenderer.invoke('update-settings', updates),
  getPrivacySettings: () => ipcRenderer.invoke('get-privacy-settings'),
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
  addBookmark: (b) => ipcRenderer.invoke('add-bookmark', b),
  removeBookmark: (id) => ipcRenderer.invoke('remove-bookmark', id),
  updateBookmark: (id, u) => ipcRenderer.invoke('update-bookmark', id, u),
  getHistory: () => ipcRenderer.invoke('get-history'),
  searchHistory: (q) => ipcRenderer.invoke('search-history', q),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  deleteHistoryEntry: (id) => ipcRenderer.invoke('delete-history-entry', id),
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  removeDownload: (id) => ipcRenderer.invoke('remove-download', id),
  getExtensions: () => ipcRenderer.invoke('get-extensions'),
  installExtension: (p) => ipcRenderer.invoke('install-extension', p),
  installFromChromeStore: (extId) => ipcRenderer.invoke('install-from-chrome-store', extId),
  uninstallExtension: (id) => ipcRenderer.invoke('uninstall-extension', id),
  toggleExtension: (id) => ipcRenderer.invoke('toggle-extension', id),
  clearBrowsingData: (d) => ipcRenderer.invoke('clear-browsing-data', d),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  navigateTo: (url) => ipcRenderer.send('webview-navigate', url),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  showNotification: (o) => ipcRenderer.invoke('show-notification', o),
  newWindow: () => ipcRenderer.invoke('new-window'),
  newPrivateWindow: () => ipcRenderer.invoke('new-private-window'),
  openDevtools: () => ipcRenderer.invoke('open-devtools'),
  toggleTrackerBlocking: () => ipcRenderer.invoke('toggle-tracker-blocking'),
  toggleFingerprintNoise: () => ipcRenderer.invoke('toggle-fingerprint-noise'),
  toggleThirdPartyCookies: () => ipcRenderer.invoke('toggle-third-party-cookies'),
  toggleDnt: () => ipcRenderer.invoke('toggle-dnt'),
  toggleHttpsUpgrade: () => ipcRenderer.invoke('toggle-https-upgrade'),
  setZoom: (l) => ipcRenderer.invoke('set-zoom', l),
  printPage: () => ipcRenderer.invoke('print-page'),
  savePage: () => ipcRenderer.invoke('save-page'),
  setFullscreen: (f) => ipcRenderer.invoke('set-fullscreen', f),
  getFlags: () => ipcRenderer.invoke('get-flags'),
  setFlag: (flag, enabled) => ipcRenderer.invoke('set-flag', flag, enabled),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (e, data) => cb(data)),
});
