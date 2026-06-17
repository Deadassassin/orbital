const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__shadowPrivacy', {
  addNoise: true,
  blockTrackers: true,
});

try {
  const chromeVer = '136';
  const ua = navigator.userAgent;
  const platform = navigator.platform;

  if (typeof navigator.webdriver !== 'undefined') {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  }

  if (navigator.languages && navigator.languages.length === 0) {
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  }

  try {
    const originalQuery = Permissions.prototype.query;
    Permissions.prototype.query = async function (desc) {
      if (desc.name === 'window-placement') {
        return { state: 'prompt', onchange: null };
      }
      return originalQuery.call(this, desc);
    };
  } catch (e) {}

  try {
    const pluginData = [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
    ];
    if (navigator.plugins && navigator.plugins.length === 0) {
      const pluginArr = pluginData.map(p => {
        const plugin = {
          name: p.name,
          filename: p.filename,
          description: p.description,
          length: 0,
          item: () => null,
          namedItem: () => null,
          [Symbol.iterator]: function* () {},
        };
        return plugin;
      });
      pluginArr.length = pluginData.length;
      pluginArr.item = (i) => pluginArr[i] || null;
      pluginArr.namedItem = (n) => pluginArr.find(p => p.name === n) || null;
      Object.setPrototypeOf(pluginArr, PluginArray.prototype);
      Object.defineProperty(navigator, 'plugins', { get: () => pluginArr });
    }
  } catch (e) {}

  try {
    if (!navigator.userAgentData) {
      const uaData = {
        brands: [
          { brand: 'Google Chrome', version: chromeVer },
          { brand: 'Chromium', version: chromeVer },
          { brand: 'Not=A?Brand', version: '24' },
        ],
        mobile: false,
        platform: process.platform === 'win32' ? 'Windows' : 'Linux',
        getHighEntropyValues: (hints) => Promise.resolve({
          architecture: 'x86',
          bitness: '64',
          model: '',
          platform: process.platform === 'win32' ? 'Windows' : 'Linux',
          platformVersion: process.platform === 'win32' ? '10.0.0' : '',
          uaFullVersion: `${chromeVer}.0.0.0`,
          fullVersionList: [
            { brand: 'Google Chrome', version: chromeVer },
            { brand: 'Chromium', version: chromeVer },
            { brand: 'Not=A?Brand', version: '24' },
          ],
          wow64: false,
        }),
        toJSON: () => ({
          brands: [
            { brand: 'Google Chrome', version: chromeVer },
            { brand: 'Chromium', version: chromeVer },
            { brand: 'Not=A?Brand', version: '24' },
          ],
          mobile: false,
          platform: process.platform === 'win32' ? 'Windows' : 'Linux',
        }),
      };
      Object.defineProperty(navigator, 'userAgentData', { get: () => uaData });
    }
  } catch (e) {}

  try {
    if (!window.chrome || Object.keys(window.chrome).length === 0) {
      const chromeObj = {
        runtime: {
          id: 'shadow-browser-builtin',
          getManifest: () => ({ name: 'Orbital', version: '2.0.0' }),
          connect: () => ({ postMessage: () => {}, onMessage: { addListener: () => {} } }),
          sendMessage: (msg, cb) => { if (cb) cb(); },
        },
        app: {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        },
        csi: () => {},
        loadTimes: () => {},
        bookmarks: {},
        storage: {},
        tabs: {},
        windows: {},
      };
      window.chrome = chromeObj;
    }
  } catch (e) {}

  const originalToString = Function.prototype.toString;
  Function.prototype.toString = function () {
    if (this === Object.defineProperty.constructor) {
      return 'function defineProperty() { [native code] }';
    }
    return originalToString.apply(this, arguments);
  };
} catch (e) {}

try {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...args) {
    const ctx = originalGetContext.apply(this, args);
    if (ctx && args[0] === '2d') {
      const originalGetImageData = ctx.getImageData;
      ctx.getImageData = function (...args) {
        return originalGetImageData.apply(this, args);
      };

      const originalMeasureText = ctx.measureText;
      ctx.measureText = function (...args) {
        const metrics = originalMeasureText.apply(this, args);
        return {
          ...metrics,
          width: metrics.width + (Math.random() - 0.5) * 0.1,
          actualBoundingBoxAscent: metrics.actualBoundingBoxAscent + (Math.random() - 0.5) * 0.05,
          actualBoundingBoxDescent: metrics.actualBoundingBoxDescent + (Math.random() - 0.5) * 0.05,
        };
      };
    }
    return ctx;
  };
} catch (e) {}

try {
  const originalGetClientRects = Element.prototype.getClientRects;
  Element.prototype.getClientRects = function (...args) {
    const rects = originalGetClientRects.apply(this, args);
    if (rects.length > 0) {
      const rect = rects[0];
      return [{
        ...rect,
        x: rect.x + (Math.random() - 0.5) * 0.5,
        y: rect.y + (Math.random() - 0.5) * 0.5,
        width: rect.width + (Math.random() - 0.5) * 0.5,
        height: rect.height + (Math.random() - 0.5) * 0.5,
        top: rect.top + (Math.random() - 0.5) * 0.5,
        left: rect.left + (Math.random() - 0.5) * 0.5,
        right: rect.right + (Math.random() - 0.5) * 0.5,
        bottom: rect.bottom + (Math.random() - 0.5) * 0.5,
      }];
    }
    return rects;
  };
} catch (e) {}

try {
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (...args) {
    const rect = originalGetBoundingClientRect.apply(this, args);
    return {
      ...rect,
      x: rect.x + (Math.random() - 0.5) * 0.5,
      y: rect.y + (Math.random() - 0.5) * 0.5,
      width: rect.width + (Math.random() - 0.5) * 0.5,
      height: rect.height + (Math.random() - 0.5) * 0.5,
      top: rect.top + (Math.random() - 0.5) * 0.5,
      left: rect.left + (Math.random() - 0.5) * 0.5,
      right: rect.right + (Math.random() - 0.5) * 0.5,
      bottom: rect.bottom + (Math.random() - 0.5) * 0.5,
    };
  };
} catch (e) {}

try {
  const originalGetChannelData = AudioBuffer.prototype.getChannelData;
  AudioBuffer.prototype.getChannelData = function (channel) {
    const data = originalGetChannelData.call(this, channel);
    for (let i = 0; i < data.length; i++) {
      data[i] += (Math.random() - 0.5) * 0.0001;
    }
    return data;
  };
} catch (e) {}

try {
  if (navigator.mediaDevices?.enumerateDevices) {
    const originalEnumerate = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = async function () {
      const devices = await originalEnumerate();
      return devices.map(d => ({
        ...d,
        deviceId: d.deviceId ? d.deviceId.slice(0, 8) + '...' : d.deviceId,
        groupId: d.groupId ? d.groupId.slice(0, 8) + '...' : d.groupId,
      }));
    };
  }
} catch (e) {}
