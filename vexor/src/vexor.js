export { signal, computed, batch } from './core/signal.js';
export { effect, watchEffect } from './core/effect.js';
export { defineComponent, mount } from './core/component.js';
export { html, css } from './core/template.js';
export { createRouter } from './core/router.js';
export {
  generateKey, encryptState, decryptState, deriveKey, secureErase,
} from './core/crypto.js';

export const VERSION = '1.0.0';
export const NAME = 'VEXOR';
