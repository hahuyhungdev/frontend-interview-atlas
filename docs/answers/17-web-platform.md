# Web Platform APIs

Fills §3 of the [knowledge map](../frontend-knowledge-map.md), Browser & Web Platform. The corpus talks about WebSockets, SSE, and storage in passing — `localStorage`/IndexedDB get named, never explained — but Web Workers, Service Workers, and offline/PWA are marked ○: literally zero coverage across the 23 crawled articles. Everything below is professional judgment filling a real gap, not corpus-observed frequency, so treat the priority as "standard senior expectation," not "asked in these loops."

Every API here exists because the platform has a genuine, structural limitation — one thread, one origin's worth of trust, synchronous storage, a request/response model that doesn't fit every payload shape. The through-line: understand the constraint first, and the API stops looking like trivia.

---

# PART A — Web Workers

## Q: Why do Web Workers exist, and when do you actually need one?

**Answer.** JavaScript on the main thread is single-threaded — one call stack, and it's the same stack that runs your event handlers, your rendering-adjacent work, and layout/paint scheduling. `async`/`await` and promises don't change that. They reorder *when* work runs relative to other queued work (see the event loop model in [`./01-javascript.md`](./01-javascript.md)), but a synchronous, CPU-bound loop — sorting 500k rows, running a pixel filter over a large image, parsing a huge blob of text — still occupies the one stack the whole time it runs. **Async is concurrency, not parallelism.** Nothing about `await fetch(...)` helps if the expensive part is a tight `for` loop that never yields.

A **Web Worker** is a genuinely separate JS execution context — its own global scope (`self`, not `window`), its own event loop, no DOM access, no synchronous access to the parent's variables. It runs on a real OS thread. The only way in or out is message passing:

```javascript
// main.js
const worker = new Worker('sort-worker.js');
worker.postMessage({ type: 'sort', data: hugeArray });
worker.onmessage = (e) => {
  console.log('sorted', e.data.result);
};

// sort-worker.js
self.onmessage = (e) => {
  if (e.data.type === 'sort') {
    const result = e.data.data.slice().sort((a, b) => a - b); // runs off the main thread
    self.postMessage({ result });
  }
};
```

**The hidden cost people miss: `postMessage` copies.** By default, data crossing the boundary goes through the **structured clone algorithm** — the same mechanism behind `structuredClone()` and `IndexedDB`. It clones the value, it does not hand over a reference. Send a 200MB `ArrayBuffer` to a worker and back, and you pay a real serialization cost twice, on top of whatever the worker actually computed.

**`Transferable` objects fix this by transferring ownership instead of copying:**

```javascript
const buffer = new ArrayBuffer(1024 * 1024 * 50); // 50MB
worker.postMessage({ buffer }, [buffer]); // second arg: list of transferables

// After this call, `buffer` is neutered in THIS thread —
// buffer.byteLength === 0 here. The worker now owns it exclusively.
// This is a zero-copy handoff, not a copy — that's the entire point.
```

`ArrayBuffer`, `MessagePort`, `ImageBitmap`, and a handful of others support transfer. Regular objects and arrays do not — those are always cloned.

**When a worker actually pays for itself:** genuinely CPU-bound synchronous work that would otherwise block a frame — client-side parsing of a large CSV/JSON file, a WASM-backed image filter, a heavy client-side diff or search index build. **When it doesn't:** anything already I/O-bound. A `fetch()` call is already async and off the main thread by construction — wrapping it in a worker adds message-passing overhead for zero benefit. This is the overcorrection people make after learning workers exist: reaching for one to "make something async" when the thing was never blocking anything to begin with.

