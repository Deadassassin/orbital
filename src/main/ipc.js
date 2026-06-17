const path = require('path');
const fs = require('fs');
const { BrowserWindow, dialog, shell, app, session, clipboard, nativeTheme } = require('electron');

function setupIPC(ipcMain, context) {
  const { privacyManager, storageManager, extensionManager, autoUpdater, getMainWindow, createChildWindow, isPrivateMode, isDevMode } = context;

  function getSenderWindow(event) {
    return BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || getMainWindow();
  }

  ipcMain.handle('get-initial-state', () => {
    return {
      isPrivateMode,
      isDevMode,
      settings: storageManager.getSettings(),
      bookmarks: storageManager.getBookmarks(),
      history: storageManager.getHistory().slice(0, 500),
      downloads: storageManager.getDownloads(),
      passwords: storageManager.getPasswords(),
      readingList: storageManager.getReadingList(),
      theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
      pagesPath: path.join(__dirname, '..', 'renderer', 'pages'),
      preloadPath: path.join(__dirname, '..', 'preload', 'webview-preload.js'),
    };
  });

  ipcMain.handle('get-settings', () => storageManager.getSettings());
  ipcMain.handle('update-settings', (e, updates) => storageManager.updateSettings(updates));

  ipcMain.handle('get-privacy-settings', () => privacyManager.getSettings());
  ipcMain.handle('toggle-tracker-blocking', () => privacyManager.toggleTrackerBlocking());
  ipcMain.handle('toggle-fingerprint-noise', () => privacyManager.toggleFingerprintNoise());
  ipcMain.handle('toggle-third-party-cookies', () => privacyManager.toggleThirdPartyCookies());
  ipcMain.handle('toggle-dnt', () => privacyManager.toggleDnt());
  ipcMain.handle('toggle-https-upgrade', () => privacyManager.toggleHttpsUpgrade());
  ipcMain.handle('block-domain', (e, domain) => privacyManager.blockDomain(domain));
  ipcMain.handle('unblock-domain', (e, domain) => privacyManager.unblockDomain(domain));

  ipcMain.handle('add-bookmark', (e, bookmark) => storageManager.addBookmark(bookmark));
  ipcMain.handle('update-bookmark', (e, id, updates) => storageManager.updateBookmark(id, updates));
  ipcMain.handle('remove-bookmark', (e, id) => storageManager.removeBookmark(id));
  ipcMain.handle('search-bookmarks', (e, query) => storageManager.searchBookmarks(query));
  ipcMain.handle('get-bookmarks', () => storageManager.getBookmarks());

  ipcMain.handle('add-history', (e, entry) => {
    if (!isPrivateMode) storageManager.addHistoryEntry(entry);
  });
  ipcMain.handle('search-history', (e, query) => storageManager.searchHistory(query));
  ipcMain.handle('clear-history', () => storageManager.clearHistory());
  ipcMain.handle('delete-history-entry', (e, id) => storageManager.deleteHistoryEntry(id));
  ipcMain.handle('get-history', () => storageManager.getHistory().slice(0, 1000));

  ipcMain.handle('add-download', (e, d) => storageManager.addDownload(d));
  ipcMain.handle('update-download', (e, id, u) => storageManager.updateDownload(id, u));
  ipcMain.handle('remove-download', (e, id) => storageManager.removeDownload(id));
  ipcMain.handle('get-downloads', () => storageManager.getDownloads());

  ipcMain.handle('add-password', (e, p) => storageManager.addPassword(p));
  ipcMain.handle('get-passwords', () => storageManager.getPasswords());
  ipcMain.handle('update-password', (e, id, u) => storageManager.updatePassword(id, u));
  ipcMain.handle('remove-password', (e, id) => storageManager.removePassword(id));

  ipcMain.handle('add-reading-list', (e, item) => storageManager.addToReadingList(item));
  ipcMain.handle('remove-reading-list', (e, id) => storageManager.removeFromReadingList(id));
  ipcMain.handle('get-reading-list', () => storageManager.getReadingList());

  ipcMain.handle('show-save-dialog', async (e, options) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    return dialog.showSaveDialog(win, options);
  });

  ipcMain.handle('show-open-dialog', async (e, options) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    return dialog.showOpenDialog(win, options);
  });

  ipcMain.handle('get-user-data-path', () => app.getPath('userData'));
  ipcMain.handle('get-downloads-path', () => app.getPath('downloads'));

  ipcMain.handle('open-external', (e, url) => shell.openExternal(url));
  ipcMain.handle('open-path', (e, p) => shell.openPath(p));
  ipcMain.handle('show-item-in-folder', (e, p) => shell.showItemInFolder(p));

  ipcMain.handle('clipboard-write-text', (e, text) => clipboard.writeText(text));
  ipcMain.handle('clipboard-read-text', () => clipboard.readText());
  ipcMain.handle('clipboard-write-image', (e, dataUrl) => {
    const nativeImage = require('electron').nativeImage;
    clipboard.writeImage(nativeImage.createFromDataURL(dataUrl));
  });

  ipcMain.handle('get-platform', () => process.platform);

  ipcMain.handle('set-zoom', (e, level) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.webContents.setZoomLevel(level);
  });

  ipcMain.handle('get-zoom', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) return win.webContents.getZoomLevel();
    return 0;
  });

  ipcMain.handle('print-page', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.webContents.print();
  });

  ipcMain.handle('save-page', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      filters: [
        { name: 'HTML', extensions: ['html'] },
        { name: 'MHTML', extensions: ['mhtml'] },
      ],
    });
    if (!canceled && filePath) {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.mhtml') {
        win.webContents.savePage(filePath, 'MHTML');
      } else {
        win.webContents.savePage(filePath, 'HTMLComplete');
      }
    }
  });

  ipcMain.handle('set-fullscreen', (e, flag) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.setFullScreen(flag);
  });

  ipcMain.handle('is-fullscreen', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    return win ? win.isFullScreen() : false;
  });

  ipcMain.handle('get-extensions', () => extensionManager.getExtensions());
  ipcMain.handle('install-extension', (e, extPath) => extensionManager.installExtension(extPath));
  ipcMain.handle('install-from-chrome-store', (e, extId) => extensionManager.installFromChromeStore(extId));
  ipcMain.handle('uninstall-extension', (e, id) => extensionManager.uninstallExtension(id));
  ipcMain.handle('toggle-extension', (e, id) => extensionManager.toggleExtension(id));

  ipcMain.handle('get-flags', () => {
    try {
      const flagsPath = path.join(app.getPath('userData'), 'flags.json');
      if (fs.existsSync(flagsPath)) {
        return JSON.parse(fs.readFileSync(flagsPath, 'utf-8'));
      }
    } catch (e) {}
    return {};
  });

  ipcMain.handle('set-flag', (e, flag, enabled) => {
    try {
      const flagsPath = path.join(app.getPath('userData'), 'flags.json');
      var flags = {};
      if (fs.existsSync(flagsPath)) {
        flags = JSON.parse(fs.readFileSync(flagsPath, 'utf-8'));
      }
      flags[flag] = enabled;
      fs.writeFileSync(flagsPath, JSON.stringify(flags, null, 2), 'utf-8');
      return true;
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('show-notification', (e, opts) => {
    const Notification = require('electron').Notification;
    const notif = new Notification({
      title: opts.title || 'Orbital',
      body: opts.body || '',
      icon: opts.icon || path.join(__dirname, '..', '..', 'icons', 'icon.png'),
    });
    notif.show();
    if (opts.onClick) {
      notif.on('click', () => {
        const win = getMainWindow();
        if (win) win.focus();
      });
    }
  });

  ipcMain.on('window-minimize', (e) => {
    const win = getSenderWindow(e);
    if (win) win.minimize();
  });
  ipcMain.on('window-maximize', (e) => {
    const win = getSenderWindow(e);
    if (win) {
      win.isMaximized() ? win.unmaximize() : win.maximize();
    }
  });
  ipcMain.on('window-close', (e) => {
    const win = getSenderWindow(e);
    if (win) win.close();
  });

  ipcMain.handle('window-is-maximized', (e) => {
    const win = getSenderWindow(e);
    return win ? win.isMaximized() : false;
  });

  ipcMain.handle('set-proxy', (e, config) => {
    const ses = session.defaultSession;
    if (config.mode === 'none') {
      ses.setProxy({ proxyRules: '' });
    } else if (config.mode === 'system') {
      ses.setProxy({ proxyRules: '', proxyBypassRules: '' });
    } else if (config.mode === 'manual') {
      ses.setProxy({
        proxyRules: config.http ? `http=${config.http}` : '',
        proxyBypassRules: config.bypass || '',
      });
    } else if (config.mode === 'pac') {
      ses.setProxy({ proxyPacScript: config.pacUrl });
    }
    return true;
  });

  ipcMain.handle('clear-browsing-data', async (e, dataTypes) => {
    const ses = session.defaultSession;
    if (dataTypes.cache) await ses.clearCache();
    if (dataTypes.cookies) await ses.clearStorageData({ storages: ['cookies', 'localStorage', 'sessionStorage'] });
    if (dataTypes.history) storageManager.clearHistory();
    if (dataTypes.downloads) {
      storageManager.data.downloads = [];
      storageManager.save();
    }
    if (dataTypes.passwords) {
      storageManager.data.passwords = [];
      storageManager.save();
    }
    return true;
  });

  ipcMain.handle('get-battery-info', () => {
    try {
      const powerMonitor = require('electron').powerMonitor;
      return {
        onBattery: powerMonitor.isOnBatteryPower(),
      };
    } catch (e) {
      return { onBattery: false };
    }
  });

  ipcMain.handle('get-system-info', () => {
    try {
      const os = require('os');
      return {
        platform: process.platform,
        arch: process.arch,
        cpu: os.cpus()[0]?.model || 'unknown',
        memory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB',
        freeMemory: Math.round(os.freemem() / (1024 * 1024 * 1024)) + ' GB',
        hostname: os.hostname(),
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome,
        nodeVersion: process.versions.node,
      };
    } catch (e) {
      return { platform: process.platform, arch: process.arch };
    }
  });

  ipcMain.handle('write-file', async (e, filePath, data) => {
    try {
      fs.writeFileSync(filePath, data, 'utf-8');
      return true;
    } catch (err) {
      return false;
    }
  });

  ipcMain.handle('read-file', async (e, filePath) => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      return null;
    }
  });

  ipcMain.handle('get-system-fonts', async () => {
    try {
      return require('font-list').getFonts();
    } catch (e) {
      return [];
    }
  });

  ipcMain.handle('get-internal-page', (e, pageName) => {
    const pages = {
      'settings': 'settings.html',
      'bookmarks': 'bookmarks.html',
      'history': 'history.html',
      'downloads': 'downloads.html',
      'extensions': 'extensions.html',
      'about': 'about.html',
      'flags': 'flags.html',
    };
    const file = pages[pageName];
    if (!file) return null;
    try {
      const filePath = path.join(__dirname, '..', 'renderer', 'pages', file);
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  });

  ipcMain.handle('new-window', () => {
    if (createChildWindow) createChildWindow();
    return true;
  });

  ipcMain.handle('new-private-window', () => {
    if (createChildWindow) createChildWindow(null, { private: true });
    return true;
  });

  ipcMain.handle('open-devtools', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.webContents.openDevTools({ mode: 'right' });
    return true;
  });

  if (autoUpdater) {
    ipcMain.handle('check-for-updates', () => {
      autoUpdater.checkForUpdates();
      return true;
    });

    ipcMain.handle('get-update-status', () => {
      return autoUpdater.getStatus();
    });

    ipcMain.handle('download-update', () => {
      autoUpdater.downloadUpdate();
      return true;
    });

    ipcMain.handle('install-update', () => {
      autoUpdater.quitAndInstall();
      return true;
    });

    ipcMain.handle('set-update-feed', (e, url) => {
      autoUpdater.setFeedURL(url);
      return true;
    });

    ipcMain.handle('get-app-version', () => {
      return require('electron').app.getVersion();
    });

    autoUpdater.on('update-status', (data) => {
      const wins = BrowserWindow.getAllWindows();
      for (const win of wins) {
        try {
          win.webContents.send('update-status', data);
        } catch (e) {}
      }
    });
  }
}

module.exports = { setupIPC };
