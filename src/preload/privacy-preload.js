try {
  const chromeVer = '136';
  const platName = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';

  if (typeof navigator.webdriver !== 'undefined') {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  }

  if (navigator.languages && navigator.languages.length === 0) {
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  }

  try {
    const pluginData = [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
      { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
    ];
    if (navigator.plugins && navigator.plugins.length === 0) {
      const pluginArr = pluginData.map(p => ({
        name: p.name,
        filename: p.filename,
        description: p.description,
        length: 0,
        item: () => null,
        namedItem: () => null,
        [Symbol.iterator]: function* () {},
      }));
      pluginArr.length = pluginData.length;
      pluginArr.item = (i) => pluginArr[i] || null;
      pluginArr.namedItem = (n) => pluginArr.find(p => p.name === n) || null;
      Object.setPrototypeOf(pluginArr, PluginArray.prototype);
      Object.defineProperty(navigator, 'plugins', { get: () => pluginArr });
    }
  } catch (e) {}

  try {
    if (!navigator.userAgentData) {
      const arch = navigator.platform.toLowerCase().includes('arm') ? 'arm' : 'x86';
      const bitness = navigator.platform.toLowerCase().includes('win64') || navigator.platform.toLowerCase().includes('x64') || navigator.platform.toLowerCase().includes('linux x86_64') ? '64' : '32';
      const platVer = process.platform === 'win32' ? '10.0.0' : '';
      const uaData = {
        brands: [
          { brand: 'Google Chrome', version: chromeVer },
          { brand: 'Chromium', version: chromeVer },
          { brand: 'Not=A?Brand', version: '24' },
        ],
        mobile: false,
        platform: platName,
        getHighEntropyValues: (hints) => Promise.resolve({
          architecture: arch,
          bitness: bitness,
          model: '',
          platform: platName,
          platformVersion: platVer,
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
          platform: platName,
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
          getManifest: () => ({ name: 'Orbital', version: '1.1.8' }),
          getURL: (p) => p,
          connect: () => ({ postMessage: () => {}, onMessage: { addListener: () => {} } }),
          sendMessage: (msg, cb) => { if (cb) cb(); },
          onMessage: { addListener: () => {}, removeListener: () => {} },
          onConnect: { addListener: () => {}, removeListener: () => {} },
          lastError: undefined,
        },
        app: {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
          getDetails: () => ({}),
          getIsInstalled: () => false,
        },
        webstore: {
          onInstallStageChanged: { addListener: () => {} },
          onDownloadProgress: { addListener: () => {} },
        },
        csi: () => ({}),
        loadTimes: () => ({}),
        bookmarks: {},
        storage: { local: {} },
        tabs: { query: () => Promise.resolve([]) },
        windows: { getCurrent: () => Promise.resolve({}) },
        extension: {
          getURL: (p) => p,
          inIncognitoContext: false,
        },
        i18n: {
          getMessage: () => '',
        },
      };
      window.chrome = chromeObj;
    }
  } catch (e) {}
} catch (e) {}

try {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (...args) {
    const ctx = originalGetContext.apply(this, args);
    return ctx;
  };
} catch (e) {}
