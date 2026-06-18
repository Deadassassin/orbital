import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { html } from '../src/core/template.js';
import { defineComponent, mount } from '../src/core/component.js';

describe('component', () => {
  it('mount renders into target', () => {
    const target = document.createElement('div');
    const Comp = defineComponent({
      name: 'Test',
      setup() { return {}; },
      template() {
        return html`<p>Hello</p>`;
      },
    });
    const { instance, unmount } = mount(Comp, target);
    assert.ok(instance.id);
    assert.equal(target.querySelector('p')?.textContent, 'Hello');
    assert.equal(target.querySelector('[data-vexor-component="Test"]')?.tagName, 'P');
    unmount();
  });

  it('unmount removes DOM and calls cleanup', () => {
    const target = document.createElement('div');
    let cleaned = false;
    const Comp = defineComponent({
      name: 'CleanupTest',
      setup() {
        this.onUnmount(() => { cleaned = true; });
        return {};
      },
      template() {
        return html`<span>Cleanup</span>`;
      },
    });
    const { unmount } = mount(Comp, target);
    assert.equal(target.children.length, 1);
    unmount();
    assert.equal(target.children.length, 0);
    assert.ok(cleaned);
  });

  it('props are frozen', () => {
    const target = document.createElement('div');
    const Comp = defineComponent({
      name: 'PropsTest',
      setup(props) {
        return { msg: props.msg };
      },
      template({ msg }) {
        return html`<p>${msg}</p>`;
      },
    });
    const { instance, unmount } = mount(Comp, target, { msg: 'test' });
    assert.equal(instance.props.msg, 'test');
    assert.throws(() => { instance.props.msg = 'changed'; });
    unmount();
  });

  it('multiple instances are isolated', () => {
    const t1 = document.createElement('div');
    const t2 = document.createElement('div');
    const Comp = defineComponent({
      name: 'Isolated',
      setup() {
        const val = { id: crypto.randomUUID() };
        return { val };
      },
      template({ val }) {
        return html`<span>${val.id}</span>`;
      },
    });
    const { instance: i1, unmount: u1 } = mount(Comp, t1);
    const { instance: i2, unmount: u2 } = mount(Comp, t2);
    assert.notEqual(i1.id, i2.id);
    assert.notEqual(t1.textContent, t2.textContent);
    u1();
    u2();
  });
});
