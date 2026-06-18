const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_CHANNELS = [
  'app:ready', 'store:get', 'store:set', 'store:delete',
  'crypto:getKey', 'dialog:open', 'dialog:save',
  'shell:openExternal', 'app:getVersion', 'app:getPath',
];

function validateChannel(channel) {
  if (!ALLOWED_CHANNELS.includes(channel)) {
    throw new Error(`VEXOR Bridge: blocked channel "${channel}"`);
  }
  return true;
}

contextBridge.exposeInMainWorld('vexorBridge', {
  send: (channel, data) => {
    validateChannel(channel);
    const safe = JSON.parse(JSON.stringify(data || null));
    ipcRenderer.send(channel, safe);
  },

  invoke: async (channel, data) => {
    validateChannel(channel);
    const safe = JSON.parse(JSON.stringify(data || null));
    return ipcRenderer.invoke(channel, safe);
  },

  onMessage: (channel, callback) => {
    validateChannel(channel);
    const handler = (_, data) => callback(JSON.parse(JSON.stringify(data)));
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },

  removeAll: (channel) => {
    if (channel && ALLOWED_CHANNELS.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
});