**One paragraph on the ergonomics:** raw `postMessage`/`onmessage` gets unpleasant fast once you need request/response semantics or error propagation, so most real codebases wrap it — [Comlink](https://github.com/GoogleChromeLabs/comlink) is the standard example, making a worker call look like an ordinary `await worker.sortHugeArray(data)`. For state shared **across tabs** rather than within one page, `SharedWorker` gives multiple browsing contexts a single worker instance with shared memory-adjacent state — worth naming in an interview, rarely worth reaching for outside a narrow set of multi-tab coordination problems.

---

# PART B — Service Workers and offline

## Q: Walk through the Service Worker lifecycle, and why does it have separate install/activate phases?

**Answer.** A Service Worker exists to solve a specific problem: letting a page's network layer be **programmable** — intercepted, cached, replayed — without the developer hand-rolling that in every page's own JS, and without an in-flight page having its underlying script swapped out from under it mid-session.

**The lifecycle:** `register` → `install` → `activate` → `fetch` (repeated per request) → eventually replaced by a newer version.

```javascript
// sw.js
const CACHE_NAME = 'app-shell-v3';

self.addEventListener('install', (event) => {
  // Runs once, when this SW version is first seen.
  // Pre-cache the app shell here. The new SW is not in control of any page yet.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/', '/app.css', '/app.js', '/offline.html'])
    )
  );
});

self.addEventListener('activate', (event) => {
  // Runs when this SW takes over. Safe point to clean up old caches,
  // because by definition the previous version is being retired.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});
```

**Why two separate events instead of one "ready" event:** `install` prepares the new version's resources speculatively, while the *currently active* Service Worker — and every open tab it controls — keeps running untouched. Only after installation succeeds does the browser even consider `activate`. Separating "prepare the new thing" from "take over" means a page open right now never has its script layer changed mid-session without an explicit decision to allow it.

## Q: A user reports the new version "isn't showing up" until they close and reopen the tab. What's happening?

**Answer.** This is the update problem, and it's the direct consequence of the lifecycle above working as designed. By default, a newly installed Service Worker enters a **waiting** state — it does not activate while any open tab is still controlled by the previous version. Every currently open tab keeps talking to the OLD worker. Only once **all** tabs controlled by the old worker are closed does the new one activate and take over.

That's deliberate: a page's script layer shouldn't change underneath it while the user is mid-interaction, potentially serving a mismatched mix of old HTML and new cached assets. But it also means "I shipped a fix" and "the user's tab is running the fix" can be arbitrarily far apart in time.

**To force immediate takeover, opt in explicitly:**

```javascript
self.addEventListener('install', (event) => {
  self.skipWaiting(); // don't wait for old tabs to close — activate as soon as installed
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // take control of already-open, uncontrolled tabs immediately
});
```

**The trade-off:** `skipWaiting()` + `clients.claim()` means an already-open tab can suddenly start being served by different code and different cached assets mid-session — safe for a static asset shell, potentially disruptive if the new version expects a different in-memory app state or a breaking API contract. A common middle ground is to detect the waiting worker and prompt the user ("update available, refresh to apply") rather than forcing it silently.

## Q: What are the caching strategies, and when does each one fit?

**Answer.** A Service Worker's `fetch` handler intercepts every network request the page makes and decides what to do — that's the entire caching surface. Three strategies cover almost every real case, and the right one depends on how stale a resource is allowed to be.

**Cache-first** — fast, but can serve stale content. Right for static, versioned assets (hashed JS/CSS bundles, icons) where staleness is impossible by construction (the filename changes when the content does):

```javascript
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

**Network-first** — fresher, falls back to cache only when offline. Right for API data that should reflect the current server state whenever a network exists:

```javascript
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone(); // body can only be read once
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request)) // offline: fall back to last-known-good
  );
});
```

**Stale-while-revalidate** — serve the cached response immediately for a fast response, then refetch in the background to refresh the cache for *next* time. The good middle ground for content that should feel instant but doesn't need to be second-by-second fresh:

```javascript
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request).then((response) => {
        cache.put(event.request, response.clone()); // updates the cache for the NEXT request
        return response;
      });
      return cached || networkFetch; // respond with cache now if we have it; don't block on the network
    })
  );
});
```

**The trap:** a Service Worker does **not** make a site "instantly offline" the moment it's registered. That's a common wrong belief. Offline support is entirely opt-in — you must explicitly cache exactly what you want available without a network, request by request. A Service Worker whose `fetch` handler just does `event.respondWith(fetch(event.request))` with no caching logic adds a layer of complexity — every request now round-trips through worker JS — for **zero** offline benefit. The worker itself grants nothing; the caching strategy inside it does the work.

---

# PART C — PWA, briefly and honestly

## Q: What does `manifest.json` actually add on top of a Service Worker?

**Answer.** `manifest.json` is metadata, not behavior — it tells the browser/OS how to present the site *as an installed app* if the user chooses to install it: name, icons at various sizes, `start_url`, `display` mode (`standalone` hides browser chrome), `theme_color`. All the actual functionality — offline support, background sync, caching — is the Service Worker's job. The manifest is a thin presentation layer on top of work the Service Worker is already doing.

**Installability, in brief, requires:** served over HTTPS, a valid `manifest.json` linked from the page, and a registered Service Worker with at least a `fetch` event handler. Browsers use that last condition as evidence the app has *some* offline story before offering to install it.

**Honest framing:** a PWA is not a universal upgrade over a normal site. It earns its cost in specific situations — markets with unreliable connectivity where offline access genuinely changes the product, or products where an installed, app-like presence (home-screen icon, no browser chrome, push notifications) measurably changes engagement. For most internal tools and content sites, the Service Worker's *caching* benefit (faster repeat loads) is worth having regardless, but the *installable app* framing is often more hype than product need. Say that plainly if asked — the honest answer scores better than pretending every product needs an "app-like experience."

---

# PART D — IndexedDB

## Q: Why does IndexedDB exist when `localStorage` already stores client-side data?

**Answer.** `localStorage` has three structural limits that make it wrong past a certain scale, and IndexedDB exists to remove all three:

1. **Synchronous.** Every `localStorage.getItem`/`setItem` call blocks the main thread. Fine for a few small reads; a real problem if you're storing anything nontrivially large or reading/writing frequently.
2. **String-only.** Everything is coerced to a string. Storing an object means `JSON.stringify`/`JSON.parse` on every access, and that round-trip silently loses types — a `Date` comes back as a string, not a `Date`; `Map`/`Set`/`undefined` don't survive at all.
3. **Small and un-queryable.** Roughly 5–10MB depending on the browser, and no way to query by anything other than fetching a whole key.

**IndexedDB is asynchronous, stores structured data natively (no serialization step for objects, dates, blobs, files), scales to a large fraction of available disk, and supports indexes** — you can query an object store by a field other than its primary key, not just fetch by exact key.

**The API's genuine cost:** the raw IndexedDB API is verbose and event-based, predating promises entirely — a plain `add()` call means wiring `onsuccess`/`onerror` handlers on a `request` object, inside a `transaction`, inside a versioned `objectStore`. Almost nobody writes it raw in real code; the [`idb`](https://github.com/jakearchibald/idb) library wraps the same primitives in a promise-based API:

```javascript
import { openDB } from 'idb';

