const { app, BrowserWindow, session, ipcMain, Menu, Tray, shell, dialog, nativeTheme, powerSaveBlocker } = require('electron');
const path = require('path');
const { setupIPC } = require('./ipc');
const { createMenu } = require('./menu');
const { PrivacyManager } = require('./privacy');
const { StorageManager } = require('./storage');
const { ExtensionManager } = require('./extensions/index');

var mainWindow = null;
var tray = null;
var privacyManager = null;
var storageManager = null;
var extensionManager = null;
var isQuitting = false;
var powerSaveId = null;
var allWindows = new Set();

var PRIVATE_BROWSING_FLAG = '--private';
var DEV_FLAG = '--dev';

var isPrivateMode = process.argv.includes(PRIVATE_BROWSING_FLAG);
var isDevMode = process.argv.includes(DEV_FLAG);

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-encrypted-media');
app.commandLine.appendSwitch('enable-widevine');

app.whenReady().then(function() {
  var userDataPath = app.getPath('userData');
  var storagePath = path.join(userDataPath, 'storage');
  privacyManager = new PrivacyManager(session, app);
  storageManager = new StorageManager(storagePath, app);
  extensionManager = new ExtensionManager(app, session.defaultSession);
  extensionManager.loadEnabledExtensions().then(function() {}).catch(function(e) { console.log('Extension load error:', e.message); });

  app.on('widevine-ready', function() { console.log('Widevine ready'); });
  app.on('widevine-update-pending', function() { console.log('Widevine update pending'); });
  app.on('widevine-error', function(error) { console.log('Widevine error:', error); });

  setupIPC(ipcMain, {
    privacyManager: privacyManager,
    storageManager: storageManager,
    extensionManager: extensionManager,
    getMainWindow: function() { return mainWindow; },
    createChildWindow: createChildWindow,
    isPrivateMode: isPrivateMode,
    isDevMode: isDevMode
  });

  var defaultSession = session.defaultSession;

  ipcMain.on('webview-navigate', function(e, url) {
    var win = BrowserWindow.fromWebContents(e.sender);
    if (win) {
      var wc = win.webContents;
      wc.executeJavaScript('window.__tabManager?.navigateTab(window.__tabManager?.activeTabId, ' + JSON.stringify(url) + ');');
    }
  });

  defaultSession.setPermissionRequestHandler(function(webContents, permission, callback) {
    var url = webContents.getURL();
    var allowedPermissions = ['clipboard-read', 'clipboard-write', 'fullscreen', 'media'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else if (['geolocation', 'notifications', 'camera', 'microphone'].includes(permission)) {
      dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Allow', 'Block'],
        defaultId: 1,
        title: 'Permission Request',
        message: 'Allow ' + permission + ' access for ' + new URL(url).hostname + '?'
      }).then(function(result) { callback(result.response === 0); });
    } else {
      callback(false);
    }
  });

  privacyManager.applyPrivacySettings(defaultSession);

  createMainWindow();
  setupAppShortcuts();

  var menu = createMenu({
    getWindow: function() { return BrowserWindow.getFocusedWindow() || mainWindow; },
    createWindow: createChildWindow,
    storageManager: storageManager,
    isPrivateMode: isPrivateMode
  });
  Menu.setApplicationMenu(isPrivateMode ? null : menu);

  createTray();

  app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });

  powerSaveId = powerSaveBlocker.start('prevent-display-sleep');
});

app.on('before-quit', function() {
  isQuitting = true;
  if (powerSaveId) powerSaveBlocker.stop(powerSaveId);
});

