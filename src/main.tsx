import { h, Fragment, signal, computed, effect, render, Show, For, type Getter, type Setter } from "./bunact.ts";

function Counter() {
  const [count, setCount] = signal(0);
  const double = computed(() => count() * 2);

  effect(() => {
    document.title = `Count: ${count()}`;
  });

  return (
    <section>
      <h2>Counter</h2>
      <div class="row">
        <button onClick={() => setCount((c) => c - 1)}>-</button>
        <strong>{count}</strong>
        <button onClick={() => setCount((c) => c + 1)}>+</button>
      </div>
      <p>Double: {double}</p>
      <Show when={() => count() >= 5} fallback={<p class="muted">Reach 5 to unlock a message.</p>}>
        <p>High five!</p>
      </Show>
    </section>
  );
}

interface Todo {
  text: string;
  done: Getter<boolean>;
  setDone: Setter<boolean>;
}

function Todos() {
  const [todos, setTodos] = signal<Todo[]>([]);
  const [text, setText] = signal("");
  const remaining = computed(() => todos().filter((t) => !t.done()).length);

  const add = (e: Event) => {
    e.preventDefault();
    const value = text().trim();
    if (!value) return;
    const [done, setDone] = signal(false);
    setTodos((list) => [...list, { text: value, done, setDone }]);
    setText("");
  };

  return (
    <section>
      <h2>Todos</h2>
      <form onSubmit={add} class="row">
        <input
          value={text}
          onInput={(e: Event) => setText((e.target as HTMLInputElement).value)}
          placeholder="What needs doing?"
        />
        <button type="submit">Add</button>
      </form>
      <ul>
        <For each={todos}>
          {(todo: Todo) => (
            <li class={() => (todo.done() ? "done" : "")}>
              <label>
                <input type="checkbox" checked={todo.done} onChange={() => todo.setDone((d) => !d)} />
                {todo.text}
              </label>
              <button onClick={() => setTodos((list) => list.filter((t) => t !== todo))}>x</button>
            </li>
          )}
        </For>
      </ul>
      <p class="muted">{remaining} remaining</p>
    </section>
  );
}

function App() {
  return (
    <>
      <h1>bunact</h1>
      <Counter />
      <Todos />
    </>
  );
}

render(() => <App />, document.getElementById("app")!);
