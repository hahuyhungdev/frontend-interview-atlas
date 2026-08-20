# React — Data Fetching, State & TypeScript

Fills the ○ items in §11–§12 of the [knowledge map](../frontend-knowledge-map.md). The corpus is frozen around 2021: it frames rendering as a CSR/SSR/SSG menu, treats state management as "which library," and treats TypeScript as annotation syntax. All three framings are now out of date, and this is where a 2026 senior interview will probe if the interviewer is current.

---

## The one idea underneath everything here

> **Where data is fetched determines your architecture — more than which framework or store you picked.**

Rendering strategy is downstream of that question. So is bundle size. So is perceived performance.

---

## Q: What is the request waterfall, and why is it the dominant performance problem?

**Answer.** A component fetches. It renders a child. The child fetches. It renders a grandchild, which fetches.

```
Page mounts ──► fetch user      (200ms)
                └──► fetch user's orders   (200ms)
                     └──► fetch order items (200ms)
                                                    600ms of blank screen
```

Each request can't start until its parent's resolved — not because of any real dependency, but because the *component tree* is the fetch tree. The network was idle for most of that 600ms.

This is far more impactful than re-render optimization, and it's invisible in the React Profiler because it isn't a rendering problem. It shows up in the Network tab as a staircase.

**The four fixes — and this is the real architectural axis:**

**1. Hoist the fetch.** Fetch everything the route needs at the route level, in parallel.
```javascript
const [user, orders, settings] = await Promise.all([
  fetchUser(id), fetchOrders(id), fetchSettings(id),
]);   // 200ms total, not 600ms
```

**2. Colocate the *declaration*, hoist the *execution*.** The best of both: components declare their data requirements, the router collects them and fetches up front. This is what React Router loaders, Relay fragments, and RSC each do in their own way. Components stay self-describing; requests stay parallel.

**3. Preload on intent.** Start fetching on link hover or when a link enters the viewport. By the time the user clicks, the data is often already there. This is the cheapest large win available in most apps and almost nobody does it.

**4. Stream.** Send the shell immediately, fill regions as their data resolves. The user sees progress instead of a spinner.

**The general principle:** the component tree is a *rendering* hierarchy. Treating it as a *fetching* hierarchy is what creates waterfalls. Decouple them.

---

## Q: What are Server Components, and what problem do they solve?

**Answer.** A Server Component runs **only on the server**. It can query a database directly, and **it ships zero JavaScript to the browser for itself** — the client receives the rendered output, not the component code.

It attacks both costs at once:

```jsx
// Server Component — no client JS, no round trip, no waterfall
async function ProductPage({ id }) {
  const product = await db.product.findUnique({ where: { id } });  // direct DB access
  return (
    <article>
      <h1>{product.name}</h1>
      <AddToCartButton productId={id} />   {/* Client Component — this one ships JS */}
    </article>
  );
}
```

```jsx
"use client";   // the boundary marker
function AddToCartButton({ productId }) {
  const [pending, setPending] = useState(false);   // state ⇒ must be a client component
  ...
}
```

**How to reason about the split:** Server Components for data fetching, static content, and anything importing a heavy library used once (a Markdown renderer, a syntax highlighter, a date library — all stay on the server). Client Components for interactivity: state, effects, event handlers, browser APIs.

`"use client"` is a **boundary**, not a per-file toggle. Everything imported below it goes to the client too. So push it as far down the tree as you can — a common mistake is marking a whole page and losing the entire benefit.

**The honest trade-offs**, which is what an interviewer wants:
- Two execution environments with different capabilities; you must know which one your code is in.
- Props crossing the boundary must be **serializable** — no functions, no class instances, no Dates in some setups.
- Harder mental model, harder debugging, framework lock-in (practically Next.js or a comparable framework).
- **Not always the right choice.** For an auth-gated dashboard with no SEO requirement and heavy interactivity, a plain SPA is simpler and just as good.

**What to say if asked "should we use RSC?"** — "It's a strong fit for content-heavy, SEO-relevant, read-mostly apps where bundle size and data latency dominate. It's a poor fit for a highly interactive internal tool. The question is which cost dominates for *this* product." That framing matters more than the API details.

---

## Q: How does Suspense-based streaming change perceived performance?

