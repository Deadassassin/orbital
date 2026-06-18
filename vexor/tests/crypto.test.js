import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateKey, encryptState, decryptState, deriveKey, secureErase } from '../src/core/crypto.js';

// Web Crypto is available globally in Node 20+ via globalThis.crypto

describe('crypto', () => {
  it('encrypt/decrypt roundtrip', async () => {
    const key = await generateKey();
    const state = { hello: 'world', count: 42, nested: { a: 1 } };
    const encrypted = await encryptState(key, state);
    assert.ok(encrypted.iv);
    assert.ok(encrypted.data);
    assert.equal(encrypted.v, 1);
    const decrypted = await decryptState(key, encrypted);
    assert.deepEqual(decrypted, state);
  });

  it('IV is unique across 100 encrypt calls', async () => {
    const key = await generateKey();
    const state = { test: true };
    const ivs = new Set();
    for (let i = 0; i < 100; i++) {
      const encrypted = await encryptState(key, state);
      ivs.add(encrypted.iv);
    }
    assert.equal(ivs.size, 100);
  });

  it('key derivation is deterministic with same salt', async () => {
    const password = 'test-password-123';
    const salt = 'fixed-salt-value';
    const key1 = await deriveKey(password, salt);
    const key2 = await deriveKey(password, salt);
    const raw1 = await crypto.subtle.exportKey('raw', key1);
    const raw2 = await crypto.subtle.exportKey('raw', key2);
    assert.deepEqual(new Uint8Array(raw1), new Uint8Array(raw2));
  });

  it('different passwords produce different keys', async () => {
    const key1 = await deriveKey('password-a', 'salt');
    const key2 = await deriveKey('password-b', 'salt');
    const raw1 = await crypto.subtle.exportKey('raw', key1);
    const raw2 = await crypto.subtle.exportKey('raw', key2);
    const buf1 = new Uint8Array(raw1);
    const buf2 = new Uint8Array(raw2);
    assert.notDeepEqual(buf1, buf2);
  });

  it('secureErase zero-fills buffer', () => {
    const buf = new ArrayBuffer(32);
    const view = new Uint8Array(buf);
    for (let i = 0; i < view.length; i++) view[i] = 0xFF;
    secureErase(buf);
    for (let i = 0; i < view.length; i++) {
      assert.equal(view[i], 0);
    }
  });

  it('decrypt fails with wrong key', async () => {
    const key1 = await generateKey();
    const key2 = await generateKey();
    const state = { secret: 'data' };
    const encrypted = await encryptState(key1, state);
    try {
      await decryptState(key2, encrypted);
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err instanceof Error);
    }
  });
});
