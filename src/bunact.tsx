/**
 * bunact — a tiny, single-file TSX framework with signal-based reactivity.
 *
 * - Reactivity: signal / computed / effect / batch / untrack / root / onCleanup
 * - Rendering:  h / Fragment / render / Show / For  (real DOM, no virtual DOM)
 *
 * Components run ONCE. Anything that should update must be a function:
 *   <p>{count}</p>                  // reactive text (count is a getter)
 *   <li class={() => done() ? "done" : ""} />   // reactive attribute
 */

type Fn = () => void;

/* ------------------------------------------------------------------ */
/* Reactivity                                                          */
/* ------------------------------------------------------------------ */

interface Owner {
  cleanups: Fn[];
}

interface Effect extends Owner {
  run: Fn;
  deps: Set<Set<Effect>>;
  active: boolean;
}

/** The effect currently collecting dependencies. */
let listener: Effect | null = null;
/** The scope that newly created effects/cleanups belong to. */
let owner: Owner | null = null;

let batchDepth = 0;
const pending = new Set<Effect>();

export type Getter<T> = () => T;
export type Setter<T> = (next: T | ((prev: T) => T)) => void;

/** Create a reactive value. Reading it inside an effect subscribes that effect. */
export function signal<T>(value: T): [Getter<T>, Setter<T>] {
  const subscribers = new Set<Effect>();

  const get: Getter<T> = () => {
    if (listener) {
      subscribers.add(listener);
      listener.deps.add(subscribers);
    }
    return value;
  };

  const set: Setter<T> = (next) => {
    const v = typeof next === "function" ? (next as (prev: T) => T)(value) : next;
    if (Object.is(v, value)) return;
    value = v;
    for (const e of [...subscribers]) schedule(e);
  };

  return [get, set];
}

function schedule(e: Effect) {
  if (batchDepth > 0) pending.add(e);
  else e.run();
}

function runCleanups(o: Owner) {
  for (const c of o.cleanups.splice(0)) c();
}

function unsubscribe(e: Effect) {
  for (const subs of e.deps) subs.delete(e);
  e.deps.clear();
}

/**
 * Run `fn` now and again whenever a signal it read changes.
 * `fn` may return a cleanup function. Returns a dispose function.
 */
export function effect(fn: () => void | Fn): Fn {
  const e: Effect = {
    deps: new Set(),
    cleanups: [],
    active: true,
    run() {
      if (!e.active) return;
      unsubscribe(e);
      runCleanups(e); // disposes child effects from the previous run
      const [prevListener, prevOwner] = [listener, owner];
      listener = e;
      owner = e;
      try {
        const cleanup = fn();
        if (typeof cleanup === "function") e.cleanups.push(cleanup);
      } finally {
        listener = prevListener;
        owner = prevOwner;
      }
    },
  };

  const dispose = () => {
    e.active = false;
    pending.delete(e);
    unsubscribe(e);
    runCleanups(e);
  };

  owner?.cleanups.push(dispose);
  e.run();
  return dispose;
}

/** A derived, read-only signal. */
export function computed<T>(fn: () => T): Getter<T> {
  const [get, set] = signal<T>(undefined as T);
  effect(() => {
    const v = fn();
    set(() => v);
  });
  return get;
}

/** Group several writes; effects run once at the end. */
export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    if (--batchDepth === 0) {
      const effects = [...pending];
      pending.clear();
      for (const e of effects) e.run();
    }
  }
}

/** Read signals without subscribing the current effect. */
export function untrack<T>(fn: () => T): T {
  const prev = listener;
  listener = null;
  try {
    return fn();
  } finally {
    listener = prev;
  }
}

/** Create an independent ownership scope. Everything created inside is disposed by `dispose`. */
export function root<T>(fn: (dispose: Fn) => T): T {
  const o: Owner = { cleanups: [] };
  const [prevListener, prevOwner] = [listener, owner];
  listener = null;
  owner = o;
  try {
    return fn(() => runCleanups(o));
  } finally {
    listener = prevListener;
    owner = prevOwner;
  }
}

/** Register a cleanup with the current scope (effect, component, or root). */
export function onCleanup(fn: Fn) {
  owner?.cleanups.push(fn);
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

export type Child =
  | Node
  | string
  | number
  | boolean
  | null
  | undefined
  | Child[]
  | (() => Child);

export type Component<P = {}> = (props: P & { children?: any }) => Child;

type Props = Record<string, any>;

export const Fragment: Component = (props) => props.children;

/** JSX factory. `<div class="x">hi</div>` compiles to `h("div", { class: "x" }, "hi")`. */
export function h(tag: string | Component<any>, props: Props | null, ...children: Child[]): Child {
  props ??= {};

  if (typeof tag === "function") {
    const p = { ...props };
    if (children.length) p.children = children.length === 1 ? children[0] : children;
    // Components run once; signal reads in their body must not subscribe the parent.
    return untrack(() => tag(p));
  }

  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) setProp(el, key, value);
  insert(el, children);
  return el;
}

