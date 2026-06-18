import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { signal, computed, batch } from '../src/core/signal.js';

describe('signal', () => {
  it('get/set basic', () => {
    const s = signal(10);
    assert.equal(s.val, 10);
    s.val = 20;
    assert.equal(s.val, 20);
  });

  it('peek reads without subscribing', () => {
    const s = signal(5);
    let calls = 0;
    const c = computed(() => {
      calls++;
      return s.peek() * 2;
    });
    assert.equal(c.val, 10);
    assert.equal(calls, 1);
    s.val = 10;
    assert.equal(c.val, 10);
    assert.equal(calls, 1);
  });

  it('computed derives latest value', () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a.val + b.val);
    assert.equal(sum.val, 5);
    a.val = 10;
    assert.equal(sum.val, 13);
    b.val = 7;
    assert.equal(sum.val, 17);
  });

  it('batch defers updates', () => {
    const s = signal(0);
    let effectCalls = 0;
    const tracked = () => { effectCalls++; s.val; };
    tracked._isEffect = true;
    tracked._deps = new Set();
    s.subscribe(tracked);
    batch(() => {
      s.val = 1;
      s.val = 2;
      s.val = 3;
      assert.equal(s.peek(), 3);
      assert.equal(effectCalls, 0);
    });
    assert.equal(s.peek(), 3);
  });

  it('subscribe returns dispose function', () => {
    const s = signal(0);
    let calls = 0;
    const dispose = s.subscribe(() => calls++);
    s.val = 1;
    assert.equal(calls, 1);
    dispose();
    s.val = 2;
    assert.equal(calls, 1);
  });

  it('chained computed', () => {
    const a = signal(2);
    const b = computed(() => a.val * 3);
    const c = computed(() => b.val + 1);
    assert.equal(c.val, 7);
    a.val = 3;
    assert.equal(c.val, 10);
  });

  it('signal with object value', () => {
    const s = signal({ x: 1, y: 2 });
    assert.deepEqual(s.val, { x: 1, y: 2 });
    s.val = { x: 3, y: 4 };
    assert.deepEqual(s.val, { x: 3, y: 4 });
  });
});
