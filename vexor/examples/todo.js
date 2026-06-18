import { signal, computed, defineComponent, mount, html, css } from '../src/vexor.js';

const TodoItem = defineComponent({
  name: 'TodoItem',
  setup(props) {
    function toggle() {
      props.todo.val = { ...props.todo.peek(), done: !props.todo.peek().done };
    }
    function remove() {
      if (props.onRemove) props.onRemove(props.todo.peek().id);
    }
    return { toggle, remove };
  },
  template({ toggle, remove }, { props }) {
    const todo = props.todo;
    return html`
      <li class="todo-item" ?done=${() => todo.val.done}>
        <input type="checkbox" ?checked=${() => todo.val.done} @change=${toggle} />
        <span style=${() => todo.val.done ? 'text-decoration: line-through; color: #999;' : ''}>
          ${() => todo.val.text}
        </span>
        <button @click=${remove} class="remove-btn">×</button>
      </li>
      ${css`
        .todo-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; }
        .todo-item[data-done] span { text-decoration: line-through; color: #999; }
        .remove-btn {
          margin-left: auto; background: none; border: 1px solid #e33;
          color: #e33; border-radius: 4px; cursor: pointer; padding: 2px 8px;
        }
      `}
    `;
  },
});

const TodoApp = defineComponent({
  name: 'TodoApp',
  setup() {
    const items = signal([]);
    const input = signal('');
    const nextId = signal(1);
    const remaining = computed(() => items.val.filter(t => !t.done).length);

    function addTodo() {
      const text = input.val.trim();
      if (!text) return;
      batch(() => {
        items.val = [...items.val, { id: nextId.val, text, done: false }];
        nextId.val = nextId.val + 1;
        input.val = '';
      });
    }

    function removeTodo(id) {
      items.val = items.val.filter(t => t.id !== id);
    }

    return { items, input, remaining, addTodo, removeTodo };
  },
  template({ items, input, remaining, addTodo, removeTodo }) {
    return html`
      <div class="todo-app">
        <h1>VEXOR Todo</h1>
        <div class="input-row">
          <input type="text" @keydown=${(e) => { if (e.key === 'Enter') addTodo(); }}
                 @input=${(e) => input.val = e.target.value}
                 placeholder="What needs to be done?" value=${input} />
          <button @click=${addTodo}>Add</button>
        </div>
        <p class="remaining">${remaining} item${() => remaining.val !== 1 ? 's' : ''} remaining</p>
        <ul class="todo-list">
          ${items.val.map(todo => {
            const sig = signal(todo);
            return html`<li>${new TodoItem({ todo: sig, onRemove: removeTodo }).el || ''}</li>`;
          })}
        </ul>
      </div>
      ${css`
        .todo-app { max-width: 500px; margin: 2rem auto; font-family: sans-serif; }
        .todo-app h1 { font-size: 2rem; margin-bottom: 1rem; }
        .input-row { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
        .input-row input { flex: 1; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; }
        .input-row button { padding: 0.5rem 1rem; background: #4a90d9; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .remaining { color: #666; font-size: 0.875rem; margin-bottom: 0.5rem; }
        .todo-list { list-style: none; padding: 0; }
      `}
    `;
  },
});

mount(TodoApp, document.getElementById('app'));
