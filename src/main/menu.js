const { Menu, shell, app, BrowserWindow, dialog } = require('electron');

function createMenu(options, legacyStorageManager, legacyPrivateMode) {
  const mainWindow = options && options.webContents ? options : null;
  const storageManager = options?.storageManager || legacyStorageManager;
  const isPrivateMode = options?.isPrivateMode ?? legacyPrivateMode;
  const getWindow = options?.getWindow || (() => BrowserWindow.getFocusedWindow() || mainWindow);
  const createWindow = options?.createWindow || (() => {
    const { createChildWindow } = require('./main');
    return createChildWindow();
  });
  const send = (channel, ...args) => getWindow()?.webContents.send(channel, ...args);
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { label: 'About Orbital', role: 'about' },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'Cmd+,', click: () => send('navigate', 'about:settings') },
        { type: 'separator' },
        { label: 'Hide', role: 'hide' },
        { label: 'Hide Others', role: 'hideOthers' },
        { type: 'separator' },
        { label: 'Quit', role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'Ctrl+T',
          click: () => send('new-tab'),
        },
        {
          label: 'New Window',
          accelerator: 'Ctrl+N',
          click: () => createWindow(),
        },
        {
          label: 'New Private Window',
          accelerator: 'Ctrl+Shift+N',
          click: () => createWindow(null, { private: true }),
        },
        { type: 'separator' },
        { label: 'Open File...', accelerator: 'Ctrl+O', click: () => openFile(getWindow()) },
        { type: 'separator' },
        { label: 'Save Page As...', accelerator: 'Ctrl+S', click: () => send('save-page') },
        { type: 'separator' },
        { label: 'Print...', accelerator: 'Ctrl+P', click: () => send('print-page') },
        { type: 'separator' },
        ...(isMac ? [] : [{ label: 'Exit', accelerator: 'Alt+F4', role: 'quit' }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Ctrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Ctrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Ctrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'Ctrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'Ctrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'Ctrl+A', role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find in Page', accelerator: 'Ctrl+F', click: () => send('find-in-page') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'Ctrl+R', click: () => send('reload-tab') },
        { label: 'Force Reload', accelerator: 'Ctrl+Shift+R', click: () => send('force-reload-tab') },
        { label: 'Stop', accelerator: 'Escape', click: () => send('stop-load') },
        { type: 'separator' },
        {
          label: 'Bookmarks Bar',
          type: 'checkbox',
          checked: storageManager?.getSettings()?.alwaysShowBookmarkBar || false,
          click: (menuItem) => {
            storageManager?.updateSettings({ alwaysShowBookmarkBar: menuItem.checked });
            send('toggle-bookmark-bar', menuItem.checked);
          },
        },
        { type: 'separator' },
        { label: 'Fullscreen', accelerator: 'F11', role: 'togglefullscreen' },
        { label: 'Developer Tools', accelerator: 'Ctrl+Shift+I', click: () => getWindow()?.webContents.toggleDevTools() },
      ],
    },
    {
      label: 'History',
      submenu: [
        { label: 'Show History', accelerator: 'Ctrl+H', click: () => send('navigate', 'about:history') },
        { label: 'Recently Closed Tabs', click: () => send('show-recently-closed') },
        { type: 'separator' },
        { label: 'Clear Browsing Data...', click: () => send('navigate', 'about:settings#privacy') },
      ],
    },
    {
      label: 'Bookmarks',
      submenu: [
        { label: 'Bookmark This Tab', accelerator: 'Ctrl+D', click: () => send('bookmark-current') },
        { label: 'Bookmark Manager', accelerator: 'Ctrl+Shift+O', click: () => send('navigate', 'about:bookmarks') },
        { label: 'Import Bookmarks...', click: () => importBookmarks(getWindow(), storageManager) },
        { label: 'Export Bookmarks...', click: () => exportBookmarks(getWindow(), storageManager) },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Downloads', accelerator: 'Ctrl+J', click: () => send('navigate', 'about:downloads') },
        { label: 'Extensions', click: () => send('navigate', 'about:extensions') },
        { label: 'Settings', accelerator: isMac ? 'Cmd+,' : 'Ctrl+,', click: () => send('navigate', 'about:settings') },
        { type: 'separator' },
        { label: 'Task Manager', click: () => send('navigate', 'about:task-manager') },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About Orbital', click: () => send('navigate', 'about:about') },
        { type: 'separator' },
        { label: 'Report Issue', click: () => shell.openExternal('https://github.com/orbital-browser/orbital/issues') },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

function openFile(mainWindow) {
  dialog.showOpenDialog(mainWindow, {
    filters: [
      { name: 'Web Pages', extensions: ['html', 'htm', 'svg', 'pdf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  }).then(({ canceled, filePaths }) => {
    if (!canceled && filePaths.length > 0) {
      mainWindow?.webContents.send('navigate', `file://${filePaths[0]}`);
    }
  });
}

function importBookmarks(mainWindow, storageManager) {
  dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Bookmarks HTML', extensions: ['html', 'htm'] }],
    properties: ['openFile'],
  }).then(({ canceled, filePaths }) => {
    if (!canceled && filePaths.length > 0) {
      const fs = require('fs');
      const html = fs.readFileSync(filePaths[0], 'utf-8');
      const count = storageManager.importBookmarks(html);
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        message: `Imported ${count} bookmarks successfully.`,
      });
    }
  });
}

function exportBookmarks(mainWindow, storageManager) {
  dialog.showSaveDialog(mainWindow, {
    filters: [{ name: 'Bookmarks HTML', extensions: ['html'] }],
    defaultPath: 'bookmarks.html',
  }).then(({ canceled, filePath }) => {
    if (!canceled && filePath) {
      const fs = require('fs');
      const html = storageManager.exportBookmarks();
      fs.writeFileSync(filePath, html, 'utf-8');
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        message: 'Bookmarks exported successfully.',
      });
    }
  });
}

module.exports = { createMenu };