const db = await openDB('app-db', 1, {
  upgrade(db) {
    const store = db.createObjectStore('notes', { keyPath: 'id' });
    store.createIndex('by-updated', 'updatedAt'); // query by updatedAt, not just id
  },
});

await db.put('notes', { id: 'n1', text: 'draft', updatedAt: new Date() }); // Date survives, unlike localStorage
const recent = await db.getAllFromIndex('notes', 'by-updated');
```

Underneath that call is still the real model worth knowing cold: a **database** has versioned **object stores** (roughly, tables — created/altered only inside an `upgrade` handler tied to a version bump), reads and writes happen inside a **transaction** scoped to specific stores, and an **index** is a secondary lookup structure on a store, letting you query by a non-primary field without scanning every record.

**When to actually reach for it:** offline-capable data that needs to survive and later sync (a queue of writes made while offline), datasets too large or too structured for `localStorage`, or data you need to query rather than fetch by exact key. **Not** a default replacement for a handful of small key-value flags — `localStorage` (or, for tab-scoped state, `sessionStorage`) is still the right, simpler tool for "remember the user's theme preference."

---

# PART E — Streams

## Q: Why do streaming APIs exist, and when do they beat waiting for the full response?

**Answer.** The default request/response model treats a payload as an atomic blob: `await response.json()` doesn't resolve until every byte has arrived. That's wrong for two shapes of problem — payloads that are large enough that buffering all of it in memory is wasteful, and payloads that are useful incrementally, where showing the first part sooner materially improves the experience (a large file download's progress bar, or text arriving token-by-token from an LLM). **Streams let you process data as chunks arrive instead of waiting for the whole thing.**

`ReadableStream` is the platform primitive. `fetch`'s `response.body` is one:

```javascript
async function streamWithProgress(url, onChunk) {
  const response = await fetch(url);
  const total = Number(response.headers.get('content-length'));
  let received = 0;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    onChunk(decoder.decode(value, { stream: true }), received / total); // progress, before the full body has arrived
  }
}
```

A common real variant: the server streams newline-delimited JSON (NDJSON), and the client parses complete lines as they arrive rather than waiting for the entire response to buffer and `JSON.parse` it in one shot:

```javascript
async function readNdjson(response, onRecord) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line) onRecord(JSON.parse(line)); // each record usable the moment it fully arrives
    }
  }
}
```

This is the same platform-level idea that streaming SSR and React Suspense's streaming HTML rely on — sending usable pieces of a response before the whole thing is ready, rather than an all-or-nothing payload. `./04-react-data.md` covers that framing at the React layer; this section is the raw platform mechanism underneath it.

---

# PART F — Web Components / Shadow DOM

## Q: What do Web Components actually give you, and when are they the right call?

**Answer.** Two distinct primitives, both solving the same underlying problem: shipping a UI element that works the same way regardless of what framework — or no framework — the consumer is using.

**Custom elements** let you define your own HTML tag (`<my-widget>`) backed by a class with lifecycle callbacks (`connectedCallback`, `disconnectedCallback`, `attributeChangedCallback`) — the browser itself instantiates and manages it, the same way it manages `<video>` or `<select>`.

**Shadow DOM** gives that element **real encapsulation** — a genuinely separate DOM subtree with its own style scope. Styles defined inside it cannot leak out to the host page, and the host page's styles cannot leak in (with a few deliberate exceptions, like inherited properties and CSS custom properties, which do cross the boundary). That's a materially stronger guarantee than CSS Modules or BEM, both of which are **naming conventions** that avoid collisions by discipline — they don't stop a global `* { box-sizing: ... }` rule or a `!important` from a totally unrelated stylesheet from reaching in.

```javascript
class RatingBadge extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        /* This never leaks to the host page, and the host page's CSS never reaches in here */
        span { font-weight: 700; color: goldenrod; }
      </style>
      <span>★ ${this.getAttribute('score')}</span>
    `;
  }
}
customElements.define('rating-badge', RatingBadge);
```

