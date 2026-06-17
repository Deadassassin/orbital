const { autoUpdater } = require('electron-updater');
const { dialog, app, BrowserWindow } = require('electron');
const EventEmitter = require('events');

class AutoUpdater extends EventEmitter {
  constructor() {
    super();
    this.status = 'idle';
    this.info = null;
    this.downloaded = false;
    this.autoCheckEnabled = true;
    this.feedURL = null;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      this.status = 'checking';
      this.emit('update-status', { status: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
      this.status = 'available';
      this.info = info;
      this.emit('update-status', { status: 'available', info });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.status = 'up-to-date';
      this.info = info;
      this.emit('update-status', { status: 'up-to-date', info });
    });

    autoUpdater.on('error', (err) => {
      this.status = 'error';
      this.emit('update-status', { status: 'error', message: err.message });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.emit('update-status', { status: 'downloading', progress });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.status = 'downloaded';
      this.downloaded = true;
      this.info = info;
      this.emit('update-status', { status: 'downloaded', info });
    });
  }

  setFeedURL(url) {
    this.feedURL = url;
    if (url) {
      autoUpdater.setFeedURL(url);
    }
  }

  checkForUpdates() {
    this.status = 'checking';
    if (this.feedURL) {
      autoUpdater.setFeedURL(this.feedURL);
    }
    autoUpdater.checkForUpdates().catch((err) => {
      this.status = 'error';
      this.emit('update-status', { status: 'error', message: err.message });
    });
  }

  downloadUpdate() {
    autoUpdater.downloadUpdate().catch((err) => {
      this.status = 'error';
      this.emit('update-status', { status: 'error', message: err.message });
    });
  }

  quitAndInstall() {
    autoUpdater.quitAndInstall();
  }

  getStatus() {
    return {
      status: this.status,
      info: this.info,
      downloaded: this.downloaded,
      autoCheckEnabled: this.autoCheckEnabled,
      currentVersion: app.getVersion(),
    };
  }
}

module.exports = { AutoUpdater };
