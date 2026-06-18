let activeEffect = null;
let batchPending = false;
const batchQueue = new Set();

export function signal(initialValue) {
  let value = initialValue;
  const subs = new Set();

  function read() {
    if (activeEffect) {
      subs.add(activeEffect);
      activeEffect._deps.add(subs);
    }
    return value;
  }

  function write(newVal) {
    if (newVal === value) return;
    value = newVal;
    if (batchPending) {
      for (const fn of subs) batchQueue.add(fn);
    } else {
      for (const fn of [...subs]) fn();
    }
  }

  function subscribe(fn) {
    subs.add(fn);
    return () => subs.delete(fn);
  }

  function peek() { return value; }

  return {
    get val() { return read(); },
    set val(v) { write(v); },
    subscribe,
    peek,
  };
}

export function computed(fn) {
  let value;
  let dirty = true;
  const subs = new Set();

  const marker = () => {
    if (!dirty) {
      dirty = true;
      for (const sub of [...subs]) {
        if (sub._isEffect && !sub._isMarker) {
          queueMicrotask(() => sub());
        } else {
          sub();
        }
      }
    }
  };
  marker._isEffect = true;
  marker._isMarker = true;
  marker._deps = new Set();

  function read() {
    if (activeEffect) {
      subs.add(activeEffect);
      activeEffect._deps.add(subs);
    }
    if (dirty) {
      for (const depSet of marker._deps) depSet.delete(marker);
      marker._deps.clear();
      const prev = activeEffect;
      activeEffect = marker;
      try { value = fn(); dirty = false; } finally { activeEffect = prev; }
    }
    return value;
  }

  return {
    get val() { return read(); },
    peek() { if (dirty) { value = fn(); dirty = false; } return value; },
  };
}

export function batch(fn) {
  const wasPending = batchPending;
  batchPending = true;
  try { fn(); } finally {
    batchPending = wasPending;
    if (!batchPending && batchQueue.size > 0) {
      const pending = [...batchQueue];
      batchQueue.clear();
      for (const fn of pending) fn();
    }
  }
}
