# bunact

A tiny TSX framework where [Bun](https://bun.sh) does everything: running TypeScript, serving, bundling, and hot reload.

- The framework is one file: [`src/bunact.tsx`](src/bunact.tsx).
- The only dependency is `@types/bun` (dev only). React is not used; TSX compiles to bunact's own `h()`.

## Scripts

```sh
bun install        # installs @types/bun only
bun run dev        # dev server with HMR on http://localhost:3000
bun run build      # bundle to ./dist
bun run start      # production server
bun run typecheck  # tsc via bunx (not a project dependency)
```

## API

```tsx
import { h, Fragment, signal, computed, effect, batch, render, Show, For } from "./bunact.tsx";

function Counter() {
  const [count, setCount] = signal(0);          // reactive value
  const double = computed(() => count() * 2);   // derived value
  effect(() => console.log(count()));           // re-runs when count changes

  return (
    <button onClick={() => setCount((c) => c + 1)}>
      {count} / {double}
    </button>
  );
}

render(() => <Counter />, document.getElementById("app")!);
```

Components run **once**. To make something update, pass a function (a getter or `() => ...`)
as a child or prop; only that text node or attribute updates.

| Export | Purpose |
| --- | --- |
| `signal(v)` | `[get, set]`; `set` accepts a value or `prev => next` |
| `computed(fn)` | read-only derived getter |
| `effect(fn)` | runs now and when its dependencies change; may return a cleanup |
| `batch(fn)` | group writes so effects run once |
| `untrack(fn)`, `root(fn)`, `onCleanup(fn)` | scope and tracking helpers |
| `h`, `Fragment` | JSX factory (set in `tsconfig.json`) |
| `render(app, el)` | mount; returns an unmount function |
| `<Show when fallback>` | conditional rendering |
| `<For each>{item => ...}</For>` | keyed (by identity) list rendering |

Limitations: no SVG namespace support yet, and `For` keys rows by item identity, so duplicate items in one list share a row.
