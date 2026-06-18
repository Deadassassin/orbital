export async function generateKey() {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptState(key, state) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(state));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  const ivB64 = btoa(String.fromCharCode(...iv));
  const dataB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  return { v: 1, iv: ivB64, data: dataB64 };
}

export async function decryptState(key, payload) {
  const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(payload.data), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

export async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password),
    { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt ? enc.encode(salt) : crypto.getRandomValues(new Uint8Array(32)),
      iterations: 310000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export function secureErase(buffer) {
  if (!buffer || !(buffer instanceof ArrayBuffer)) return;
  const view = new Uint8Array(buffer);
  for (let i = 0; i < view.length; i++) view[i] = 0;
  crypto.subtle.importKey('raw', buffer, { name: 'AES-GCM' }, false, ['encrypt']);
}
