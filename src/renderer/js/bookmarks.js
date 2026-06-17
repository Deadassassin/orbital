class BookmarkManager {
  constructor() {
    this.bookmarks = [];
    this.listeners = [];
  }

  async load() {
    try {
      var data = await (window.browserAPI ? window.browserAPI.getBookmarks() : []);
      this.bookmarks = data || [];
    } catch (e) {
      this.bookmarks = [];
    }
    this.renderBookmarksBar();
    this.notify();
  }

  async addBookmark(bookmark) {
    var result = await (window.browserAPI ? window.browserAPI.addBookmark(bookmark) : null);
    if (result) {
      this.bookmarks.push(result);
      this.renderBookmarksBar();
      this.notify();
    }
    return result;
  }

  async removeBookmark(id) {
    if (window.browserAPI) await window.browserAPI.removeBookmark(id);
    this.bookmarks = this.bookmarks.filter(function(b) { return b.id !== id; });
    this.renderBookmarksBar();
    this.notify();
  }

  async updateBookmark(id, updates) {
    var result = window.browserAPI ? await window.browserAPI.updateBookmark(id, updates) : null;
    if (result) {
      var idx = -1;
      for (var i = 0; i < this.bookmarks.length; i++) {
        if (this.bookmarks[i].id === id) { idx = i; break; }
      }
      if (idx !== -1) this.bookmarks[idx] = result;
      this.renderBookmarksBar();
      this.notify();
    }
    return result;
  }

  isBookmarked(url) {
    if (!url) return null;
    for (var i = 0; i < this.bookmarks.length; i++) {
      if (this.bookmarks[i].url === url) return this.bookmarks[i];
    }
    return null;
  }

  toggleBookmarkForCurrentTab(tab) {
    if (!tab || !tab.url || tab.url.startsWith('about:')) return;
    var existing = this.isBookmarked(tab.url);
    var self = this;
    if (existing) {
      this.removeBookmark(existing.id);
      if (window.__app) window.__app.showNotification('Bookmark removed');
    } else {
      this.addBookmark({
        url: tab.url,
        title: tab.title || tab.url,
        folder: '',
      });
      if (window.__app) window.__app.showNotification('Bookmark added');
    }
    var btn = document.getElementById('btn-bookmark');
    if (btn && window.__tabManager) {
      var t = window.__tabManager.getActiveTab();
      window.__tabManager.updateBookmarkButton(t);
    }
  }

  renderBookmarksBar() {
    var bar = document.getElementById('bookmarks-bar');
    var list = document.getElementById('bookmarks-list');
    if (!bar || !list) return;

    var settings = window.__browserState && window.__browserState.settings;
    var showBar = settings && settings.alwaysShowBookmarkBar;

    if (!showBar) {
      bar.classList.add('hidden');
      return;
    }

    bar.classList.remove('hidden');
    list.innerHTML = '';

    var folders = {};
    for (var i = 0; i < this.bookmarks.length; i++) {
      var bm = this.bookmarks[i];
      if (bm.folder) {
        if (!folders[bm.folder]) folders[bm.folder] = [];
        folders[bm.folder].push(bm);
      }
    }

    var folderKeys = Object.keys(folders);
    for (var fi = 0; fi < folderKeys.length; fi++) {
      var folder = folderKeys[fi];
      var fel = document.createElement('div');
      fel.className = 'bookmark-item';
      fel.textContent = folder;
      fel.title = 'Folder: ' + folder;
      fel.addEventListener('click', function() {
        var tm = window.__tabManager;
        if (tm) tm.navigateTab(tm.activeTabId, 'about:bookmarks');
      });
      list.appendChild(fel);
    }

    var uncategorized = [];
    for (var j = 0; j < this.bookmarks.length; j++) {
      if (!this.bookmarks[j].folder) uncategorized.push(this.bookmarks[j]);
    }
    var shown = uncategorized.slice(0, 20);

    for (var k = 0; k < shown.length; k++) {
      var bm = shown[k];
      var el = document.createElement('div');
      el.className = 'bookmark-item';
      el.textContent = bm.title || bm.url;
      el.title = bm.url;
      el.addEventListener('click', (function(url) {
        return function() {
          var tm = window.__tabManager;
          if (tm) tm.navigateTab(tm.activeTabId, url);
        };
      })(bm.url));
      el.addEventListener('contextmenu', (function(bookmark) {
        return function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (window.__toolbarManager) {
            window.__toolbarManager.showPageContextMenu(e.clientX, e.clientY);
          }
        };
      })(bm));
      list.appendChild(el);
    }
  }

  onChange(callback) {
    this.listeners.push(callback);
  }

  notify() {
    for (var i = 0; i < this.listeners.length; i++) {
      this.listeners[i](this.bookmarks);
    }
  }
}

window.__bookmarkManager = new BookmarkManager();