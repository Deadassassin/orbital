let templateCounter = 0;

function uid() { return `v_${++templateCounter}`; }

function parseTemplate(strings, values) {
  const markers = [];
  let html = '';
  for (let i = 0; i < strings.length; i++) {
    html += strings[i];
    if (i < values.length) {
      const m = uid();
      markers.push(m);
      html += `<!--${m}-->`;
    }
  }
  return { html, markers, values };
}

function getAttrName(marker) {
  return `data-v-${marker}`;
}

export function html(strings, ...values) {
  const { html: rawHtml, markers, values: vals } = parseTemplate(strings, values);
  const container = document.createElement('div');
  container.innerHTML = rawHtml;

  const walker = document.createTreeWalker(container, 4, null, false);
  const nodesToRemove = [];
  const replacements = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === 8) {
      const idx = markers.indexOf(node.textContent);
      if (idx !== -1) {
        const val = vals[idx];
        const parent = node.parentNode;
        const nextSibling = node.nextSibling;
        const prevSibling = node.previousSibling;
        const isAttr = prevSibling && prevSibling.nodeType === 1 &&
          prevSibling.hasAttribute(getAttrName(markers[idx]));

        if (isAttr) {
          const el = prevSibling;
          const attrName = el.getAttribute(getAttrName(markers[idx]));
          el.removeAttribute(getAttrName(markers[idx]));
          nodesToRemove.push(node);

          if (typeof val === 'function') {
            el.addEventListener(attrName.replace('@', ''), val);
          } else if (typeof val === 'boolean' || (val && val.peek && val.peek() === true)) {
            el.setAttribute(attrName, '');
          } else if (val && typeof val === 'object' && val.peek !== undefined) {
            const initial = val.peek();
            if (initial) el.setAttribute(attrName, '');
            const attrNameClean = attrName.replace('?', '');
            val.subscribe(v => {
              v ? el.setAttribute(attrNameClean, '') : el.removeAttribute(attrNameClean);
            });
          }
        } else {
          nodesToRemove.push(node);
          if (val && typeof val === 'object' && val.peek !== undefined) {
            const textNode = document.createTextNode(val.peek());
            parent.insertBefore(textNode, nextSibling);
            val.subscribe(v => { textNode.textContent = v; });
          } else if (val instanceof Node) {
            parent.insertBefore(val, nextSibling);
          } else if (Array.isArray(val)) {
            for (const item of val) {
              const node = item instanceof Node ? item : document.createTextNode(String(item));
              parent.insertBefore(node, nextSibling);
            }
          } else {
            const textNode = document.createTextNode(val == null ? '' : String(val));
            parent.insertBefore(textNode, nextSibling);
          }
        }
      }
    } else if (node.nodeType === 1) {
      const el = node;
      for (const attr of [...el.attributes]) {
        if (attr.name.startsWith('@')) {
          const eventName = attr.name.slice(1);
          el.removeAttribute(attr.name);
          const exprIdx = markers.indexOf(attr.value);
          if (exprIdx !== -1 && typeof vals[exprIdx] === 'function') {
            el.addEventListener(eventName, vals[exprIdx]);
          }
        } else if (attr.name.startsWith('?')) {
          const attrName = attr.name.slice(1);
          el.removeAttribute(attr.name);
          const exprIdx = markers.indexOf(attr.value);
          if (exprIdx !== -1) {
            const val = vals[exprIdx];
            if (typeof val === 'boolean') {
              if (val) el.setAttribute(attrName, '');
            } else if (val && typeof val === 'object' && val.peek !== undefined) {
              if (val.peek()) el.setAttribute(attrName, '');
              val.subscribe(v => {
                v ? el.setAttribute(attrName, '') : el.removeAttribute(attrName);
              });
            }
          }
        }
      }
    }
  }

  for (const n of nodesToRemove) {
    if (n.parentNode) n.parentNode.removeChild(n);
  }

  return container;
}

export function css(strings, ...values) {
  const el = document.createElement('style');
  let text = '';
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) text += String(values[i]);
  }
  el.textContent = text;
  return el;
}

export function renderTemplate(templateFn, state, component) {
  return templateFn(state, component);
}

export function patchDom(oldEl, newFrag) {
  const newEl = newFrag.firstElementChild || newFrag.firstChild;
  if (!newEl || !oldEl) return;
  const parent = oldEl.parentNode;
  if (!parent) return;
  const temp = document.createElement('div');
  temp.appendChild(newEl.cloneNode(true));
  const walker = document.createTreeWalker(temp, 4, null, false);
  const textNodes = [];
  while (walker.nextNode()) {
    if (walker.currentNode.nodeType === 3) textNodes.push(walker.currentNode);
  }
  const oldWalker = document.createTreeWalker(oldEl, 4, null, false);
  let oldTextIdx = 0;
  while (oldWalker.nextNode()) {
    if (oldWalker.currentNode.nodeType === 3) {
      if (textNodes[oldTextIdx]) {
        oldWalker.currentNode.textContent = textNodes[oldTextIdx].textContent;
      }
      oldTextIdx++;
    }
  }
}