function setProp(el: HTMLElement, key: string, value: any) {
  if (key === "children") return;
  if (key === "ref") {
    value(el);
  } else if (key.startsWith("on") && typeof value === "function") {
    el.addEventListener(key.slice(2).toLowerCase(), value);
  } else if (typeof value === "function") {
    effect(() => applyProp(el, key, value()));
  } else {
    applyProp(el, key, value);
  }
}

function applyProp(el: HTMLElement, key: string, value: any) {
  if (key === "className") key = "class";

  if (key === "style" && value && typeof value === "object") {
    Object.assign(el.style, value);
  } else if (key !== "class" && !key.includes("-") && key in el) {
    (el as any)[key] = value; // DOM properties: value, checked, disabled, ...
  } else if (value == null || value === false) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, value === true ? "" : String(value));
  }
}

/** Turn any child into a list of DOM nodes. Function children become reactive regions. */
function toNodes(child: Child): Node[] {
  if (child == null || typeof child === "boolean") return [];
  if (child instanceof DocumentFragment) return [...child.childNodes];
  if (child instanceof Node) return [child];
  if (Array.isArray(child)) return child.flatMap(toNodes);
  if (typeof child === "function") {
    const frag = document.createDocumentFragment();
    insert(frag, child);
    return [...frag.childNodes];
  }
  return [document.createTextNode(String(child))];
}

function insert(parent: Node, child: Child) {
  if (typeof child !== "function") {
    for (const node of toNodes(child)) parent.appendChild(node);
    return;
  }

  // A reactive region lives between two comment markers and is re-rendered in place.
  const start = document.createComment("");
  const end = document.createComment("");
  parent.appendChild(start);
  parent.appendChild(end);

  effect(() => {
    const next = toNodes(child());
    const p = end.parentNode!;
    const first = start.nextSibling;

    // Fast path: a single text node just gets its text updated.
    if (next.length === 1 && next[0] instanceof Text && first instanceof Text && first.nextSibling === end) {
      first.data = next[0].data;
      return;
    }

    while (start.nextSibling && start.nextSibling !== end) p.removeChild(start.nextSibling);
    for (const node of next) p.insertBefore(node, end);
  });
}

/** Mount an app into a container. Returns a function that unmounts it. */
export function render(app: () => Child, container: Element): Fn {
  return root((dispose) => {
    container.replaceChildren(...toNodes(app()));
    return () => {
      dispose();
      container.replaceChildren();
    };
  });
}

/* ------------------------------------------------------------------ */
/* Control flow                                                        */
/* ------------------------------------------------------------------ */

/** Render `children` while `when()` is truthy, otherwise `fallback`. */
export function Show(props: { when: () => unknown; fallback?: Child; children?: Child }): Child {
  const visible = computed(() => !!props.when());
  return () => (visible() ? props.children : props.fallback);
}

/**
 * Render a list. Rows are keyed by item identity: existing rows are moved,
 * not re-created, when the array changes.
 */
export function For<T>(props: { each: () => T[]; children: (item: T, index: number) => Child }): Child {
  type Row = { start: Comment; end: Comment; dispose: Fn };
  let rows = new Map<T, Row>();
  onCleanup(() => rows.forEach((row) => row.dispose()));

  // A row's nodes can change (it may contain reactive regions), so collect them between its markers.
  const nodesOf = ({ start, end }: Row) => {
    const nodes: Node[] = [];
    for (let n: Node | null = start; n; n = n.nextSibling) {
      nodes.push(n);
      if (n === end) break;
    }
    return nodes;
  };

  return () => {
    const next = new Map<T, Row>();
    const items = props.each();

    items.forEach((item, i) => {
      let row = rows.get(item);
      if (!row) {
        row = root((dispose) => {
          const start = document.createComment("");
          const end = document.createComment("");
          const holder = document.createDocumentFragment();
          holder.append(start, ...toNodes(props.children(item, i)), end);
          return { start, end, dispose };
        });
      }
      next.set(item, row);
    });

    for (const [item, row] of rows) if (!next.has(item)) row.dispose();
    rows = next;

    return items.flatMap((item) => nodesOf(next.get(item)!));
  };
}

/* ------------------------------------------------------------------ */
/* JSX types                                                           */
/* ------------------------------------------------------------------ */

declare global {
  namespace JSX {
    type Element = Child;
    interface ElementChildrenAttribute {
      children: {};
    }
    interface IntrinsicElements {
      [tag: string]: Record<string, any>;
    }
  }
}
