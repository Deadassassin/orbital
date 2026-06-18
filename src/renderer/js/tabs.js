class TabManager {
  constructor() {
    this.tabs = new Map();
    this.activeTabId = null;
    this.tabIdCounter = 0;
    this.closedTabs = [];
    this.listeners = new Map();
    this.container = document.getElementById('tabs-list');
    this.webviewContainer = document.getElementById('webview-container');
  }

  createTab(url, options) {
    if (!options) options = {};
    var isNtp = !url || url === 'about:blank' || url === 'about:newtab';
    if (isNtp) url = 'about:newtab';

    var tabId = ++this.tabIdCounter;
    var tab = {
      id: tabId,
      url: url,
      title: 'New Tab',
      icon: null,
      loading: false,
      audible: false,
      muted: false,
      active: true,
      history: [url],
      historyIndex: 0,
      canGoBack: false,
      canGoForward: false,
      lastAccessed: Date.now(),
      pinned: false,
      element: null,
      webview: null,
    };

    this.createWebView(tab);
    this.createTabElement(tab);
    this.tabs.set(tabId, tab);

    if (tab.active) {
      this.activateTab(tabId);
    }

    var self = this;
    if (isNtp) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          self.loadNewTabPage(tab);
        });
      });
    } else {
      requestAnimationFrame(function() {
        self.navigateTab(tabId, url);
      });
    }

    this.emit('tab-created', tab);
    return tabId;
  }

  createWebView(tab) {
    var wv = document.createElement('webview');
    wv.setAttribute('allowpopups', '');
    var preload = window.__preloadPath;
    if (preload) {
      wv.setAttribute('preload', 'file:///' + preload.replace(/\\/g, '/'));
    }
    wv.style.width = '100%';
    wv.style.height = '100%';
    wv.style.position = 'absolute';
    wv.style.top = '0';
    wv.style.left = '0';
    wv.style.display = 'none';

    var self = this;
    wv.addEventListener('did-start-loading', function() {
      tab.loading = true;
      self.updateTabElement(tab.id);
      self.updateLoadingBar(true);
      self.emit('tab-loading', tab.id);
    });

    wv.addEventListener('did-stop-loading', function() {
      tab.loading = false;
      self.updateTabElement(tab.id);
      self.updateLoadingBar(false);
      self.emit('tab-stopped', tab.id);
    });

    wv.addEventListener('page-title-updated', function(e) {
      tab.title = e.title;
      self.updateTabElement(tab.id);
    });

    wv.addEventListener('page-favicon-updated', function(e) {
      if (e.favicons && e.favicons.length > 0) {
        tab.icon = e.favicons[0];
        self.updateTabElement(tab.id);
      }
    });

    wv.addEventListener('did-navigate', function(e) {
      tab.url = e.url;
      if (tab.history[tab.historyIndex] !== e.url) {
        tab.history = tab.history.slice(0, tab.historyIndex + 1);
        tab.history.push(e.url);
        tab.historyIndex = tab.history.length - 1;
      }
      try { tab.canGoBack = wv.canGoBack(); } catch(ex) {}
      try { tab.canGoForward = wv.canGoForward(); } catch(ex) {}
      self.updateTabElement(tab.id);
      self.updateNavigationState();
      self.emit('tab-navigated', tab.id, e.url);
      self.addToHistory(tab);
    });

    wv.addEventListener('did-navigate-in-page', function(e) {
      if (e.isMainFrame) {
        tab.url = e.url;
        try { tab.canGoBack = wv.canGoBack(); } catch(ex) {}
        try { tab.canGoForward = wv.canGoForward(); } catch(ex) {}
        self.updateNavigationState();
        self.emit('tab-navigated', tab.id, e.url);
      }
    });

    wv.addEventListener('media-started-playing', function() {
      tab.audible = true;
      self.updateTabElement(tab.id);
      self.emit('tab-audible', tab.id, true);
    });

    wv.addEventListener('media-paused', function() {
      tab.audible = false;
      self.updateTabElement(tab.id);
      self.emit('tab-audible', tab.id, false);
    });

    wv.addEventListener('found-in-page', function(e) {
      self.emit('find-result', tab.id, e.result);
    });

    wv.addEventListener('new-window', function(e) {
      e.preventDefault();
      self.createTab(e.url || '', { active: true });
    });

    wv.addEventListener('did-fail-load', function(e) {
      if (e.errorCode !== -3) {
        tab.loading = false;
        self.updateLoadingBar(false);
        var desc = e.errorDescription || 'Unknown error';
        tab.title = 'Failed to load';
        self.updateTabElement(tab.id);
        var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>';
        html += '*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:#0a0a0a;color:#e8e8e8;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center}';
        html += '.wrap{text-align:center;max-width:480px;padding:40px 24px}';
        html += '.code{font-size:64px;font-weight:200;color:#444;margin-bottom:12px}';
        html += 'h2{font-weight:400;font-size:20px;margin-bottom:8px}';
        html += 'p{color:#777;font-size:14px;margin-bottom:6px;line-height:1.5;word-break:break-all}';
        html += '.url{color:#555;font-size:12px;margin-bottom:20px}';
        html += '.btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}';
        html += '.btn{padding:10px 24px;border:1px solid #2a2a2a;border-radius:8px;background:#111;color:#e8e8e8;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none}';
        html += '.btn:hover{background:#1a1a1a}';
        html += '</style></head><body><div class="wrap">';
        html += '<div class="code">' + (e.errorCode || 'ERR') + '</div>';
        html += '<h2>' + desc.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') + '</h2>';
        html += '<p>Failed to load:</p>';
        html += '<p class="url">' + (e.validatedURL || tab.url || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') + '</p>';
        html += '<div class="btns">';
        html += '<a class="btn" href="javascript:window.location.reload()">Try Again</a>';
        html += '<a class="btn" href="about:newtab">New Tab</a>';
        html += '</div></div></body></html>';
        try { tab.webview.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(html); } catch(ex) {}
        self.emit('tab-stopped', tab.id);
      }
    });

    wv.addEventListener('ipc-message', function(e) {
      if (e.channel === 'mouse-back') {
        var tm = window.__tabManager;
        if (tm) tm.goBack();
      } else if (e.channel === 'mouse-forward') {
        var tm = window.__tabManager;
        if (tm) tm.goForward();
      }
    });

    wv.addEventListener('did-finish-load', function() {
      try { wv.executeJavaScript(
        'try{Object.defineProperty(navigator,"webdriver",{get:()=>undefined})}catch(e){}'
      ); } catch(e) {}
    });

    tab.webview = wv;
    this.webviewContainer.appendChild(wv);
  }

  createTabElement(tab) {
    var el = document.createElement('div');
    el.className = 'tab';
    el.dataset.tabId = tab.id;

    var audioBtn = document.createElement('span');
    audioBtn.className = 'tab-audio';
    audioBtn.title = 'Mute tab';
    audioBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      window.__tabManager.toggleMuteTab(tab.id);
    });

    var iconEl = document.createElement('span');
    iconEl.className = 'tab-icon';

    var titleEl = document.createElement('span');
    titleEl.className = 'tab-title';
    titleEl.textContent = tab.title;

    var closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      window.__tabManager.closeTab(tab.id);
    });

    el.appendChild(audioBtn);
    el.appendChild(iconEl);
    el.appendChild(titleEl);
    el.appendChild(closeBtn);

    el.addEventListener('click', function() {
      window.__tabManager.activateTab(tab.id);
    });

    el.addEventListener('mousedown', function(e) {
      if (e.button === 1) {
        e.preventDefault();
        window.__tabManager.closeTab(tab.id);
      }
    });

    el.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      window.__tabManager.emit('tab-contextmenu', tab.id, e.clientX, e.clientY);
    });

    tab.element = el;
    el.classList.add('entering');
    this.container.appendChild(el);
    el.addEventListener('animationend', function() {
      el.classList.remove('entering');
    }, { once: true });
  }

  updateTabElement(tabId) {
    var tab = this.tabs.get(tabId);
    if (!tab || !tab.element) return;

    tab.element.querySelector('.tab-title').textContent = tab.title || 'New Tab';

    var iconEl = tab.element.querySelector('.tab-icon');
    if (tab.loading && !tab.icon) {
      iconEl.className = 'tab-icon';
      iconEl.innerHTML = '<div class="tab-loading-spinner"></div>';
    } else if (tab.icon) {
      iconEl.className = 'tab-icon';
      iconEl.innerHTML = '';
      iconEl.style.backgroundImage = 'url(' + tab.icon + ')';
    } else {
      iconEl.className = 'tab-icon';
      iconEl.innerHTML = '';
      iconEl.style.backgroundImage = '';
    }

    var audioBtn = tab.element.querySelector('.tab-audio');
    audioBtn.style.display = tab.audible ? 'flex' : 'none';
    audioBtn.innerHTML = tab.muted
      ? '<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
      : '<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';

    tab.element.classList.toggle('active', tab.active);
  }

  activateTab(tabId) {
    var tab = this.tabs.get(tabId);
    if (!tab) return;
    if (this.activeTabId === tabId && tab.active) return;

    var prevId = this.activeTabId;
    if (prevId !== null) {
      var prev = this.tabs.get(prevId);
      if (prev) {
        prev.active = false;
        if (prev.webview) prev.webview.style.display = 'none';
        this.updateTabElement(prevId);
      }
    }

    tab.active = true;
    tab.lastAccessed = Date.now();
    if (tab.webview) {
      tab.webview.style.display = 'flex';
      tab.webview.classList.remove('fade-in');
      void tab.webview.offsetWidth;
      tab.webview.classList.add('fade-in');
    }
    this.activeTabId = tabId;
    this.updateTabElement(tabId);

    this.updateNavigationState();
    this.updateUrlBar(tab);
    this.updateSecurityIndicator(tab);
    this.updateBookmarkButton(tab);

    if (tab.element) {
      tab.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    this.emit('tab-activated', tabId);
  }

  closeTab(tabId) {
    var tab = this.tabs.get(tabId);
    if (!tab) return;

    if (tab.url && !tab.url.startsWith('about:') && tab.url !== '') {
      this.closedTabs.unshift({ url: tab.url, title: tab.title, icon: tab.icon, closedAt: Date.now() });
      if (this.closedTabs.length > 25) this.closedTabs.pop();
    }

    var self = this;
    var reallyRemove = function() {
      if (tab.webview && tab.webview.parentNode) tab.webview.parentNode.removeChild(tab.webview);
      if (tab.element && tab.element.parentNode) tab.element.parentNode.removeChild(tab.element);
      self.tabs.delete(tabId);

      if (self.activeTabId === tabId) {
        self.activeTabId = null;
        var remaining = Array.from(self.tabs.values());
        if (remaining.length > 0) {
          self.activateTab(remaining[remaining.length - 1].id);
        } else {
          self.createTab('about:newtab');
        }
      }
      self.emit('tab-closed', tabId);
    };

    if (tab.element) {
      tab.element.classList.add('closing');
      tab.element.addEventListener('animationend', function() { reallyRemove(); }, { once: true });
    } else {
      reallyRemove();
    }
  }

  closeOtherTabs(tabId) {
    var self = this;
    Array.from(this.tabs.entries()).forEach(function(e) {
      if (e[0] !== tabId) self.closeTab(e[0]);
    });
  }

  closeTabsToRight(tabId) {
    var found = false;
    var self = this;
    Array.from(this.tabs.entries()).forEach(function(e) {
      if (e[0] === tabId) { found = true; return; }
      if (found) self.closeTab(e[0]);
    });
  }

  duplicateTab(tabId) {
    var tab = this.tabs.get(tabId);
    if (tab) this.createTab(tab.url, { active: true });
  }

  reloadTab(tabId) {
    var id = tabId || this.activeTabId;
    var tab = this.tabs.get(id);
    if (tab && tab.webview) tab.webview.reload();
  }

  forceReloadTab(tabId) {
    var id = tabId || this.activeTabId;
    var tab = this.tabs.get(id);
    if (tab && tab.webview) tab.webview.reloadIgnoringCache();
  }

  stopTab(tabId) {
    var id = tabId || this.activeTabId;
    var tab = this.tabs.get(id);
    if (tab && tab.webview) tab.webview.stop();
  }

  navigateTab(tabId, url) {
    var tab = this.tabs.get(tabId);
    if (!tab || !url) return;

    if (url === 'about:newtab') {
      this.loadNewTabPage(tab);
      return;
    }

    if (url.startsWith('about:')) {
      this.loadInternalPage(tab, url);
      return;
    }

    var fullUrl = url;
    if (!url.match(/^[a-zA-Z]+:\/\//) && !url.startsWith('file://') && !url.startsWith('blob:') && !url.startsWith('data:')) {
      if (url.indexOf('.') !== -1 && url.indexOf(' ') === -1) {
        fullUrl = 'https://' + url;
      } else {
        var settings = window.__browserState ? window.__browserState.settings : null;
        var engine = settings ? settings.searchEngine : 'google';
        var searchUrls = {
          google: 'https://www.google.com/search?q=',
          bing: 'https://www.bing.com/search?q=',
          duckduckgo: 'https://duckduckgo.com/?q=',
          brave: 'https://search.brave.com/search?q=',
          yahoo: 'https://search.yahoo.com/search?p=',
        };
        fullUrl = (searchUrls[engine] || searchUrls.google) + encodeURIComponent(url);
      }
    }

    tab.webview.loadURL(fullUrl);
    tab.url = fullUrl;
    tab.loading = true;
    this.updateTabElement(tabId);
  }

  goBack() {
    var tab = this.tabs.get(this.activeTabId);
    if (tab && tab.webview && tab.canGoBack) tab.webview.goBack();
  }

  goForward() {
    var tab = this.tabs.get(this.activeTabId);
    if (tab && tab.webview && tab.canGoForward) tab.webview.goForward();
  }

  toggleMuteTab(tabId) {
    var tab = this.tabs.get(tabId);
    if (tab && tab.webview) {
      tab.muted = !tab.muted;
      tab.webview.setAudioMuted(tab.muted);
      this.updateTabElement(tabId);
    }
  }

  pinTab(tabId) {
    var tab = this.tabs.get(tabId);
    if (tab) {
      tab.pinned = !tab.pinned;
      this.updateTabElement(tabId);
    }
  }

  moveTab(tabId, newIndex) {
    var tab = this.tabs.get(tabId);
    if (!tab || !tab.element) return;
    var tabs = Array.from(this.container.children);
    var curIdx = tabs.indexOf(tab.element);
    if (curIdx === newIndex) return;
    var target = tabs[newIndex];
    if (target) this.container.insertBefore(tab.element, target);
    else this.container.appendChild(tab.element);
  }

  getActiveTab() {
    return this.tabs.get(this.activeTabId);
  }

  getAllTabs() {
    return Array.from(this.tabs.values());
  }

  getTabsByFilter(query) {
    if (!query) return this.getAllTabs();
    var q = query.toLowerCase();
    return this.getAllTabs().filter(function(t) {
      return (t.title && t.title.toLowerCase().indexOf(q) !== -1) ||
             (t.url && t.url.toLowerCase().indexOf(q) !== -1);
    });
  }

  getRecentlyClosedTabs() {
    return this.closedTabs;
  }

  restoreClosedTab() {
    var info = this.closedTabs.shift();
    if (info) this.createTab(info.url, { active: true });
  }

  updateNavigationState() {
    var tab = this.tabs.get(this.activeTabId);
    var backBtn = document.getElementById('nav-back');
    var forwardBtn = document.getElementById('nav-forward');
    if (backBtn) backBtn.disabled = !(tab && tab.canGoBack);
    if (forwardBtn) forwardBtn.disabled = !(tab && tab.canGoForward);
  }

  updateUrlBar(tab) {
    var input = document.getElementById('url-input');
    if (!input) return;
    if (tab && tab.url && tab.url.indexOf('about:') !== 0) {
      input.value = tab.url;
    } else {
      input.value = '';
    }
  }

  updateSecurityIndicator(tab) {
    var indicator = document.getElementById('security-indicator');
    if (!indicator) return;
    if (!tab || !tab.url || tab.url.indexOf('about:') === 0) {
      indicator.innerHTML = '';
      indicator.className = '';
      indicator.title = '';
      return;
    }
    try {
      var url = new URL(tab.url);
      if (url.protocol === 'https:') {
        indicator.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
        indicator.className = 'secure';
        indicator.title = 'Secure connection';
      } else if (url.protocol === 'http:') {
        indicator.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        indicator.className = 'insecure';
        indicator.title = 'Not secure';
      } else {
        indicator.innerHTML = '';
        indicator.className = '';
        indicator.title = '';
      }
    } catch(e) {
      indicator.innerHTML = '';
      indicator.className = '';
      indicator.title = '';
    }
  }

  updateLoadingBar(loading) {
    var bar = document.getElementById('loading-bar');
    var inner = document.getElementById('loading-bar-inner');
    if (!bar || !inner) return;
    if (loading) {
      bar.classList.remove('hidden', 'complete');
      inner.style.width = '30%';
      requestAnimationFrame(function() { inner.style.width = '70%'; });
    } else {
      inner.style.width = '100%';
      bar.classList.add('complete');
      setTimeout(function() { bar.classList.add('hidden'); inner.style.width = '0%'; bar.classList.remove('complete'); }, 400);
    }
  }

  updateBookmarkButton(tab) {
    var btn = document.getElementById('btn-bookmark');
    if (!btn) return;
    var bm = window.__bookmarkManager ? window.__bookmarkManager.isBookmarked(tab && tab.url) : null;
    btn.innerHTML = bm ? Icons.bookmarkFilled : Icons.bookmark;
    btn.classList.toggle('bookmarked', !!bm);
  }

  addToHistory(tab) {
    if (window.browserAPI && tab.url && tab.url.indexOf('about:') !== 0) {
      window.browserAPI.addHistory({ url: tab.url, title: tab.title });
    }
  }

  loadNewTabPage(tab) {
    try { tab.webview.stop(); } catch(e) {}
    tab.url = 'about:newtab';
    tab.title = 'New Tab';
    tab.icon = '';
    tab.loading = false;
    this.updateTabElement(tab.id);
    this.updateUrlBar(tab);
    this.updateSecurityIndicator(tab);

    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>';
    html += '*{margin:0;padding:0;box-sizing:border-box}';
    html += 'html,body{width:100%;height:100%;overflow:hidden;background:#0a0a0a;color:#e8e8e8;font-family:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif}';
    html += 'body{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px}';
    html += '.hero{text-align:center;max-width:640px;width:100%}';
    html += '.logo{margin-bottom:20px;opacity:.6}';
    html += '.logo svg{width:40px;height:40px;stroke:#e8e8e8;fill:none;stroke-width:1.5}';
    html += 'h1{font-weight:300;font-size:22px;letter-spacing:.5px;margin-bottom:24px;color:#e8e8e8}';
    html += '.searchbox{width:100%;position:relative}';
    html += '#ntp-search{width:100%;padding:14px 18px;background:#111;border:1px solid #2a2a2a;border-radius:12px;color:#e8e8e8;font-size:15px;outline:none;transition:border-color .2s}';
    html += '#ntp-search:focus{border-color:#555}';
    html += '#ntp-search::placeholder{color:#555}';
    html += '.shortcuts{width:100%;display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:12px;margin-top:28px}';
    html += '.sc{height:90px;background:#111;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:4px;border:1px solid #1e1e1e;transition:all .15s}';
    html += '.sc:hover{background:#181818;border-color:#333}';
    html += '.sc-label{font-size:11px;color:#777}';
    html += '.sc-icon{font-size:20px;color:#999;font-weight:500}';
    html += '</style></head><body>';
    html += '<div class="hero">';
    html += '<div class="logo"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><ellipse cx="12" cy="12" rx="8" ry="3" transform="rotate(-30 12 12)"/><ellipse cx="12" cy="12" rx="8" ry="3" transform="rotate(30 12 12)"/><circle cx="12" cy="12" r="2"/></svg></div>';
    html += '<h1>Orbital</h1>';
    html += '<div class="searchbox"><input type="text" id="ntp-search" placeholder="Search or enter address..."></div>';
    html += '<div class="shortcuts">';
    html += '<div class="sc" data-url="https://www.google.com"><span class="sc-icon">G</span><span class="sc-label">Google</span></div>';
    html += '<div class="sc" data-url="https://www.github.com"><span class="sc-icon">gH</span><span class="sc-label">GitHub</span></div>';
    html += '<div class="sc" data-url="https://www.reddit.com"><span class="sc-icon">r/</span><span class="sc-label">Reddit</span></div>';
    html += '<div class="sc" data-url="https://www.wikipedia.org"><span class="sc-icon">W</span><span class="sc-label">Wikipedia</span></div>';
    html += '<div class="sc" data-url="https://www.youtube.com"><span class="sc-icon">YT</span><span class="sc-label">YouTube</span></div>';
    html += '</div></div><script>';
    html += 'setTimeout(function(){';
    html += 'var inp=document.getElementById("ntp-search");';
    html += 'if(inp){inp.addEventListener("keydown",function(e){if(e.key==="Enter"&&window.browserAPI&&window.browserAPI.navigateTo)window.browserAPI.navigateTo(inp.value)});inp.focus();}';
    html += 'var scs=document.querySelectorAll(".sc");';
    html += 'for(var i=0;i<scs.length;i++){scs[i].addEventListener("click",function(){var u=this.getAttribute("data-url");if(window.browserAPI&&window.browserAPI.navigateTo)window.browserAPI.navigateTo(u)})}';
    html += '},100);';
    html += '<' + '/script></body></html>';

    var dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    try { tab.webview.src = dataUrl; } catch(e) {
      try { tab.webview.loadURL(dataUrl); } catch(e2) {
        try { tab.webview.src = 'about:blank'; } catch(e3) {}
      }
    }
  }

  loadInternalPage(tab, url) {
    var page = url.replace('about:', '');
    try { tab.webview.stop(); } catch(e) {}
    tab.url = url;
    tab.title = page.charAt(0).toUpperCase() + page.slice(1);
    this.updateTabElement(tab.id);
    this.updateUrlBar(tab);
    this.updateSecurityIndicator(tab);

    var fallbackHtml = '<html><body style="background:#0a0a0a;color:#e8e8e8;display:flex;align-items:center;justify-content:center;font-family:sans-serif;height:100vh;"><h1>' + page + '</h1></body></html>';
    var self = this;
    var loadFallback = function() {
      try { tab.webview.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(fallbackHtml); } catch(e) { tab.webview.src = 'about:blank'; }
    };
    var validPages = ['settings', 'bookmarks', 'history', 'downloads', 'extensions', 'about', 'flags', 'error'];
    if (validPages.indexOf(page) !== -1) {
      window.browserAPI.invoke('get-internal-page', page).then(function(html) {
        if (html) {
          try { tab.webview.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(html); } catch(e) { loadFallback(); }
        } else { loadFallback(); }
      }).catch(function() { loadFallback(); });
    } else { loadFallback(); }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
  }

  emit(event) {
    var handlers = this.listeners.get(event) || [];
    var args = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < handlers.length; i++) {
      try { handlers[i].apply(null, args); } catch(e) { console.error('Event handler error:', e); }
    }
  }
}

window.__tabManager = new TabManager();
