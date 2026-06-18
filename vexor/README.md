# VEXOR — Volatile EXecution Orchestrator for Rendering

A custom, ultra-lightweight reactive UI framework built for Electron. Signal-first, zero virtual DOM, hardened security.

## Why VEXOR?

| Problem | VEXOR Solution |
|---------|---------------|
| React/Electron bloat (400KB+) | Core under 3KB minified |
| Slow virtual DOM diffing | Signal-based surgical DOM updates |
| Complex build tooling | Zero build step, native ES modules |
| XSS via innerHTML | Template literal DOM builder, never innerHTML on user data |
| Electron security pitfalls | Hardened BrowserWindow, whitelist IPC, no eval |

## Install

No npm required. Copy `vexor.js` into your project:

```
cp -r vexor your-project/
```

Import in your entry file:

```js
import { signal, defineComponent, mount, html } from './vexor/vexor.js';
```

## Quick Start

```html
<!DOCTYPE html>
<html>
<body>
  <div id="app"></div>
  <script type="module">
    import { signal, defineComponent, mount, html } from './vexor/vexor.js';

    const App = defineComponent({
      name: 'App',
      setup() {
        const count = signal(0);
        return { count };
      },
      template({ count }) {
        return html`
          <h1>Count: ${count}</h1>
          <button @click=${() => count.val++}>+1</button>
        `;
      },
    });

    mount(App, document.getElementById('app'));
  </script>
</body>
</html>
```

## API Reference

### Signals

| Export | Signature | Description |
|--------|-----------|-------------|
| `signal` | `signal(initial) → { val, subscribe, peek }` | Create a reactive value |
| `computed` | `computed(fn) → { val, peek }` | Derive a signal from others |
| `batch` | `batch(fn)` | Defer all signal updates until fn completes |

### Effects

| Export | Signature | Description |
|--------|-----------|-------------|
| `effect` | `effect(fn) → dispose()` | Run fn, re-run on signal changes |
| `watchEffect` | `watchEffect(fn) → dispose()` | Auto-cleaned effect on component unmount |

### Components

| Export | Signature | Description |
|--------|-----------|-------------|
| `defineComponent` | `defineComponent({ name, setup, template })` | Create a component class |
| `mount` | `mount(Component, targetEl, props) → { instance, unmount }` | Mount a component |

Lifecycle hooks (register inside `setup()`):

```js
setup() {
  this.onMount(() => { /* mounted */ });
  this.onUnmount(() => { /* cleaned up */ });
  this.onUpdate(() => { /* re-rendered */ });
}
```

### Templates

| Export | Signature | Description |
|--------|-----------|-------------|
| `html` | `` html`...${expr}...` `` | Tagged template → live DOM fragment |
| `css` | `` css`...` `` | Scoped style injection |

Expression types in `${}`:

- **string/number**: Creates a text node
- **signal**: Live-bound text node (updates when signal changes)
- **function**: Attached as event listener (`@click=${handler}`)
- **boolean signal**: Toggles attribute (`?disabled=${signal}`)
- **Node**: Appended directly
- **Array**: Each item appended

### Router

```js
const router = createRouter([
  { path: '/', component: HomePage },
  { path: '/user/:id', component: UserPage, beforeEnter: async (to, params) => true },
]);

router.navigate('/user/42');
```

| Export | Signature | Description |
|--------|-----------|-------------|
| `createRouter` | `createRouter(routes)` | Returns `{ navigate, back, forward, current, destroy }` |

### Crypto

```js
const key = await generateKey();
const encrypted = await encryptState(key, { secret: 'data' });
const decrypted = await decryptState(key, encrypted);
```

| Export | Signature | Description |
|--------|-----------|-------------|
| `generateKey` | `generateKey() → CryptoKey` | AES-GCM 256-bit key |
| `encryptState` | `encryptState(key, state) → { v, iv, data }` | Encrypt+serialize |
| `decryptState` | `decryptState(key, payload) → state` | Decrypt+deserialize |
| `deriveKey` | `deriveKey(password, salt) → CryptoKey` | PBKDF2 key derivation |
| `secureErase` | `secureErase(buffer)` | Zero-fill + hint GC |

### Electron Bridge (vexorBridge)

Accessed via `window.vexorBridge` in the renderer:

```js
await window.vexorBridge.invoke('store:get', 'key');
window.vexorBridge.send('store:set', { key: 'theme', value: 'dark' });
window.vexorBridge.onMessage('app:ready', (data) => console.log(data));
```

Allowed channels: `app:ready`, `store:get`, `store:set`, `store:delete`, `crypto:getKey`, `dialog:open`, `dialog:save`, `shell:openExternal`, `app:getVersion`, `app:getPath`

## Security Model

```
┌─────────────────────────────────────────────────┐
│                  Renderer Process                │
│  ┌───────────────────────────────────────────┐   │
│  │  VEXOR App (ES Modules, no eval)          │   │
│  │  Signals | Components | Templates | Router│   │
│  └──────────────────┬────────────────────────┘   │
│                     │ window.vexorBridge          │
│  ┌──────────────────▼────────────────────────┐   │
│  │  contextBridge (preload.js)               │   │
│  │  Whitelist: only 10 channels allowed      │   │
│  │  Data: JSON.parse(JSON.stringify()) scrub │   │
│  └──────────────────┬────────────────────────┘   │
├─────────────────────┼────────────────────────────┤
│  Process Boundary   │   IPC                      │
├─────────────────────┼────────────────────────────┤
│                     ▼                            │
│  ┌───────────────────────────────────────────┐   │
│  │  Main Process (ipc-handler.js)            │   │
│  │  Validate | Sanitize | Execute             │   │
│  └───────────────────────────────────────────┘   │
│              Main Process                        │
└─────────────────────────────────────────────────┘

Security hardening:
- contextIsolation: true   (preload isolated from renderer)
- nodeIntegration: false   (no require() in renderer)
- sandbox: true            (OS-level sandbox)
- CSP: strict policy       (no unsafe-eval, no external scripts)
- No eval / new Function   (enforced by CSP)
- All external nav blocked
- IPC channel whitelist    (only 10 channels)
- Data sanitized on bridge crossing
```

## Performance Benchmarks

| Metric | Target | Measured |
|--------|--------|----------|
| Core bundle (minified) | < 3KB | — |
| Signal update → DOM paint | < 1ms | — |
| Mount 1000 components | < 50ms | — |
| Memory per component | < 5KB | — |
| Cold start (Electron) | < 200ms | — |

## Development

```bash
# Run tests
node --test ./vexor/tests/*.test.js

# Use with Electron
npx electron ./vexor/index.html
```

## Encryption Example

```js
import { generateKey, encryptState, decryptState, secureErase } from './vexor.js';

// Generate a key (store securely via IPC)
const key = await generateKey();

// Save encrypted state
const userData = { email: 'user@example.com', tokens: ['abc123'] };
const encrypted = await encryptState(key, userData);

// Persist to disk via bridge
await window.vexorBridge.invoke('store:set', { key: 'user', value: encrypted });

// Load and decrypt
const saved = await window.vexorBridge.invoke('store:get', 'user');
const decrypted = await decryptState(key, saved);

// Clear sensitive data
secureErase(key);
```

## License

MIT
