class SettingsManager {
  constructor() {
    this.settings = {};
    this.privacy = {};
  }

  async load() {
    try {
      this.settings = await (window.browserAPI ? window.browserAPI.getSettings() : {}) || {};
      this.privacy = await (window.browserAPI ? window.browserAPI.getPrivacySettings() : {}) || {};
    } catch (e) {
      this.settings = {
        homepage: 'about:newtab',
        searchEngine: 'google',
        alwaysShowBookmarkBar: false,
        restoreLastSession: true,
      };
    }
    if (window.__browserState) {
      window.__browserState.settings = this.settings;
    }
  }

  async update(updates) {
    for (var key in updates) {
      if (updates.hasOwnProperty(key)) {
        this.settings[key] = updates[key];
      }
    }
    if (window.browserAPI) {
      try {
        await window.browserAPI.updateSettings(updates);
      } catch (e) {}
    }
    if (window.__browserState) {
      window.__browserState.settings = this.settings;
    }
    if ('alwaysShowBookmarkBar' in updates) {
      if (window.__bookmarkManager) window.__bookmarkManager.renderBookmarksBar();
    }
    if ('searchEngine' in updates) {
      var names = { google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo', brave: 'Brave Search', yahoo: 'Yahoo' };
      var name = names[updates.searchEngine] || updates.searchEngine;
      if (window.__app) window.__app.showNotification('Search engine: ' + name);
    }
  }
}

window.__settingsManager = new SettingsManager();