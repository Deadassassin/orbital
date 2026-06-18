const { ipcMain, app, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const handlers = new Map();

function register(channel, handler) {
  handlers.set(channel, handler);
  ipcMain.handle(channel, async (event, data) => {
    try {
      return { ok: true, result: await handler(event, data) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

function setupIpcHandlers() {
  register('app:ready', () => ({ ready: true, version: app.getVersion() }));

  register('store:get', (_, key) => {
    const p = path.join(app.getPath('userData'), 'vexor-store.json');
    if (!fs.existsSync(p)) return null;
    const store = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return key ? store[key] : store;
  });

  register('store:set', (_, { key, value }) => {
    const p = path.join(app.getPath('userData'), 'vexor-store.json');
    let store = {};
    if (fs.existsSync(p)) store = JSON.parse(fs.readFileSync(p, 'utf-8'));
    store[key] = value;
    fs.writeFileSync(p, JSON.stringify(store), 'utf-8');
    return true;
  });

  register('store:delete', (_, key) => {
    const p = path.join(app.getPath('userData'), 'vexor-store.json');
    if (!fs.existsSync(p)) return;
    const store = JSON.parse(fs.readFileSync(p, 'utf-8'));
    delete store[key];
    fs.writeFileSync(p, JSON.stringify(store), 'utf-8');
  });

  register('crypto:getKey', () => {
    const p = path.join(app.getPath('userData'), 'vexor-key.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
    return null;
  });

  register('dialog:open', async (_, opts) => dialog.showOpenDialog(opts));
  register('dialog:save', async (_, opts) => dialog.showSaveDialog(opts));
  register('shell:openExternal', (_, url) => shell.openExternal(url));
  register('app:getVersion', () => app.getVersion());
  register('app:getPath', (_, name) => app.getPath(name));
}

function registerIpcHandler(channel, handler) {
  if (handlers.has(channel)) return;
  register(channel, handler);
}

module.exports = { setupIpcHandlers, registerIpcHandler };
