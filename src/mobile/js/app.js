class App {
  constructor() {
    this.initialized = false;
    this.notificationTimeout = null;
    this.tabSwitcherOpen = false;
  }

  async init() {
    if (this.initialized) return;

    window.__browserState = {};

    try {
      var state = await (window.browserAPI ? window.browserAPI.getInitialState() : null);
      if (state) {
        window.__browserState = state;
        window.__preloadPath = state.preloadPath;
      }
    } catch (e) {
      console.warn('Failed to get initial state:', e);
    }

    if (!window.__browserState.settings) {
      window.__browserState.settings = {
        homepage: 'about:newtab',
        searchEngine: 'google',
        alwaysShowBookmarkBar: false,
        restoreLastSession: true,
      };
    }

    try {
      if (window.__settingsManager) await window.__settingsManager.load();
      if (window.__bookmarkManager) await window.__bookmarkManager.load();
      if (window.__historyManager) await window.__historyManager.load();
    } catch (e) {}

    this.setupIPCListeners();
    this.setupMouseButtons();
    this.setupKeyboardShortcuts();
    this.setupExtensionButton();

    var tm = window.__tabManager;
    if (tm) {
      tm.createTab();
    }

    if (window.__bookmarkManager) {
      window.__bookmarkManager.renderBookmarksBar();
    }

    this.initialized = true;
    console.log('Orbital initialized');

    if (state && state.isPrivateMode) {
      this.showNotification('Private browsing mode active');
    }
  }

  setupIPCListeners() {
    var self = this;
    var api = window.browserAPI;
    if (!api) return;

    api.onNavigate(function(url) {
      var tm = window.__tabManager;
      if (tm) tm.navigateTab(tm.activeTabId, url);
    });

    api.onNewTab(function() {
      window.__tabManager && window.__tabManager.createTab();
    });

    if (api.onNewTabUrl) {
      api.onNewTabUrl(function(url) {
        window.__tabManager && window.__tabManager.createTab(url, { active: true });
      });
    }

    if (api.onCloseTab) {
      api.onCloseTab(function() {
        var tm = window.__tabManager;
        if (tm) tm.closeTab(tm.activeTabId);
      });
    }

    if (api.onFocusUrlBar) {
      api.onFocusUrlBar(function() {
        window.__orbital && window.__orbital.openPalette();
      });
    }

    api.onReloadTab(function() {
      window.__tabManager && window.__tabManager.reloadTab(window.__tabManager.activeTabId);
    });

    api.onForceReloadTab(function() {
      window.__tabManager && window.__tabManager.forceReloadTab(window.__tabManager.activeTabId);
    });

    api.onStopLoad(function() {
      window.__tabManager && window.__tabManager.stopTab(window.__tabManager.activeTabId);
    });

    api.onToggleBookmarkBar(function(show) {
      window.__browserState.settings.alwaysShowBookmarkBar = show;
      if (window.__bookmarkManager) window.__bookmarkManager.renderBookmarksBar();
    });

    api.onBookmarkCurrent(function() {
      var tm = window.__tabManager;
      if (!tm) return;
      var tab = tm.getActiveTab();
      if (tab && window.__bookmarkManager) window.__bookmarkManager.toggleBookmarkForCurrentTab(tab);
    });

    api.onFindInPage(function() {
      if (window.__orbital) window.__orbital.showFindBar();
    });

    api.onSavePage(function() { api.savePage(); });
    api.onPrintPage(function() { api.printPage(); });

    api.onExtensionBadgeUpdate(function(data) {
      var btn = document.getElementById('btn-extensions');
      if (!btn || !data.text) return;
      var badge = btn.querySelector('.extension-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'extension-badge';
        btn.style.position = 'relative';
        btn.appendChild(badge);
      }
      badge.textContent = data.text;
    });
  }

  setupMouseButtons() {
    document.addEventListener('mouseup', function(e) {
      if (e.button === 3) {
        e.preventDefault();
        var tm = window.__tabManager;
        if (tm) tm.goBack();
      } else if (e.button === 4) {
        e.preventDefault();
        var tm = window.__tabManager;
        if (tm) tm.goForward();
      }
    });
  }

  setupKeyboardShortcuts() {
    var self = this;
    document.addEventListener('keydown', function(e) {
      var ctrl = e.ctrlKey || e.metaKey;
      var tm = window.__tabManager;

      if (ctrl && e.key === 't') {
        e.preventDefault();
        tm && tm.createTab();
      } else if (ctrl && e.key === 'w') {
        e.preventDefault();
        tm && tm.closeTab(tm.activeTabId);
      } else if (ctrl && e.shiftKey && e.key === 't') {
        e.preventDefault();
        if (tm) { var closed = tm.getRecentlyClosedTabs(); if (closed.length > 0) tm.restoreClosedTab(); }
      } else if (e.key === 'Escape' && self.tabSwitcherOpen) {
        e.preventDefault();
        self.closeTabSwitcher();
      } else if (e.key === 'Enter' && self.tabSwitcherOpen) {
        e.preventDefault();
        self.commitTabSwitcher();
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && self.tabSwitcherOpen) {
        e.preventDefault();
        self.moveTabSwitcherSelection(1);
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') && self.tabSwitcherOpen) {
        e.preventDefault();
        self.moveTabSwitcherSelection(-1);
      } else if (ctrl && e.key === 'Tab') {
        e.preventDefault();
        if (self.tabSwitcherOpen) {
          self.moveTabSwitcherSelection(e.shiftKey ? -1 : 1);
        } else {
          self.openTabSwitcher(e.shiftKey ? -1 : 1);
        }
      } else if (ctrl && e.key === 'l') {
        e.preventDefault();
        if (window.__orbital) window.__orbital.openPalette();
      } else if (ctrl && e.key === 'd') {
        e.preventDefault();
        var tab = tm && tm.getActiveTab();
        if (tab && window.__bookmarkManager) window.__bookmarkManager.toggleBookmarkForCurrentTab(tab);
      } else if (ctrl && e.key === '=') {
        e.preventDefault();
        var tab2 = tm && tm.getActiveTab();
        if (tab2 && tab2.webview) { tab2.zoomLevel = (tab2.zoomLevel || 0) + 0.5; tab2.webview.setZoomLevel(tab2.zoomLevel); }
      } else if (ctrl && e.key === '-') {
        e.preventDefault();
        var tab3 = tm && tm.getActiveTab();
        if (tab3 && tab3.webview) { tab3.zoomLevel = (tab3.zoomLevel || 0) - 0.5; tab3.webview.setZoomLevel(tab3.zoomLevel); }
      } else if (ctrl && e.key === '0') {
        e.preventDefault();
        var tab4 = tm && tm.getActiveTab();
        if (tab4 && tab4.webview) { tab4.zoomLevel = 0; tab4.webview.setZoomLevel(0); }
      } else if (ctrl && e.shiftKey && e.key === 'n') {
        e.preventDefault();
        window.browserAPI && window.browserAPI.newPrivateWindow && window.browserAPI.newPrivateWindow();
      }
    });
  }

  /* ── Tab Switcher ─────────────────────────── */
  openTabSwitcher(direction) {
    var tm = window.__tabManager;
    if (!tm) return;
    var tabs = tm.getAllTabs();
    if (tabs.length < 2) return;
    this.tabSwitcherOpen = true;
    this.tabSwitcherDirection = direction || 1;
    this.renderTabSwitcher(tabs);
    var overlay = document.getElementById('tab-switcher');
    if (overlay) overlay.classList.remove('hidden');
  }

  closeTabSwitcher() {
    this.tabSwitcherOpen = false;
    var overlay = document.getElementById('tab-switcher');
    if (overlay) overlay.classList.add('hidden');
  }

  commitTabSwitcher() {
    var sel = document.querySelector('.ts-card.active');
    if (!sel) { this.closeTabSwitcher(); return; }
    var tabId = parseInt(sel.dataset.tabId);
    var tm = window.__tabManager;
    if (tm) tm.activateTab(tabId);
    this.closeTabSwitcher();
  }

  moveTabSwitcherSelection(direction) {
    var cards = document.querySelectorAll('.ts-card');
    if (cards.length === 0) return;
    var curIdx = -1;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].classList.contains('active')) { curIdx = i; break; }
    }
    cards[curIdx >= 0 ? curIdx : 0].classList.remove('active');
    var nextIdx = ((curIdx < 0 ? -1 : curIdx) + direction + cards.length) % cards.length;
    cards[nextIdx].classList.add('active');
    cards[nextIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  renderTabSwitcher(tabs) {
    var grid = document.getElementById('tab-switcher-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var self = this;
    tabs.forEach(function(tab) {
      var card = document.createElement('div');
      card.className = 'ts-card' + (tab.active ? ' active' : '');
      card.dataset.tabId = tab.id;

      var favicon = document.createElement('div');
      favicon.className = 'ts-favicon' + (tab.icon ? '' : ' fallback');
      if (tab.icon) {
        favicon.style.backgroundImage = 'url("' + tab.icon + '")';
      } else {
        favicon.textContent = (tab.title || '?')[0].toUpperCase();
      }

      var title = document.createElement('div');
      title.className = 'ts-title';
      title.textContent = tab.title || 'New Tab';

      card.appendChild(favicon);
      card.appendChild(title);
      card.addEventListener('click', function() {
        var tm = window.__tabManager;
        if (tm) tm.activateTab(tab.id);
        self.closeTabSwitcher();
      });
      grid.appendChild(card);
    });
    // scroll active into view
    var active = grid.querySelector('.ts-card.active');
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  setupExtensionButton() {
    var btn = document.getElementById('btn-extensions');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var tm = window.__tabManager;
      if (tm) tm.navigateTab(tm.activeTabId, 'about:extensions');
    });
  }

  showNotification(message, type) {
    type = type || 'info';
    var el = document.getElementById('download-notification');
    if (!el) return;
    if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
    var iconMap = { info: Icons.info, success: Icons.check, warning: Icons.search, error: Icons.close };
    var colorMap = { info: '#e8e8e8', success: '#22c55e', warning: '#eab308', error: '#ef4444' };
    var iconEl = el.querySelector('.notif-icon');
    if (iconEl) { iconEl.innerHTML = iconMap[type] || Icons.info; iconEl.style.color = colorMap[type] || '#e8e8e8'; }
    var titleEl = el.querySelector('.notif-title');
    if (titleEl) titleEl.textContent = message;
    var bodyEl = el.querySelector('.notif-body');
    if (bodyEl) bodyEl.textContent = '';
    el.classList.remove('hidden');
    el.style.borderLeft = '3px solid ' + (colorMap[type] || '#e8e8e8');
    var self = this;
    this.notificationTimeout = setTimeout(function() { el.classList.add('hidden'); }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  window.__app = new App();
  window.__app.init();
});
