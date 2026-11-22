---
title: Home
---

# bunact

A tiny TypeScript framework where [Bun](https://bun.sh) does everything: running TypeScript, serving, bundling, and hot reload.

- **One file.** The whole framework is [`src/bunact.ts`](https://github.com/janfeshanm/bunact/blob/main/src/bunact.ts), about 350 lines.
- **One dependency.** Only `@types/bun`, for development. No React; JSX compiles to bunact's own `h()`.
- **Fine-grained reactivity.** Signals update the exact text node or attribute that reads them. Components run once.

```tsx
import { h, signal, computed, render } from "./bunact.ts";

function Counter() {
  const [count, setCount] = signal(0);
  const double = computed(() => count() * 2);
  return <button onClick={() => setCount((c) => c + 1)}>{count} / {double}</button>;
}

render(() => <Counter />, document.getElementById("app")!);
```

## Documentation

- [Architecture](architecture.md): modules, data model, data flow and design decisions, with diagrams.

## Getting started

```sh
bun install
bun run dev      # http://localhost:3000 with hot reload
bun run build    # bundle to ./dist
```
