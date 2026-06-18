import { effect } from './effect.js';
import { renderTemplate, patchDom } from './template.js';

let compCounter = 0;

export function defineComponent(def) {
  return class VexorComponent {
    constructor(props = {}) {
      this.id = crypto.randomUUID();
      this.name = def.name || `Component_${++compCounter}`;
      this.props = Object.freeze({ ...props });
      this.el = null;
      this._mounted = false;
      this._unmountFns = [];
      this._children = [];
      this._hostEl = null;
    }

    setup() {
      const hooks = { _onUnmount: (fn) => this._unmountFns.push(fn) };
      const ctx = def.setup ? def.setup.call(hooks, this.props) : {};
      return ctx;
    }

    mount(targetEl) {
      this._hostEl = targetEl;
      const state = this.setup();
      this._state = state;
      const frag = def.template(state, this);
      this.el = frag.firstElementChild || frag.firstChild;
      this.el.setAttribute('data-vexor-id', this.id);
      if (this.name) this.el.setAttribute('data-vexor-component', this.name);
      targetEl.appendChild(frag);
      this._mounted = true;
      if (this._mountFn) this._mountFn();
      return () => this.unmount();
    }

    update(newProps) {
      if (!this._mounted) return;
      this.props = Object.freeze({ ...newProps });
      if (def.template) {
        const newFrag = def.template(this._state, this);
        if (this.el && this.el.parentNode) {
          patchDom(this.el, newFrag);
        }
      }
      if (this._updateFn) this._updateFn();
    }

    unmount() {
      for (const fn of this._unmountFns) fn();
      this._unmountFns = [];
      if (this._unmountFn) this._unmountFn();
      for (const child of this._children) child.unmount();
      this._children = [];
      if (this.el && this.el.parentNode) {
        this.el.parentNode.removeChild(this.el);
      }
      this._mounted = false;
      this.el = null;
    }

    onMount(fn) { this._mountFn = fn; }
    onUnmount(fn) { this._unmountFn = fn; }
    onUpdate(fn) { this._updateFn = fn; }
  };
}

export function mount(Component, targetEl, props = {}) {
  const instance = new Component(props);
  const unmount = instance.mount(targetEl);
  return { instance, unmount };
}
