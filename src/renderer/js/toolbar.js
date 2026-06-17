class Orbital {
  constructor() {
    this.paletteOpen = false;
    this.cmdIndex = -1;
    this.setupCommandPalette();
    this.setupNavigation();
    this.setupUrlBar();
    this.setupWindowControls();
    this.setupSidebar();
    this.setupBookmarkButton();
    this.setupFindBar();
    this.setupContextMenu();
    this.setupTabContextMenu();
    this.setupReloadStopToggle();
    this.setupNavBarAutoShow();
    this.setupTabEvents();

    document.addEventListener('click', this.closeMenus.bind(this));
    document.addEventListener('keydown', this.handleGlobalKeys.bind(this));
  }

  /* ── Command Palette ────────────────────── */
  setupCommandPalette() {
    var trigger = document.getElementById('cmd-palette-trigger');
    var overlay = document.getElementById('cmd-palette-overlay');
    var input = document.getElementById('cmd-input');
    var results = document.getElementById('cmd-results');

    if (trigger) trigger.addEventListener('click', function() { window.__orbital.openPalette(); });
    if (input) {
      input.addEventListener('input', function() { window.__orbital.filterCommands(input.value); });
      input.addEventListener('keydown', function(e) { window.__orbital.handleCmdKeydown(e); });
    }
  }

  openPalette() {
    this.paletteOpen = true;
    var overlay = document.getElementById('cmd-palette-overlay');
    var input = document.getElementById('cmd-input');
    overlay.classList.remove('hidden');
    overlay.classList.add('open');
    this.cmdIndex = -1;
    setTimeout(function() { input.value = ''; input.focus(); window.__orbital.filterCommands(''); }, 50);
  }

  closePalette() {
    this.paletteOpen = false;
    var overlay = document.getElementById('cmd-palette-overlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('open');
    document.getElementById('cmd-input').blur();
  }

  filterCommands(query) {
    var results = document.getElementById('cmd-results');
    results.innerHTML = '';
    this.cmdIndex = -1;
    var q = query.trim().toLowerCase();

    var commands = [];
    var tm = window.__tabManager;
    var api = window.browserAPI;

    if (q && !q.match(/^about:/)) {
      var isUrl = q.indexOf('.') !== -1 && q.indexOf(' ') === -1;
      commands.push({
        type: 'action',
        icon: Icons.search,
        text: isUrl ? 'Go to ' + q : 'Search "' + q + '"',
        desc: isUrl ? 'Navigate to URL' : 'Search with ' + ((window.__browserState && window.__browserState.settings && window.__browserState.settings.searchEngine) || 'Google'),
        action: function() { window.__orbital.closePalette(); var tm = window.__tabManager; if (tm) tm.navigateTab(tm.activeTabId, q); }
      });
    }

    commands.push({ type: 'action', icon: Icons.newTab, text: 'New Tab', desc: 'Open a new blank tab', hint: 'Ctrl+T', action: function() { window.__orbital.closePalette(); if (tm) tm.createTab(); } });
    commands.push({ type: 'action', icon: Icons.newWindow, text: 'New Window', desc: 'Open a new browser window', hint: 'Ctrl+N', action: function() { window.__orbital.closePalette(); if (api) api.newWindow(); } });
    commands.push({ type: 'action', icon: Icons.privateWindow, text: 'New Private Window', desc: 'Browse without saving history', hint: 'Ctrl+Shift+N', action: function() { window.__orbital.closePalette(); if (api) api.newPrivateWindow(); } });

    if (tm && tm.activeTabId) {
      if (tm.getActiveTab() && !tm.getActiveTab().url.startsWith('about:')) {
        commands.push({ type: 'action', icon: Icons.bookmark, text: 'Bookmark Current Page', desc: 'Add or remove bookmark', hint: 'Ctrl+D', action: function() { window.__orbital.closePalette(); var t = tm.getActiveTab(); if (t && window.__bookmarkManager) window.__bookmarkManager.toggleBookmarkForCurrentTab(t); } });
      }
    }

    commands.push({ type: 'separator' });

    commands.push({ type: 'action', icon: Icons.settings, text: 'Settings', desc: 'Configure Orbital', action: function() { window.__orbital.closePalette(); if (tm) tm.navigateTab(tm.activeTabId, 'about:settings'); } });
    commands.push({ type: 'action', icon: Icons.bookmark, text: 'Bookmarks', desc: 'View saved bookmarks', hint: 'Ctrl+Shift+O', action: function() { window.__orbital.closePalette(); if (tm) tm.navigateTab(tm.activeTabId, 'about:bookmarks'); } });
    commands.push({ type: 'action', icon: Icons.history, text: 'History', desc: 'View browsing history', hint: 'Ctrl+H', action: function() { window.__orbital.closePalette(); if (tm) tm.navigateTab(tm.activeTabId, 'about:history'); } });
    commands.push({ type: 'action', icon: Icons.downloads, text: 'Downloads', desc: 'View downloaded files', hint: 'Ctrl+J', action: function() { window.__orbital.closePalette(); if (tm) tm.navigateTab(tm.activeTabId, 'about:downloads'); } });
    commands.push({ type: 'action', icon: Icons.extensions, text: 'Extensions', desc: 'Manage extensions', action: function() { window.__orbital.closePalette(); if (tm) tm.navigateTab(tm.activeTabId, 'about:extensions'); } });
    commands.push({ type: 'action', icon: Icons.flags || Icons.info, text: 'Flags', desc: 'Experimental features settings', action: function() { window.__orbital.closePalette(); if (tm) tm.navigateTab(tm.activeTabId, 'about:flags'); } });
    commands.push({ type: 'action', icon: Icons.info, text: 'About Orbital', desc: 'Version and system info', action: function() { window.__orbital.closePalette(); if (tm) tm.navigateTab(tm.activeTabId, 'about:about'); } });

    commands.push({ type: 'separator' });

    commands.push({ type: 'action', icon: Icons.find, text: 'Find in Page', desc: 'Search within the current page', hint: 'Ctrl+F', action: function() { window.__orbital.closePalette(); window.__orbital.showFindBar(); } });
    commands.push({ type: 'action', icon: Icons.print, text: 'Print...', desc: 'Print the current page', action: function() { window.__orbital.closePalette(); if (api) api.printPage(); } });
    commands.push({ type: 'action', icon: Icons.devtools, text: 'Developer Tools', desc: 'Open DevTools for current page', hint: 'Ctrl+Shift+I', action: function() { window.__orbital.closePalette(); if (api) api.openDevtools(); } });

    commands.push({ type: 'separator' });

    commands.push({ type: 'action', icon: Icons.zoomIn, text: 'Zoom In', desc: 'Increase page zoom', hint: 'Ctrl+=', action: function() { window.__orbital.closePalette(); var t = tm && tm.getActiveTab(); if (t) { t.zoomLevel = (t.zoomLevel || 0) + 0.5; if (t.webview) t.webview.setZoomLevel(t.zoomLevel); } } });
    commands.push({ type: 'action', icon: Icons.zoomOut, text: 'Zoom Out', desc: 'Decrease page zoom', hint: 'Ctrl+-', action: function() { window.__orbital.closePalette(); var t = tm && tm.getActiveTab(); if (t) { t.zoomLevel = (t.zoomLevel || 0) - 0.5; if (t.webview) t.webview.setZoomLevel(t.zoomLevel); } } });
    commands.push({ type: 'action', icon: Icons.zoomReset, text: 'Reset Zoom', desc: 'Return to default zoom level', hint: 'Ctrl+0', action: function() { window.__orbital.closePalette(); var t = tm && tm.getActiveTab(); if (t) { t.zoomLevel = 0; if (t.webview) t.webview.setZoomLevel(0); } } });

    // Filter
    if (q) {
      commands = commands.filter(function(c) {
        if (c.type === 'separator') return false;
        return c.text.toLowerCase().indexOf(q) !== -1 || (c.desc && c.desc.toLowerCase().indexOf(q) !== -1);
      });
    }

    var self = this;
    commands.forEach(function(cmd, i) {
      if (cmd.type === 'separator') {
        var sep = document.createElement('div');
        sep.style.cssText = 'height:1px;background:var(--border);margin:4px 10px;';
        results.appendChild(sep);
        return;
      }
      var el = document.createElement('div');
      el.className = 'cmd-item';
      el.dataset.index = i;
      el.innerHTML = '<span class="cmd-icon">' + (cmd.icon || '') + '</span>' +
        '<span class="cmd-text">' + cmd.text + (cmd.desc ? '<span class="cmd-desc"> · ' + cmd.desc + '</span>' : '') + '</span>' +
        (cmd.hint ? '<span class="cmd-hint">' + cmd.hint + '</span>' : '');
      el.addEventListener('mousedown', function(e) { e.preventDefault(); cmd.action(); });
      el.addEventListener('mouseenter', function() {
        var sel = results.querySelector('.selected');
        if (sel) sel.classList.remove('selected');
        el.classList.add('selected');
        self.cmdIndex = i;
      });
      results.appendChild(el);
    });
  }

  handleCmdKeydown(e) {
    var results = document.getElementById('cmd-results');
    var items = results.querySelectorAll('.cmd-item');
    if (items.length === 0) return;

    if (e.key === 'Escape') {
      this.closePalette();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      var selected = results.querySelector('.cmd-item.selected');
      if (selected) { selected.dispatchEvent(new MouseEvent('mousedown')); }
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items.forEach(function(el) { el.classList.remove('selected'); });
      this.cmdIndex += e.key === 'ArrowDown' ? 1 : -1;
      if (this.cmdIndex < 0) this.cmdIndex = items.length - 1;
      if (this.cmdIndex >= items.length) this.cmdIndex = 0;
      items[this.cmdIndex].classList.add('selected');
      items[this.cmdIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  /* ── Navigation Bar ──────────────────────── */
  setupNavigation() {
    var self = this;
    var navBack = document.getElementById('nav-back');
    var navForward = document.getElementById('nav-forward');
    var navHome = document.getElementById('nav-home');
    var newTabBtn = document.getElementById('new-tab-btn');

    if (navBack) navBack.addEventListener('click', function() { var tm = window.__tabManager; if (tm) tm.goBack(); });
    if (navForward) navForward.addEventListener('click', function() { var tm = window.__tabManager; if (tm) tm.goForward(); });
    if (navHome) navHome.addEventListener('click', function() {
      var settings = window.__browserState && window.__browserState.settings;
      var homeUrl = (settings && settings.homepage) || 'about:newtab';
      var tm = window.__tabManager;
      if (tm) tm.navigateTab(tm.activeTabId, homeUrl);
    });
    if (newTabBtn) newTabBtn.addEventListener('click', function() {
      window.__tabManager && window.__tabManager.createTab();
    });
  }

  setupReloadStopToggle() {
    var btn = document.getElementById('nav-reload');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var tm = window.__tabManager;
      if (!tm) return;
      var tab = tm.getActiveTab();
      if (!tab) return;
      if (tab.loading) tm.stopTab(tab.id);
      else tm.reloadTab(tab.id);
    });

    var self = this;
    if (window.__tabManager) {
      window.__tabManager.on('tab-loading', function() { self.updateReloadIcon(true); });
      window.__tabManager.on('tab-stopped', function() { self.updateReloadIcon(false); });
      window.__tabManager.on('tab-activated', function() {
        var tab = window.__tabManager && window.__tabManager.getActiveTab();
        self.updateReloadIcon(tab ? tab.loading : false);
      });
    }
  }

  updateReloadIcon(loading) {
    var btn = document.getElementById('nav-reload');
    if (!btn) return;
    btn.innerHTML = loading ? Icons.stop : Icons.reload;
    btn.title = loading ? 'Stop' : 'Reload';
  }

  /* ── Nav Bar Auto-show ─────────────────────── */
  setupNavBarAutoShow() {
    var navBar = document.getElementById('nav-bar');
    var content = document.getElementById('content');
    var hideTimer = null;

    function showNav() {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      navBar.classList.add('visible');
    }

    function scheduleHide() {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(function() {
        if (!document.getElementById('url-input') || document.getElementById('url-input') !== document.activeElement) {
          navBar.classList.remove('visible');
        }
      }, 2000);
    }

    content.addEventListener('mouseenter', showNav);
    content.addEventListener('mousemove', function() {
      if (!navBar.classList.contains('visible')) showNav();
      scheduleHide();
    });
    content.addEventListener('mouseleave', scheduleHide);

    document.getElementById('url-input').addEventListener('focus', showNav);
    document.getElementById('url-input').addEventListener('blur', scheduleHide);
  }

  /* ── URL Bar ────────────────────────────── */
  setupUrlBar() {
    var input = document.getElementById('url-input');
    var dropdown = document.getElementById('urlbar-dropdown');
    if (!input) return;
    var self = this;

    input.addEventListener('focus', function() {
      input.select();
      if (input.value) self.showAutocomplete(input.value);
    });

    input.addEventListener('input', function() {
      if (input.value) self.showAutocomplete(input.value);
      else { if (dropdown) dropdown.classList.add('hidden'); }
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (dropdown) dropdown.classList.add('hidden');
        var tm = window.__tabManager;
        if (tm && input.value) tm.navigateTab(tm.activeTabId, input.value);
        input.blur();
      } else if (e.key === 'Escape') {
        if (dropdown) dropdown.classList.add('hidden');
        input.blur();
        var tm = window.__tabManager;
        var tab = tm && tm.getActiveTab();
        if (tab) tm.updateUrlBar(tab);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        self.navigateDropdown(e.key === 'ArrowDown' ? 1 : -1);
      }
    });

    input.addEventListener('blur', function() {
      setTimeout(function() { if (dropdown) dropdown.classList.add('hidden'); }, 200);
      var tm = window.__tabManager;
      var tab = tm && tm.getActiveTab();
      if (tab) tm.updateUrlBar(tab);
    });

    var secInd = document.getElementById('security-indicator');
    if (secInd) {
      secInd.addEventListener('click', function() {
        var tm = window.__tabManager;
        var tab = tm && tm.getActiveTab();
        if (tab && tab.url && !tab.url.startsWith('about:')) {
          try {
            var u = new URL(tab.url);
            if (window.__app) window.__app.showNotification('Connection: ' + u.hostname + (u.protocol === 'https:' ? ' (secure)' : ' (not secure)'));
          } catch(ex) {}
        }
      });
    }
  }

  showAutocomplete(query) {
    var dropdown = document.getElementById('urlbar-dropdown');
    if (!dropdown) return;
    var self = this;

    Promise.all([
      window.browserAPI ? window.browserAPI.searchHistory(query).catch(function() { return []; }) : Promise.resolve([]),
      window.browserAPI ? window.browserAPI.searchBookmarks(query).catch(function() { return []; }) : Promise.resolve([]),
    ]).then(function(results) {
      var history = results[0] || [];
      var bookmarks = results[1] || [];
      dropdown.innerHTML = '';
      self.cmdIndex = -1;
      var hasItems = false;

      if (query.includes('.') && !query.includes(' ')) {
        var url = query.match(/^[a-zA-Z]+:\/\//) ? query : 'https://' + query;
        self.addDropdownItem(dropdown, 'globe', url, url, function() { self.navigateTo(url); });
        hasItems = true;
      } else {
        self.addDropdownItem(dropdown, 'search', 'Search "' + query + '"', null, function() { self.navigateTo(query); });
        hasItems = true;
      }

      if (history.length > 0) {
        for (var i = 0; i < Math.min(history.length, 5); i++) {
          var h = history[i];
          self.addDropdownItem(dropdown, 'clock', h.title || h.url, h.url, (function(url) { return function() { self.navigateTo(url); }; })(h.url));
        }
      }

      if (bookmarks.length > 0) {
        for (var j = 0; j < Math.min(bookmarks.length, 5); j++) {
          var b = bookmarks[j];
          self.addDropdownItem(dropdown, 'bookmark', b.title || b.url, b.url, (function(url) { return function() { self.navigateTo(url); }; })(b.url));
        }
      }

      dropdown.classList.toggle('hidden', !(hasItems || dropdown.children.length > 0));
    });
  }

  addDropdownItem(dropdown, icon, title, url, action) {
    var div = document.createElement('div');
    div.className = 'urlbar-dropdown-item';
    div.innerHTML =
      '<span class="item-icon">' + (Icons[icon] || Icons.globe) + '</span>' +
      '<span class="item-text">' +
        '<span class="item-title">' + this.escapeHtml(title) + '</span>' +
        (url ? '<span class="item-url">' + this.escapeHtml(url) + '</span>' : '') +
      '</span>';
    div.addEventListener('mousedown', function(e) {
      e.preventDefault();
      action();
      var dd = document.getElementById('urlbar-dropdown');
      if (dd) dd.classList.add('hidden');
    });
    dropdown.appendChild(div);
  }

  escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  navigateDropdown(direction) {
    var items = document.querySelectorAll('.urlbar-dropdown-item');
    if (items.length === 0) return;
    items.forEach(function(el) { el.classList.remove('selected'); });
    this.cmdIndex += direction;
    if (this.cmdIndex < 0) this.cmdIndex = items.length - 1;
    if (this.cmdIndex >= items.length) this.cmdIndex = 0;
    items[this.cmdIndex].classList.add('selected');
    var url = items[this.cmdIndex].querySelector('.item-url');
    var title = items[this.cmdIndex].querySelector('.item-title');
    var val = (url ? url.textContent : '') || (title ? title.textContent : '');
    if (val) document.getElementById('url-input').value = val;
  }

  navigateTo(url) {
    var tm = window.__tabManager;
    if (tm) tm.navigateTab(tm.activeTabId, url);
  }

  /* ── Sidebar ─────────────────────────────── */
  setupSidebar() {
    var collapseBtn = document.getElementById('btn-sidebar-collapse');
    var sidebar = document.getElementById('tab-sidebar');
    var toggleBtn = document.getElementById('sidebar-toggle');
    var filter = document.getElementById('tab-filter');

    if (collapseBtn) {
      collapseBtn.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
      });
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function() {
        sidebar.classList.remove('collapsed');
      });
    }

    if (filter) {
      filter.addEventListener('input', function() {
        window.__orbital.filterTabList(filter.value);
      });
    }
  }

  filterTabList(query) {
    var q = query.toLowerCase().trim();
    var tabs = document.querySelectorAll('.tab');
    tabs.forEach(function(el) {
      var title = el.querySelector('.tab-title');
      var match = !q || (title && title.textContent.toLowerCase().indexOf(q) !== -1);
      el.style.display = match ? 'flex' : 'none';
    });
  }

  /* ── Window Controls ─────────────────────── */
  setupWindowControls() {
    var minBtn = document.getElementById('btn-minimize');
    var maxBtn = document.getElementById('btn-maximize');
    var closeBtn = document.getElementById('btn-close');
    if (minBtn) minBtn.addEventListener('click', function() { if (window.browserAPI) window.browserAPI.windowMinimize(); });
    if (maxBtn) maxBtn.addEventListener('click', function() { if (window.browserAPI) window.browserAPI.windowMaximize(); });
    if (closeBtn) closeBtn.addEventListener('click', function() { if (window.browserAPI) window.browserAPI.windowClose(); });
    if (window.browserAPI && window.browserAPI.onMaximizedChanged) {
      window.browserAPI.onMaximizedChanged(function(isMaximized) {
        if (!maxBtn) return;
        if (isMaximized) {
          maxBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="7" y="10" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M10 10V7a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-3" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>';
        } else {
          maxBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>';
        }
      });
    }
  }

  /* ── Bookmark Button ─────────────────────── */
  setupBookmarkButton() {
    var btn = document.getElementById('btn-bookmark');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var tm = window.__tabManager;
      if (!tm) return;
      var tab = tm.getActiveTab();
      if (!tab) return;
      var bm = window.__bookmarkManager;
      if (bm) bm.toggleBookmarkForCurrentTab(tab);
    });
  }

  /* ── Find Bar ────────────────────────────── */
  setupFindBar() {
    var findInput = document.getElementById('find-input');
    var findPrev = document.getElementById('find-prev');
    var findNext = document.getElementById('find-next');
    var findClose = document.getElementById('find-close');
    if (!findInput) return;

    var self = this;
    var doFind = function(forward) {
      var tm = window.__tabManager;
      if (!tm) return;
      var tab = tm.getActiveTab();
      if (tab && tab.webview && findInput.value) {
        tab.webview.findInPage(findInput.value, { forward: forward !== false, findNext: forward === true });
      }
    };

    findInput.addEventListener('input', function() { doFind(undefined); });
    findInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') doFind(true);
      if (e.key === 'Escape') self.hideFindBar();
    });
    if (findPrev) findPrev.addEventListener('click', function() { doFind(false); });
    if (findNext) findNext.addEventListener('click', function() { doFind(true); });
    if (findClose) findClose.addEventListener('click', function() { self.hideFindBar(); });

    var tm = window.__tabManager;
    if (tm) {
      tm.on('find-result', function(tabId, result) {
        var count = document.getElementById('find-count');
        if (count) count.textContent = result && result.matches > 0 ? result.activeMatchOrdinal + ' of ' + result.matches : 'No results';
      });
    }
  }

  showFindBar() {
    var bar = document.getElementById('find-bar');
    if (bar) {
      bar.classList.remove('hidden');
      var inp = document.getElementById('find-input');
      if (inp) { inp.value = ''; inp.focus(); }
    }
  }

  hideFindBar() {
    var bar = document.getElementById('find-bar');
    if (bar) bar.classList.add('hidden');
    var tm = window.__tabManager;
    if (!tm) return;
    var tab = tm.getActiveTab();
    if (tab && tab.webview) tab.webview.stopFindInPage('clearSelection');
    var count = document.getElementById('find-count');
    if (count) count.textContent = '';
  }

  /* ── Context Menus ────────────────────────── */
  setupContextMenu() {
    document.addEventListener('contextmenu', function(e) {
      var target = e.target;
      var inWebView = target.closest && target.closest('#webview-container');
      var onTab = target.closest && target.closest('.tab');
      if (onTab) return;
      var onToolbar = target.closest && target.closest('#titlebar');
      if (!inWebView && !onToolbar && target.tagName !== 'WEBVIEW') return;
    });
  }

  showPageContextMenu(x, y) {
    var tm = window.__tabManager;
    var menu = document.getElementById('context-menu');
    var container = document.getElementById('context-menu-items');
    if (!menu || !container) return;

    container.innerHTML = '';
    this.addContextItem(container, 'Back', false, function() { if (tm) tm.goBack(); }, !tm || !tm.getActiveTab() || !tm.getActiveTab().canGoBack);
    this.addContextItem(container, 'Forward', false, function() { if (tm) tm.goForward(); }, !tm || !tm.getActiveTab() || !tm.getActiveTab().canGoForward);
    this.addContextItem(container, 'Reload', false, function() { if (tm) tm.reloadTab(tm.activeTabId); });
    this.addContextSeparator(container);
    this.addContextItem(container, 'Save As...', false, function() { if (window.browserAPI) window.browserAPI.savePage(); });
    this.addContextItem(container, 'Print...', false, function() { if (window.browserAPI) window.browserAPI.printPage(); });
    this.addContextSeparator(container);
    this.addContextItem(container, 'Inspect Element', false, function() {
      var tab = tm && tm.getActiveTab();
      if (tab && tab.webview) tab.webview.openDevTools();
    });

    menu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 200) + 'px';
    menu.classList.remove('hidden');
  }

  setupTabContextMenu() {
    var self = this;
    var tm = window.__tabManager;
    if (tm) {
      tm.on('tab-contextmenu', function(tabId, x, y) { self.showTabContextMenu(tabId, x, y); });
    }
  }

  showTabContextMenu(tabId, x, y) {
    var tm = window.__tabManager;
    var menu = document.getElementById('context-menu');
    var container = document.getElementById('context-menu-items');
    if (!menu || !container) return;
    container.innerHTML = '';
    var self = this;
    var tabCount = tm.getAllTabs().length;

    this.addContextItem(container, 'New Tab', false, function() { if (tm) tm.createTab(); });
    this.addContextItem(container, 'Duplicate', false, function() { if (tm) tm.duplicateTab(tabId); });
    this.addContextItem(container, 'Reload', false, function() { if (tm) tm.reloadTab(tabId); });
    this.addContextItem(container, 'Mute Tab', false, function() { if (tm) tm.toggleMuteTab(tabId); });
    this.addContextSeparator(container);
    this.addContextItem(container, 'Close Tab', false, function() { if (tm) tm.closeTab(tabId); });
    this.addContextItem(container, 'Close Other Tabs', false, function() { if (tm) tm.closeOtherTabs(tabId); }, tabCount < 2);
    this.addContextItem(container, 'Close Tabs to the Right', false, function() { if (tm) tm.closeTabsToRight(tabId); }, tabCount < 2);
    this.addContextSeparator(container);
    this.addContextItem(container, 'Reopen Closed Tab', false, function() { if (tm) tm.restoreClosedTab(); }, !tm || tm.closedTabs.length === 0);

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.remove('hidden');
  }

  addContextItem(container, label, danger, action, disabled) {
    var el = document.createElement('div');
    el.className = 'context-menu-item' + (danger ? ' danger' : '') + (disabled ? ' disabled' : '');
    el.textContent = label;
    if (!disabled) {
      el.addEventListener('click', function() {
        action();
        var menu = document.getElementById('context-menu');
        if (menu) menu.classList.add('hidden');
      });
    }
    container.appendChild(el);
  }

  addContextSeparator(container) {
    var sep = document.createElement('div');
    sep.className = 'context-menu-separator';
    container.appendChild(sep);
  }

  closeMenus(e) {
    var ctxMenu = document.getElementById('context-menu');
    if (ctxMenu && !ctxMenu.classList.contains('hidden')) {
      if (!ctxMenu.contains(e.target)) ctxMenu.classList.add('hidden');
    }
  }

  /* ── Global Keys ───────────────────────────── */
  handleGlobalKeys(e) {
    if (e.key === 'Escape') {
      var ctx = document.getElementById('context-menu');
      if (ctx && !ctx.classList.contains('hidden')) ctx.classList.add('hidden');

      if (this.paletteOpen) {
        this.closePalette();
        return;
      }
    }

    var ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key === 'k') {
      e.preventDefault();
      this.openPalette();
      return;
    }
  }

  /* ── Tab Event Sync ────────────────────────── */
  setupTabEvents() {
    var tm = window.__tabManager;
    if (!tm) return;
    var self = this;
    tm.on('tab-activated', function(tabId) {
      var tab = tm.getActiveTab();
      if (tab) {
        tm.updateUrlBar(tab);
        tm.updateSecurityIndicator(tab);
        tm.updateBookmarkButton(tab);
        self.updateReloadIcon(tab.loading);
      }
    });
    tm.on('tab-navigated', function(tabId) {
      var activeTab = tm.getActiveTab();
      if (activeTab && activeTab.id === tabId) {
        tm.updateUrlBar(activeTab);
        tm.updateSecurityIndicator(activeTab);
        tm.updateBookmarkButton(activeTab);
      }
    });
  }
}

window.__orbital = new Orbital();
