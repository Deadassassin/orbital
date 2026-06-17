const fs = require('fs');
const path = require('path');

class StorageManager {
  constructor(storagePath, app) {
    this.storagePath = storagePath;
    this.app = app;
    this.data = {
      bookmarks: [],
      history: [],
      settings: this.getDefaultSettings(),
      downloads: [],
      sessions: [],
      passwords: [],
      readingList: [],
    };
    this.ensureDirectories();
    this.load();
  }

  getDefaultSettings() {
    return {
      homepage: 'about:newtab',
      searchEngine: 'google',
      defaultZoom: 100,
      alwaysShowBookmarkBar: false,
      blockThirdPartyCookies: true,
      doNotTrack: true,
      blockKnownTrackers: true,
      upgradeHttps: true,
      blockFingerprinting: true,
      enableDarkMode: true,
      restoreLastSession: true,
      downloadPath: this.app.getPath('downloads'),
      enableHardwareAcceleration: true,
      spellCheckEnabled: true,
      safeBrowsing: true,
      passwordManager: true,
    };
  }

  ensureDirectories() {
    const dirs = [
      this.storagePath,
      path.join(this.storagePath, 'bookmarks'),
      path.join(this.storagePath, 'extensions'),
      path.join(this.storagePath, 'sessions'),
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  getBookmarks() {
    return this.data.bookmarks || [];
  }

  addBookmark(bookmark) {
    bookmark.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    bookmark.dateAdded = Date.now();
    this.data.bookmarks.push(bookmark);
    this.save();
    return bookmark;
  }

  updateBookmark(id, updates) {
    const idx = this.data.bookmarks.findIndex(b => b.id === id);
    if (idx !== -1) {
      this.data.bookmarks[idx] = { ...this.data.bookmarks[idx], ...updates };
      this.save();
      return this.data.bookmarks[idx];
    }
    return null;
  }

  removeBookmark(id) {
    this.data.bookmarks = this.data.bookmarks.filter(b => b.id !== id);
    this.save();
  }

  searchBookmarks(query) {
    const q = query.toLowerCase();
    return this.data.bookmarks.filter(b =>
      b.title?.toLowerCase().includes(q) || b.url?.toLowerCase().includes(q)
    );
  }

  getHistory() {
    return this.data.history || [];
  }

  addHistoryEntry(entry) {
    if (!entry.url || entry.url === 'about:blank' || entry.url.startsWith('about:')) return;
    const existing = this.data.history.findIndex(h => h.url === entry.url);
    if (existing !== -1) {
      this.data.history[existing].visitCount = (this.data.history[existing].visitCount || 1) + 1;
      this.data.history[existing].lastVisit = Date.now();
    } else {
      entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      entry.visitCount = 1;
      entry.lastVisit = Date.now();
      entry.firstVisit = Date.now();
      this.data.history.push(entry);
    }
    if (this.data.history.length > 10000) {
      this.data.history = this.data.history.slice(-7500);
    }
    this.save();
  }

  searchHistory(query) {
    const q = query.toLowerCase();
    return this.data.history.filter(h =>
      h.title?.toLowerCase().includes(q) || h.url?.toLowerCase().includes(q)
    ).sort((a, b) => b.lastVisit - a.lastVisit);
  }

  clearHistory() {
    this.data.history = [];
    this.save();
  }

  deleteHistoryEntry(id) {
    this.data.history = this.data.history.filter(h => h.id !== id);
    this.save();
  }

  getDownloads() {
    return this.data.downloads || [];
  }

  addDownload(download) {
    download.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    download.dateAdded = Date.now();
    this.data.downloads.push(download);
    this.save();
    return download;
  }

  updateDownload(id, updates) {
    const idx = this.data.downloads.findIndex(d => d.id === id);
    if (idx !== -1) {
      this.data.downloads[idx] = { ...this.data.downloads[idx], ...updates };
      this.save();
    }
  }

  removeDownload(id) {
    this.data.downloads = this.data.downloads.filter(d => d.id !== id);
    this.save();
  }

  getSettings() {
    return this.data.settings || this.getDefaultSettings();
  }

  updateSettings(updates) {
    this.data.settings = { ...this.data.settings, ...updates };
    this.save();
    return this.data.settings;
  }

  getSessions() {
    return this.data.sessions || [];
  }

  saveSession(sessionData) {
    this.data.sessions.push({
      id: Date.now().toString(36),
      timestamp: Date.now(),
      tabs: sessionData,
    });
    if (this.data.sessions.length > 50) {
      this.data.sessions = this.data.sessions.slice(-50);
    }
    this.save();
  }

  saveWindowsState(window) {
    try {
      const bounds = window.getBounds();
      this.data.settings.lastWindowBounds = bounds;
      this.data.settings.lastWindowMaximized = window.isMaximized();
      this.save();
    } catch (e) {}
  }

  getPasswords() {
    return this.data.passwords || [];
  }

  addPassword(entry) {
    entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    this.data.passwords.push(entry);
    this.save();
    return entry;
  }

  updatePassword(id, updates) {
    const idx = this.data.passwords.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.data.passwords[idx] = { ...this.data.passwords[idx], ...updates };
      this.save();
    }
  }

  removePassword(id) {
    this.data.passwords = this.data.passwords.filter(p => p.id !== id);
    this.save();
  }

  getReadingList() {
    return this.data.readingList || [];
  }

  addToReadingList(item) {
    item.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    item.dateAdded = Date.now();
    item.read = false;
    this.data.readingList.push(item);
    this.save();
    return item;
  }

  removeFromReadingList(id) {
    this.data.readingList = this.data.readingList.filter(r => r.id !== id);
    this.save();
  }

  load() {
    try {
      const filePath = path.join(this.storagePath, 'browser-data.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const loaded = JSON.parse(raw);
        this.data = { ...this.data, ...loaded };
      }
    } catch (e) {
      console.warn('Failed to load browser data:', e.message);
    }
  }

  save() {
    try {
      const filePath = path.join(this.storagePath, 'browser-data.json');
      const tmpPath = filePath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpPath, filePath);
    } catch (e) {
      console.warn('Failed to save browser data:', e.message);
    }
  }

  flush() {
    this.save();
  }

  exportBookmarks() {
    const html = [
      '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
      '<TITLE>Bookmarks</TITLE>',
      '<H1>Bookmarks</H1>',
      '<DL><p>',
    ];
    for (const bm of this.data.bookmarks) {
      html.push(`    <DT><A HREF="${bm.url}" ADD_DATE="${Math.floor(bm.dateAdded / 1000)}">${bm.title}</A>`);
    }
    html.push('</DL><p>');
    return html.join('\n');
  }

  importBookmarks(html) {
    const re = /<A\s+HREF="([^"]+)"[^>]*>(.*?)<\/A>/gi;
    let match;
    let count = 0;
    while ((match = re.exec(html)) !== null) {
      this.addBookmark({
        url: match[1],
        title: match[2].trim() || match[1],
        folder: 'Imported',
      });
      count++;
    }
    return count;
  }
}

module.exports = { StorageManager };
