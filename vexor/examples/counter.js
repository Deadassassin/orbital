import { signal, computed, defineComponent, mount, html, css } from '../src/vexor.js';

const Counter = defineComponent({
  name: 'Counter',
  setup() {
    const count = signal(0);
    const doubled = computed(() => count.val * 2);
    return { count, doubled };
  },
  template({ count, doubled }) {
    return html`
      <div class="counter">
        <h2>Count: ${count}</h2>
        <p>Doubled: ${doubled}</p>
        <button @click=${() => count.val++}>+1</button>
        <button @click=${() => { if (count.val > 0) count.val--; }}>-1</button>
        <button @click=${() => count.val = 0}>Reset</button>
      </div>
      ${css`
        .counter { padding: 2rem; font-family: sans-serif; }
        .counter h2 { font-size: 2.5rem; margin: 0 0 0.5rem; }
        .counter p { color: #666; margin: 0 0 1rem; }
        .counter button {
          padding: 0.5rem 1rem; margin-right: 0.5rem;
          border: 1px solid #ccc; border-radius: 4px;
          background: #f5f5f5; cursor: pointer;
        }
        .counter button:hover { background: #e5e5e5; }
      `}
    `;
  },
});

mount(Counter, document.getElementById('app'));