```html
<rating-badge score="4.8"></rating-badge>
```

**When this is genuinely the right tool:** a single widget that has to be embedded across multiple, unrelated consumers — a React app, a Vue app, a plain-HTML marketing page — where shipping one framework-agnostic artifact beats maintaining React and Vue and vanilla versions of the same thing. Design-system primitives meant to outlive any one framework's adoption cycle are the other real case.

**Be honest about the narrower fit here:** for most internal application UI, where the entire app is already one framework, Web Components add real ceremony — no JSX, weaker TypeScript ergonomics around custom elements, styling that has to deliberately opt back into sharing tokens with `::part()` or CSS custom properties — for encapsulation you already get for free from component boundaries and CSS Modules/Tailwind discipline. This is a narrower recommendation than the rest of this document: reach for it when cross-framework distribution is the actual requirement, not as a general alternative to React components.

---

# PART G — Cross-tab and misc

## Q: How do you keep multiple open tabs in sync — e.g. logging out in one tab should log out all of them?

**Answer.** `BroadcastChannel` exists for exactly this: same-origin tabs, windows, and workers can post messages to each other with no server round trip.

```javascript
// In every tab
const channel = new BroadcastChannel('auth');

function logout() {
  clearSession();
  channel.postMessage({ type: 'logout' });
  window.location.href = '/login';
}

channel.onmessage = (event) => {
  if (event.data.type === 'logout') {
    clearSession();
    window.location.href = '/login'; // other tabs follow without their own logout click
  }
};
```