**Answer.** Classic SSR is all-or-nothing: the server waits for *every* data dependency, then sends the whole HTML. One slow query holds the entire page.

Streaming SSR sends the shell immediately and streams each region in as it resolves:

```jsx
export default function Dashboard() {
  return (
    <>
      <Header />                                  {/* instant */}
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />                                 {/* streams in when ready */}
      </Suspense>
      <Suspense fallback={<FeedSkeleton />}>
        <Feed />                                  {/* independent — doesn't block Stats */}
      </Suspense>
    </>
  );
}
```

Each `<Suspense>` is an **independent loading boundary**. A slow feed no longer delays the stats.

**The design insight:** Suspense boundaries are a *product* decision, not a technical one. You're choosing what the user sees first and what they can wait for. Too few boundaries and you're back to all-or-nothing; too many and the page flickers together in a distracting jumble. Group by what the user needs first.

**Use skeletons that match the final layout**, not spinners — same footprint, so nothing shifts when content arrives (CLS stays at zero).

**Related client-side APIs:**
- `useTransition` — mark an update as non-urgent so typing stays responsive while an expensive list re-renders.
- `useDeferredValue` — render the expensive consumer with a lagging value while the input updates instantly.

Both address INP directly, and both are the modern answer to "how do you keep the UI responsive during heavy rendering" — better than debouncing the state update, because they let React prioritize rather than delay.

---

## Q: Why is server state different from client state?

**Answer.** This is the reframe that dissolves most "state management is hard" pain.

**Server state is not your state. It's a cache of someone else's state.**

The truth lives in a database you don't control, it can change without telling you, other users are mutating it, and your copy starts going stale the instant it arrives. Client state is nothing like that — it's yours, it's authoritative, and it changes only when you change it.

Copying server data into Redux means you have built a cache while pretending you haven't. Then you hand-maintain it, and every bug is a cache bug you didn't plan for.

Once you name it a cache, the right questions become obvious — and they're exactly the features TanStack Query and SWR provide:

| Cache question | The feature |
|---|---|
| When is it stale? | `staleTime` |
| When do we refetch? | On mount, on window focus, on reconnect, on interval |
| What shows while revalidating? | Stale data + a background indicator — not a spinner |
| What invalidates it? | `invalidateQueries` after a mutation |
| Do two components asking for the same thing make two requests? | Automatic deduplication |
| What about errors and retries? | Built-in retry with backoff |

```javascript
const { data, isPending, isError } = useQuery({
  queryKey: ["orders", userId],
  queryFn: () => fetchOrders(userId),
  staleTime: 60_000,
});

const mutation = useMutation({
  mutationFn: updateOrder,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders", userId] }),
});
```

**The takeaway to state in an interview:** "Which state library?" is the wrong first question. The right one is "which *kind* of state is this?" Most apps need a server-state library plus `useState` — and often no global client store at all.

---

## Q: The four kinds of state — where does each belong?

| Kind | Truth lives | Store it in | Examples |
|---|---|---|---|
| **Server** | Remote DB | A query cache (TanStack Query, SWR, RSC) | Users, orders, products |
| **Client** | Memory | `useState`, or Zustand/Jotai if global | Modal open, theme, sidebar collapsed |
| **URL** | The address bar | Router search params | Filters, sort, page, tab, search query |
| **Form** | The inputs | React Hook Form, or `useState` | Draft values, validation, dirty state |

**The most under-used of the four is URL state.** Filters, sort order, pagination, active tab, search query — put them in the URL and you get, for free:

- **Shareable links** — send a colleague the exact filtered view
- **Working back/forward buttons** — the single most common UX complaint about SPAs
- **Reload persistence** without any storage code
- **Bookmarkability**, and server-renderability

```javascript
const [searchParams, setSearchParams] = useSearchParams();
const page = Number(searchParams.get("page") ?? 1);
const sort = searchParams.get("sort") ?? "date";

// updating navigates — history and sharing work automatically
setSearchParams((prev) => { prev.set("page", String(page + 1)); return prev; });
```

**The rule of thumb:** *if a user would reasonably want to send this view to someone, it belongs in the URL.* Applying that one heuristic is a strong seniority signal, and it costs nothing.

---

