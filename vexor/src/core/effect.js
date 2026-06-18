const activeContext = { current: null };

export function setActiveContext(ctx) {
  activeContext.current = ctx;
}

export function getActiveContext() {
  return activeContext.current;
}

export function effect(fn) {
  let cleanup = null;
  let active = true;
  const prevContext = activeContext.current;

  function run() {
    if (!active) return;
    if (cleanup) cleanup();
    const prev = activeContext.current;
    activeContext.current = null;
    try {
      const result = fn();
      if (typeof result === 'function') cleanup = result;
    } finally {
      activeContext.current = prev;
    }
  }

  const tracked = () => {
    if (active) queueMicrotask(run);
  };
  tracked._isEffect = true;
  tracked._deps = new Set();

  run();

  return () => {
    active = false;
    if (cleanup) cleanup();
    cleanup = null;
    for (const depSet of tracked._deps) {
      depSet.delete(tracked);
    }
    tracked._deps.clear();
  };
}

export function watchEffect(fn) {
  const dispose = effect(fn);
  const ctx = activeContext.current;
  if (ctx && ctx._onUnmount) {
    ctx._onUnmount(() => dispose());
  }
  return dispose;
}

let effectCounter = 0;
export function trackEffect(fn) {
  const id = ++effectCounter;
  const tracked = function() {
    if (tracked._active) queueMicrotask(fn);
  };
  tracked._id = id;
  tracked._isEffect = true;
  tracked._active = true;
  tracked._deps = new Set();
  return tracked;
}

export function disposeEffect(tracked) {
  tracked._active = false;
  for (const depSet of tracked._deps) {
    depSet.delete(tracked);
  }
  tracked._deps.clear();
}