A `storage` event listener on `window` (fired in *other* tabs when `localStorage` changes) is the older, more limited way to achieve a similar effect and is worth knowing exists, but `BroadcastChannel` is the more direct tool when the intent is genuinely "tell my other tabs something happened."

**Worth naming without going deep:** the Permissions API, Geolocation, Notifications, Clipboard, and similar device-adjacent APIs all follow the same shape — request permission (async, user-gated), then use the capability if granted, handle rejection gracefully. That pattern is the entire transferable insight; the individual APIs are documentation lookups, not something worth memorizing at interview depth.

---

# PART H — What actually gets asked

**"When would you reach for a Web Worker instead of just `async`/`await`?"**
Async/await changes *when* work runs relative to other queued work on the same thread — it never moves work off that thread. A Web Worker is a separate thread. Reach for one only when the bottleneck is genuinely CPU-bound synchronous computation long enough to visibly block a frame — large sorts/parses, image or signal processing. A `fetch` call, a `setTimeout`, anything already I/O-bound gains nothing from a worker; it's already not blocking the main thread. And remember the real cost of a worker: message-passing clones data by default (structured clone), so a worker doesn't pay for itself on data that's cheap to compute but expensive to copy back and forth — unless you use transferables.

**"Explain the Service Worker update problem and how you'd handle it."**
A new Service Worker installs into a **waiting** state and won't activate while any open tab is still controlled by the previous version — by design, so a page's script layer never changes mid-session without opting in. That means users can sit on a stale version indefinitely if they never close the tab. Handle it either by calling `skipWaiting()` + `clients.claim()` for immediate takeover (fine for pure static-asset shells, riskier if old and new versions expect different app state), or — the more careful option — detect the waiting worker via the `updatefound` event, surface a "new version available, refresh to update" prompt, and let the takeover happen on the user's terms.

**"Why would you choose IndexedDB over `localStorage` for [large dataset / offline queue / structured data]?"**
Name the three concrete limits `localStorage` has that matter at that scale: synchronous (blocks the main thread on every access), string-only (forces manual serialization and loses types like `Date`), and capped around 5–10MB with no query capability beyond exact-key lookup. IndexedDB is async, stores structured data without a serialization step, scales to a large share of disk, and supports indexes for querying by non-key fields — which is exactly what an offline write-queue or a large local dataset needs and `localStorage` structurally cannot provide. Mention that nobody reasonable hand-writes the raw callback API in production — `idb` or similar wraps it in promises — but be ready to name the underlying model (object stores, transactions, indexes) to show you know what's underneath the wrapper.

---

## The six sentences worth memorising

1. **Async is concurrency, not parallelism** — `await` never moves work off the main thread; only a Worker does that.
2. **`postMessage` clones by default (structured clone)** — `Transferable` objects like `ArrayBuffer` transfer ownership instead, and the sender loses access.
3. **Service Workers split `install` and `activate`** specifically so an open tab's script layer never changes mid-session without an explicit `skipWaiting()`/`clients.claim()` opt-in.
4. **A Service Worker adds zero offline benefit by itself** — offline support is entirely the caching strategy you write inside its `fetch` handler.
5. **`localStorage` is synchronous, string-only, and capped around 5–10MB; IndexedDB is async, structured, and indexable** — reach for IndexedDB only past that scale, not as a default.
6. **Shadow DOM is real style/DOM encapsulation, not a naming convention** — unlike CSS Modules or BEM, it stops leakage in both directions by construction.

For network mocking in tests (MSW, fake timers around debounce/throttle), see [`./10-testing.md`](./10-testing.md). For caching layers in a system-design context (browser → CDN → server → database), see [`./12-production.md`](./12-production.md) — this document stays scoped to the client-side platform APIs themselves.

---

*Back to the [answer bank index](./README.md)*