## Q: How do optimistic updates work, and when are they wrong?

**Answer.** Apply the change to the UI immediately, send the request in the background, roll back if it fails. The interaction feels instant because it *is* instant locally.

```javascript
const mutation = useMutation({
  mutationFn: toggleLike,
  onMutate: async (postId) => {
    await queryClient.cancelQueries({ queryKey: ["post", postId] });  // stop in-flight refetch
    const previous = queryClient.getQueryData(["post", postId]);      // snapshot for rollback
    queryClient.setQueryData(["post", postId], (old) => ({
      ...old, liked: !old.liked, likeCount: old.likeCount + (old.liked ? -1 : 1),
    }));
    return { previous };
  },
  onError: (_err, _postId, context) => {
    queryClient.setQueryData(["post", postId], context.previous);     // roll back
    toast.error("Couldn't update. Try again.");                       // and TELL the user
  },
  onSettled: (_d, _e, postId) =>
    queryClient.invalidateQueries({ queryKey: ["post", postId] }),    // reconcile with truth
});
```

**The four steps: cancel in-flight refetches, snapshot, apply, reconcile.** Skipping the cancel is a real bug — a refetch that started before your optimistic write can land after it and overwrite it. That's Model 1's race condition in a new costume.

**When optimistic updates are wrong:** anything where being wrong is costly or embarrassing. Payments, irreversible deletes, inventory ("your order is placed" then it isn't), anything with server-side validation the client can't replicate. Use it for likes, toggles, reordering, adding a todo — low-stakes, high-frequency actions where the failure rate is tiny and rollback is cheap.

**Always show the rollback.** A silent revert is worse than a spinner — the user believes their action succeeded and it didn't.

---

## Q: TypeScript as design, not annotation.

**Answer.** The corpus treats TS as syntax you add to satisfy a linter. Its actual value is **making a category of bug unwriteable.**

**The single most valuable pattern: discriminated unions for state.**

```typescript
// ✗ Four booleans and a nullable = 32 representable combinations, most meaningless
interface State {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  data: User[] | null;
}
// isLoading: true, isError: true, data: [...] — what does that even mean?

// ✓ Four states, and only four
type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: User[] };
```

Now the compiler narrows for you, and the impossible states can't be constructed:

```typescript
switch (state.status) {
  case "loading": return <Skeleton />;
  case "error":   return <Error message={state.error.message} />;  // error exists here
  case "success": return <List items={state.data} />;              // data is non-null here
  case "idle":    return null;
}
```

No optional chaining, no `data!`, no defensive checks. **The shape of the type made the bug impossible rather than caught.** That's the difference between TypeScript as annotation and TypeScript as design.

**Exhaustiveness checking** — the compiler tells you when you add a state and forget to handle it:

```typescript
default: {
  const _exhaustive: never = state;   // compile error if a case is unhandled
  return _exhaustive;
}
```

**Four more patterns worth having:**

```typescript
// 1. Branded types — prevents passing a ProductId where a UserId belongs
type UserId = string & { readonly __brand: "UserId" };

// 2. Never mix units silently
type Cents = number & { readonly __brand: "Cents" };

// 3. Require one of two props, not both, not neither
type Props =
  | { label: string; "aria-label"?: never }
  | { label?: never; "aria-label": string };

// 4. Derive types from values instead of duplicating them
const ROLES = ["admin", "editor", "viewer"] as const;
type Role = typeof ROLES[number];   // "admin" | "editor" | "viewer"
```

**`unknown` over `any`.** `any` switches type checking *off* and propagates silently through everything it touches. `unknown` says "I don't know yet" and forces you to narrow before use. Every API response should start as `unknown` and be validated:

```typescript
import { z } from "zod";
const UserSchema = z.object({ id: z.string(), email: z.string().email() });
const user = UserSchema.parse(await res.json());   // runtime + compile-time truth agree
```

**The idea that ties this together:** TypeScript types are compile-time only — they vanish at runtime and tell you nothing about what the server actually sent. A hand-written `interface User` is a *hope*, not a guarantee. Runtime validation at the boundary (Zod, Valibot) is what makes the type honest. **Validate at the edges, trust the middle.**

---

*Next: [`12-production.md`](./12-production.md)*