app.on('will-quit', function() {
  if (storageManager) storageManager.flush();
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 300,
    title: 'Orbital',
    icon: path.join(__dirname, '..', '..', 'icons', 'icon.png'),
    show: false,
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'linux' ? true : false,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,
      plugins: true,
      spellcheck: true,
      enableWebSQL: false,
      autoplayPolicy: 'user-gesture-required',
      enableRemoteModule: false,
      webSecurity: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  setupWindowShortcuts(mainWindow.webContents);

  mainWindow.once('ready-to-show', function() {
    mainWindow.show();
    if (isPrivateMode) {
      mainWindow.setTitle('Orbital (Private)');
    }
    if (isDevMode) {
      mainWindow.webContents.openDevTools({ mode: 'right' });
    }
  });

  mainWindow.on('maximize', function() {
    mainWindow.webContents.send('window-maximized-changed', true);
  });
  mainWindow.on('unmaximize', function() {
    mainWindow.webContents.send('window-maximized-changed', false);
  });

  mainWindow.on('close', function(e) {
    if (!isQuitting && !isPrivateMode && storageManager) {
      storageManager.saveWindowsState(mainWindow);
    }
  });

  mainWindow.on('closed', function() {
    allWindows.delete(mainWindow);
    mainWindow = null;
  });
  allWindows.add(mainWindow);

  mainWindow.webContents.setWindowOpenHandler(function(urlObj) {
    mainWindow.webContents.send('new-tab-url', urlObj.url);
    return { action: 'deny' };
  });

  if (isPrivateMode) {
    mainWindow.webContents.session.setStorageQuota({ quota: 0 });
  }
}

function createTray() {
  try {
    tray = new Tray(path.join(__dirname, '..', '..', 'icons', 'icon.png'));
    var ctxMenu = Menu.buildFromTemplate([
      { label: 'Show Window', click: function() { if (mainWindow) mainWindow.show(); } },
      { label: 'New Window', click: function() { createChildWindow(); } },
      { type: 'separator' },
      { label: 'Quit', click: function() { app.quit(); } },
    ]);
    tray.setToolTip('Orbital');
    tray.setContextMenu(ctxMenu);
    tray.on('click', function() { if (mainWindow) mainWindow.show(); });
  } catch (e) {
    console.warn('Tray creation failed:', e.message);
  }
}

function createChildWindow(url, opts) {
  if (!opts) opts = {};
  var isPrivate = opts.private;
  var win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 300,
    title: isPrivate ? 'Orbital (Private)' : 'Orbital',
    icon: path.join(__dirname, '..', '..', 'icons', 'icon.png'),
    show: false,
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'linux' ? true : false,
    backgroundColor: '#1a1b2e',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      plugins: true,
      webSecurity: true,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  setupWindowShortcuts(win.webContents);
  win.once('ready-to-show', function() { win.show(); });
  win.on('closed', function() { allWindows.delete(win); });
  win.webContents.setWindowOpenHandler(function(urlObj) {
    win.webContents.send('new-tab-url', urlObj.url);
    return { action: 'deny' };
  });
  allWindows.add(win);
  if (url) {
    win.webContents.on('did-finish-load', function() {
      win.webContents.send('navigate', url);
    });
  }
  if (isPrivate) {
    win.webContents.session.setStorageQuota({ quota: 0 });
  }
  return win;
}

var shortcutContents = new WeakSet();

function setupAppShortcuts() {
  app.on('web-contents-created', function(event, contents) {
    setupWindowShortcuts(contents);
  });
}

function setupWindowShortcuts(contents) {
  if (!contents || shortcutContents.has(contents)) return;
  shortcutContents.add(contents);

  contents.on('before-input-event', function(event, input) {
    if (input.type !== 'keyDown') return;

    var ctrl = input.control || input.meta;
    var key = (input.key || '').toLowerCase();
    var target = getCommandWindow(contents);
    if (!target || target.isDestroyed()) return;

    var send = function(channel) {
      var args = Array.prototype.slice.call(arguments, 1);
      event.preventDefault();
      target.webContents.send.apply(target.webContents, [channel].concat(args));
    };

    if (ctrl && !input.shift && key === 't') return send('new-tab');
    if (ctrl && !input.shift && key === 'w') return send('close-tab');
    if (ctrl && !input.shift && key === 'l') return send('focus-urlbar');
    if (ctrl && !input.shift && key === 'r') return send('reload-tab');
    if (ctrl && input.shift && key === 'r') return send('force-reload-tab');
    if (ctrl && !input.shift && key === 'f') return send('find-in-page');
    if (ctrl && !input.shift && key === 'd') return send('bookmark-current');
    if (ctrl && !input.shift && key === 'h') return send('navigate', 'about:history');
    if (ctrl && !input.shift && key === 'j') return send('navigate', 'about:downloads');
    if (ctrl && input.shift && key === 'o') return send('navigate', 'about:bookmarks');
    if (ctrl && key === ',') return send('navigate', 'about:settings');
    if (ctrl && input.shift && key === 'i') {
      event.preventDefault();
      return target.webContents.toggleDevTools();
    }
    if (ctrl && !input.shift && key === 'n') {
      event.preventDefault();
      return createChildWindow();
    }
    if (ctrl && input.shift && key === 'n') {
      event.preventDefault();
      return createChildWindow(null, { private: true });
    }
    if (key === 'f11') {
      event.preventDefault();
      return target.setFullScreen(!target.isFullScreen());
    }
  });
}

function getCommandWindow(contents) {
  var hostContents = contents.hostWebContents || contents;
  return BrowserWindow.fromWebContents(hostContents) || BrowserWindow.getFocusedWindow() || mainWindow;
}

module.exports = { mainWindow: mainWindow, createMainWindow: createMainWindow, createChildWindow: createChildWindow, privacyManager: privacyManager, storageManager: storageManager, extensionManager: extensionManager, isPrivateMode: isPrivateMode, allWindows: allWindows };
