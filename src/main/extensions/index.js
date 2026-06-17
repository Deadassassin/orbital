const fs = require('fs');
const path = require('path');

class ExtensionManager {
  constructor(app, session) {
    this.app = app;
    this.session = session;
    this.extensions = new Map();
    this.loadedElectronExtensions = new Map();
    this.extensionDir = path.join(app.getPath('userData'), 'storage', 'extensions');
    this.ensureDir();
    this.loadExtensions();
  }

  ensureDir() {
    if (!fs.existsSync(this.extensionDir)) {
      fs.mkdirSync(this.extensionDir, { recursive: true });
    }
  }

  loadExtensions() {
    try {
      const manifestPath = path.join(this.extensionDir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        for (const [id, ext] of Object.entries(data)) {
          this.extensions.set(id, ext);
        }
      }
    } catch (e) {
      console.warn('Failed to load extensions manifest:', e.message);
    }
  }

  async loadEnabledExtensions() {
    const results = [];
    for (const ext of this.extensions.values()) {
      if (!ext.enabled) continue;
      results.push(await this.loadElectronExtension(ext));
    }
    return results;
  }

  saveExtensions() {
    try {
      const data = {};
      for (const [id, ext] of this.extensions) {
        data[id] = ext;
      }
      fs.writeFileSync(
        path.join(this.extensionDir, 'manifest.json'),
        JSON.stringify(data, null, 2)
      );
    } catch (e) {
      console.warn('Failed to save extensions:', e.message);
    }
  }

  getExtensions() {
    return Array.from(this.extensions.values());
  }

  getExtension(id) {
    return this.extensions.get(id) || null;
  }

  async installExtension(extPath) {
    try {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(extPath, 'manifest.json'), 'utf-8')
      );

      const extId = manifest.id || manifest.name?.toLowerCase().replace(/\s+/g, '-') || Date.now().toString(36);

      const ext = {
        id: extId,
        name: manifest.name || 'Unknown Extension',
        version: manifest.version || '1.0',
        description: manifest.description || '',
        manifestVersion: manifest.manifest_version || 3,
        path: extPath,
        enabled: true,
        permissions: manifest.permissions || [],
        hostPermissions: manifest.host_permissions || [],
        icons: manifest.icons || {},
        installedAt: Date.now(),
        hasAction: !!manifest.action,
        hasPopup: !!manifest.action?.default_popup,
        popupPath: manifest.action?.default_popup || null,
        hasBackground: !!manifest.background,
        backgroundScript: manifest.background?.service_worker || null,
        contentScripts: manifest.content_scripts || [],
      };

      this.extensions.set(extId, ext);
      this.saveExtensions();

      await this.loadElectronExtension(ext);

      return { success: true, extension: ext };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  uninstallExtension(id) {
    if (this.extensions.has(id)) {
      this.unloadElectronExtension(id);
      this.extensions.delete(id);
      this.saveExtensions();
      return true;
    }
    return false;
  }

  async toggleExtension(id) {
    const ext = this.extensions.get(id);
    if (ext) {
      ext.enabled = !ext.enabled;
      this.saveExtensions();
      if (ext.enabled) {
        await this.loadElectronExtension(ext);
      } else {
        this.unloadElectronExtension(id);
      }
    }
    return ext;
  }

  async loadElectronExtension(ext) {
    if (!ext.enabled) return { success: false, id: ext.id, error: 'Extension is disabled' };
    if (this.loadedElectronExtensions.has(ext.id)) {
      return { success: true, id: ext.id, alreadyLoaded: true };
    }

    try {
      var loadApi = this.session.extensions ? this.session.extensions : this.session;
      var loadFn = loadApi.loadExtension ? loadApi.loadExtension.bind(loadApi) : function(p, opts) { throw new Error('loadExtension not available'); };
      var loaded = await loadFn(ext.path, {
        allowFileAccess: true,
      });
      ext.electronId = loaded.id;
      ext.runtimeName = loaded.name;
      ext.loadError = null;
      this.loadedElectronExtensions.set(ext.id, loaded.id);
      this.saveExtensions();
      return { success: true, id: ext.id, electronId: loaded.id };
    } catch (e) {
      ext.loadError = e.message;
      this.saveExtensions();
      console.warn(`Failed to load extension ${ext.name}:`, e.message);
      return { success: false, id: ext.id, error: e.message };
    }
  }

  unloadElectronExtension(id) {
    var electronId = this.loadedElectronExtensions.get(id);
    if (!electronId) return;
    try {
      var removeApi = this.session.extensions ? this.session.extensions : this.session;
      if (removeApi.removeExtension) {
        removeApi.removeExtension(electronId);
      }
    } catch (e) {
      console.warn('Failed to unload extension ' + id + ': ' + e.message);
    }
    this.loadedElectronExtensions.delete(id);
  }

  registerContentScripts(ext) {
    if (!ext.enabled) return;

    for (const script of ext.contentScripts) {
      try {
        const matches = script.matches || [];
        const jsFiles = (script.js || []).map(f => path.join(ext.path, f));
        const cssFiles = (script.css || []).map(f => path.join(ext.path, f));

        for (const match of matches) {
          this.session.webRequest.onBeforeRequest(
            { urls: [match.replace('*', '.*')] },
            (details, callback) => {
              callback({ cancel: false });
            }
          );
        }
      } catch (e) {
        console.warn(`Failed to register content scripts for ${ext.name}:`, e.message);
      }
    }
  }

  executeBackgroundScripts(ext) {
    if (!ext.enabled || !ext.backgroundScript) return;
    try {
      const scriptPath = path.join(ext.path, ext.backgroundScript);
      if (fs.existsSync(scriptPath)) {
        const code = fs.readFileSync(scriptPath, 'utf-8');
        const sandbox = {
          chrome: this.createChromeAPI(ext),
          console: console,
          setTimeout: setTimeout,
          setInterval: setInterval,
          clearTimeout: clearTimeout,
          clearInterval: clearInterval,
          fetch: fetch,
          crypto: crypto,
        };
        const fn = new Function(...Object.keys(sandbox), code);
        fn(...Object.values(sandbox));
      }
    } catch (e) {
      console.warn(`Failed to execute background script for ${ext.name}:`, e.message);
    }
  }

  createChromeAPI(ext) {
    return {
      runtime: {
        id: ext.id,
        getManifest: () => ({
          name: ext.name,
          version: ext.version,
          description: ext.description,
          permissions: ext.permissions,
        }),
        sendMessage: (message) => {
          console.log(`Extension ${ext.name} sent message:`, message);
        },
        onMessage: {
          addListener: () => {},
          removeListener: () => {},
        },
        getURL: (p) => `extension://${ext.id}/${p}`,
      },
      storage: {
        local: {
          get: (keys) => Promise.resolve({}),
          set: (items) => Promise.resolve(),
          remove: (keys) => Promise.resolve(),
          clear: () => Promise.resolve(),
        },
        sync: {
          get: (keys) => Promise.resolve({}),
          set: (items) => Promise.resolve(),
          remove: (keys) => Promise.resolve(),
        },
      },
      tabs: {
        query: (info) => Promise.resolve([]),
        create: (props) => {
          const { createMainWindow } = require('../main');
          createMainWindow();
        },
        update: (tabId, props) => {},
        remove: (tabIds) => {},
      },
      action: {
        setBadgeText: (details) => {
          const { mainWindow } = require('../main');
          if (mainWindow) {
            mainWindow.webContents.send('extension-badge-update', {
              extensionId: ext.id,
              text: details.text || '',
            });
          }
        },
        setBadgeBackgroundColor: (details) => {},
        setTitle: (details) => {},
        setIcon: (details) => {},
      },
      notifications: {
        create: (id, options) => {
          const { Notification } = require('electron');
          new Notification({
            title: options.title || ext.name,
            body: options.message || options.body || '',
          }).show();
        },
        clear: (id) => {},
      },
    };
  }
}

module.exports = { ExtensionManager };
