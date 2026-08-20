# Reading Performance Tools

Extends [`../frontend-knowledge-map.md`](../frontend-knowledge-map.md) §9 (React — Performance) and §15 (Performance & Core Web Vitals). Both sections, and the corpus behind them, say "use the Profiler" and "measure Core Web Vitals" as if the tools were self-explanatory once opened — they aren't. This is a practical-skill document, not a concept list: it teaches how to actually read a flame chart, a heap snapshot, and a network waterfall, which is exactly where candidates who can recite "measure first" fail live debugging rounds.

---

# PART A — React DevTools Profiler: reading the flame chart

### Q: What does the flame chart actually show, element by element?

**Answer.** Record an interaction, and the Profiler draws one flame chart per **commit** — each vertical column along the top ruler is a separate commit, and clicking a column shows that commit's tree below it. Inside one commit's tree, three visual properties carry three different facts:

- **Width** = how long that component's render took, in that commit. A wide bar took a long time; a hairline bar rendered near-instantly.
- **Color** = relative cost within that commit, on a gradient from grey (didn't render this commit) through yellow to orange and red (the default theme) — the more saturated/red, the more expensive relative to the rest of the tree in *that specific commit*. Color is relative, not absolute — a red bar in a fast commit can still be objectively fast.
- **Vertical position** = depth in the component tree. A bar directly under another is its child; siblings sit at the same depth.

**The workflow that actually finds the bug:** record → scan the columns for the commit that looks wrong (widest total width, or a commit that fires when you didn't expect a render at all) → within that commit, find the widest/most-saturated bar → click it → read "why did this render" → form a hypothesis → fix → re-record and diff the before/after commit widths. That last step — re-recording and comparing — is the part people skip, and it's the only way to know the fix actually worked instead of just feeling right.

### Q: What does "why did this render" actually tell you?

**Answer.** Click a bar and the right-hand panel (with "Record why each component rendered" enabled in settings, the checkbox flag referenced in [`./02-react-core.md`](./02-react-core.md)) lists the specific cause for *that render, that component*: which props changed (with the old and new value shown side by side), whether state changed, whether hooks changed, or whether it re-rendered because its parent did with no relevant prop change at all — "The parent component rendered" with nothing else listed is the tell for a pure cascade.

This turns "it re-rendered but I don't know why" from a guessing exercise into a direct read. You are not inferring from prop diffs by eye or adding `console.log` to a render body — the panel names the exact trigger. If it says a prop object changed and you didn't intend for it to, you now know precisely where to add `useMemo`/`useCallback` rather than sprinkling `React.memo` and hoping.

### Q: Ranked view vs flame chart view — when do you reach for each?

**Answer.** They answer different questions.

- **Ranked chart** — a flat, sorted bar list of every component in the selected commit, longest render first, with no tree shape at all. Reach for this when the question is *"what is the single most expensive component in this commit"* — you don't care where it sits in the hierarchy, only which one to investigate first.
- **Flame chart** — preserves the tree shape, so width is distributed across parent/child relationships. Reach for this when the question is *"how does cost flow through the hierarchy, and where in the tree does the real work happen"* — you need position, not just a sorted magnitude.

Start in ranked view to find the worst offender by raw duration, then switch to flame chart on that same commit to see *where in the tree* it sits and whether its cost is its own or inherited from children.

### Q: What does "Highlight updates when components render" show you, and how is it different from the flame chart?

**Answer.** This is a checkbox in the Profiler's settings (gear icon) that works *outside* a recording — turn it on and just use the app normally. Every time a component re-renders, DevTools draws a brief colored outline directly around that component **in the actual page**, not in a separate panel: the outline color shifts from a cool blue/teal for infrequent renders toward orange/red the more rapidly a given element is re-rendering. This is the fastest possible check for "is anything re-rendering that visibly shouldn't be" — click around the real UI and watch for outlines flashing around parts of the screen that didn't change, like a sidebar lighting up every time you type into an unrelated search box.

It's a triage tool, not a measurement tool: it tells you *what* is re-rendering, in real time, with zero setup, but not *how expensive* each render was or *why* it happened — for those two questions you still need a recorded session and the flame chart / "why did this render" panel from above. The practical order: flip this on first to spot obviously-wrong re-render patterns by eye in ten seconds, then record a session and use the flame chart once you know roughly where to look.

**The trap:** a wide bar on a **parent** component is very often just the sum of its children's render times bubbling up visually, not evidence that the parent's own render function is slow. A `<Dashboard>` bar spanning 40ms doesn't mean `Dashboard`'s own body is doing 40ms of work — it means everything under it, added together, took 40ms. Don't stop at the widest top-level bar. Drill down: look at which *child* bars concentrate the width, and keep descending until you reach a bar whose width isn't explained by its own children's widths. That leaf (or near-leaf) is the actual offender. Fixing the parent when the cost lives three levels down wastes the fix.

### Q: What does the commit timeline at the top of the Profiler actually tell you, before you even open a flame chart?

**Answer.** Above the flame chart is a strip of thin vertical bars — one per commit during the recording, height roughly proportional to that commit's total render duration. This is the first thing to scan, before drilling into any single commit: a tall bar sitting where you didn't expect one at all is often more informative than a tall bar you were expecting. If you typed one character into a search box and the strip shows five commits instead of one, that's not a slow-render problem, it's a **too-many-renders** problem — something is triggering repeated state updates for a single interaction, and no amount of memoizing the expensive commit will fix five unnecessary commits. Count the bars before you measure their height; the count answers "should this have rendered at all," the height answers "was this render expensive."

---

# PART B — Chrome Performance panel: the main thread

### Q: What is a "long task," and why is 50ms the line?

**Answer.** Record a Performance profile and look at the **Main** thread track — a horizontal timeline of everything the main thread did, laid out as nested blocks (call stack depth = nesting). Any single task that blocks the main thread for more than 50ms is flagged as a **long task**: Chrome draws a small red triangle in the top-right corner of that block, and the block itself often gets a red hatched border.

50ms isn't arbitrary — it's the threshold beyond which a task, if it happens to run while the user is trying to interact, makes that interaction feel non-instant rather than instant. It's the practical budget baked into how **INP** (Interaction to Next Paint) gets measured: an interaction's total latency is input delay + processing time + presentation delay, and a main thread occupied by a task longer than 50ms directly inflates the input-delay component for anything queued behind it. Spotting a cluster of red-triangled blocks on the timeline during a click is the visual equivalent of a bad INP score before you've even computed the number.

### Q: Call Tree, Bottom-Up, and Flame Chart — what's each view actually for?

**Answer.** All three views can be built from the same recorded data, and they answer different questions:

- **Call Tree (top-down)** — starts from the roots (event handlers, `requestAnimationFrame` callbacks, etc.) and lets you expand into what each one called. Answers *"what got invoked, and how much total time did it plus everything it called take?"* Good for understanding the shape of *one* logical operation you already suspect — click on a handler and expand downward.
- **Bottom-Up (inverted)** — flips the tree so the **leaves** are at the top: it groups by function regardless of where in the call graph it was invoked from, and shows self time first. Answers *"which specific function burned the most time across the entire recording, no matter who called it?"* This is the fastest route to your actual hot function — you don't need a hypothesis about where the problem is, you just read the top row.
- **Flame Chart** — the visual timeline itself (same shape as the Main thread track, but interactive and zoomable). Answers *"when did things happen, relative to each other?"* Use it to spot patterns invisible in either tree view — e.g., three separate "long tasks" that are actually one logical operation the browser split across yield points, visible because the three blocks sit contiguously and share a common caller a level up.

**Practical order:** Bottom-Up first to find the hot function by self time, then Call Tree or Flame Chart to understand *why* it's being called so often or from where.

### Q: Self time vs total time — precisely, and the trap.

**Answer.** **Total time** for a function includes its own execution plus everything every function it called took, transitively. **Self time** is only the function's own code, with all called-function time subtracted out.

**The trap:** a function can show a huge total time and a tiny self time — that function isn't the problem, something it calls is. If you "optimize" the function with the big total-time number by, say, memoizing its own body, you gain almost nothing, because almost none of that time was ever spent in its own code. The Bottom-Up view exists specifically to route around this trap: it sorts by self time, so the function actually consuming the CPU surfaces directly, regardless of how deep in the call graph it sits or how innocent its caller looks in the Call Tree.

**A worked example of the trap, with numbers.** Say `handleSubmit` shows Total 400ms / Self 5ms in the Call Tree — nearly all of it is in what it calls. Expanding it: `validateForm` (Total 380ms / Self 8ms), which itself calls `deepCloneFormState` (Total 365ms / Self 365ms). The Call Tree makes `handleSubmit` *look* like the 400ms problem because it's the top-level row you clicked into, but its own self time is nearly nothing. Switching to Bottom-Up and sorting by self time puts `deepCloneFormState` at the very top with 365ms self — that's the actual function doing the work (probably a `JSON.parse(JSON.stringify(...))` on a large object, the [SOURCE ERROR] pattern flagged in [`./01-javascript.md`](./01-javascript.md)), and it's three call-frames away from the handler someone would naturally have opened first. Reading Total time only would have sent the investigation into `handleSubmit`'s own code, where there is nothing to fix.

### Q: What do the colored bands in the flame chart mean?

**Answer.** Chrome buckets work into categories and colors the flame chart blocks accordingly — **yellow** for Scripting (your JS running), **purple** for Rendering (style recalculation and layout), **green** for Painting (rasterization and compositing), and **grey** for System/Idle. The exact shade can vary slightly by Chrome version, but the categories are stable.

Reading the color distribution of a long task tells you the fix's category before you read a single function name: a long task that's 80% purple is a **layout thrashing** problem — something is repeatedly forcing synchronous layout (reading `offsetHeight` after writing a style, in a loop, is the classic cause) — and no amount of JS micro-optimization touches it. A long task that's almost entirely yellow is a genuine **compute-bound JS** problem — an actual algorithm to speed up, chunk, or move to a Web Worker. Learning to eyeball "mostly purple" vs "mostly yellow" before diving into function names is the fast triage step.

**Quick reference for triaging by color, before reading a single function name:**

| Color | Category | What it usually means | First thing to check |
|---|---|---|---|
| Yellow | Scripting | Your JS (or a library's) is executing | Bottom-Up view, sorted by self time |
| Purple | Rendering — style/layout | Style recalculation or layout (reflow) | A read-after-write loop; the "Forced reflow" warning below |
| Green | Painting | Rasterization / compositing | Large repainted areas, expensive `filter`/`box-shadow`, non-compositor-friendly animated properties |
| Grey | System / Idle | Browser bookkeeping, or genuinely idle | Not usually actionable — if this dominates, the bottleneck is elsewhere (often network) |

### Q: What's the "Forced reflow" / "Layout Thrashing" warning, and where do you see it?

**Answer.** When the purple layout bands repeat in a tight, sawtooth pattern — write, measure, write, measure, several times in a row within one task — DevTools will often annotate one of the purple blocks directly with a red-bordered warning label reading "Forced reflow" or "Layout was forced before the page was fully loaded." That label is Chrome telling you it detected a **synchronous layout read immediately after a synchronous style write**, which defeats the browser's normal batching of layout work. Click the warning and it jumps you to the offending call in the stack. The sawtooth *shape* itself — narrow alternating purple slivers rather than one consolidated purple block — is the visual signature even before you spot the label: it means something is reading `offsetTop`/`getBoundingClientRect`/`scrollHeight` inside a loop that also writes styles, forcing the browser to resolve layout on every iteration instead of once at the end.

### Q: How do dropped frames show up, separately from long tasks?

**Answer.** Above the Main thread track, the **Frames** track shows one thumbnail-width block per rendered frame. A frame block with a red diagonal stripe through it is a **dropped frame** — the browser missed its paint budget for that frame (roughly 16.7ms at 60fps). This is the metric that matters for scroll and animation jank specifically, and it can look fine on the Main thread track (no single long task) while still showing dropped frames, if the *cumulative* small work across many frames each slightly exceeds budget. When someone reports "scrolling feels janky" rather than "clicking is slow," look at the Frames track's stripe pattern before hunting for a single long task — the cause is usually many small over-budget frames, not one big blocking task.

---

# PART C — Memory panel: heap snapshots

[`./01-javascript.md`](./01-javascript.md)'s memory section covers the *causes* of leaks — uncleared timers, un-removed listeners, retaining closures, detached DOM — and gives the one-line version of this workflow. This section is about actually **proving and locating** one with the tool, one level deeper than "compare two snapshots."

### Q: What's the actual sequence for finding a leak?

**Answer.**

1. **Get to a clean baseline.** Load the page, let it settle, and force a GC (the Memory panel has a trash-can "collect garbage" icon — click it before every snapshot, otherwise you're measuring uncollected-but-reachable garbage, not a leak).
2. **Take snapshot #1.**
3. **Perform the suspected-leaky action several times** — not once. Open and close a modal 5 times, navigate to a route and back 5 times, mount and unmount a component 5 times. Repetition matters because a single occurrence is noise; a pattern across five identical repetitions is signal.
4. **Force GC again, then take snapshot #2.**
5. **Open the Comparison view** (a dropdown at the top of the snapshot panel, switched from "Summary" to "Comparison," pointed at snapshot #1 as the base). This filters the second snapshot down to **objects allocated between snapshot 1 and snapshot 2** — everything else is hidden, so you're looking only at what survived your five repetitions.
6. **Read the `#New` and `#Delta` columns**, sorted by count or by retained size. If you closed the modal 5 times and a class of objects (a detached `HTMLDivElement`, a listener wrapper, an array) shows a delta that's a multiple of 5 and *doesn't* shrink back down after another forced GC, that's not incidental — the count should have returned to baseline if the modal was actually cleaning up after itself. A steadily growing count across repeated identical actions, instead of returning to baseline, is the leak signature.

### Q: How do you find detached DOM nodes specifically, and why are they retained?

**Answer.** In the Comparison (or Summary) view, use the class filter box and type `Detached` — Chrome has a built-in category for DOM nodes that have been removed from the visible document tree (they have no parent, aren't reachable by `document.body`) but are still retained in memory by *something* in JS. A healthy page should show zero or near-zero detached nodes after interaction; a rising count is exactly the "removed from the DOM but a variable still points at it" leak named in [`./01-javascript.md`](./01-javascript.md).

Finding *that* it's detached only tells you it's leaking, not *why*. For why, select the detached node in the list and open the **Retainers** panel underneath — it shows the reference chain keeping that object alive, and you read it **bottom-up**: the selected object at the top, then each row below is "retained by" the row above it, until you reach a row Chrome marks as a GC root (a global, a still-mounted closure, `window`, an active listener). Walking that chain almost always lands on one of: a closure captured by a `setInterval`/`setTimeout` callback that outlived the component, an event listener registered on `window` or `document` that was never removed, or a stale array/cache (a "recently viewed items" list, a DOM-reference cache) that someone pushed the node into and never evicted. The Retainers panel is what turns "I have a leak" into "line X in file Y is holding it," which is the difference between a diagnosis and a guess.

**A concrete retainer chain, read the way it actually appears:** selecting a detached `<div class="modal-backdrop">` might show, top to bottom: `detached HTMLDivElement` → retained by `closure (in handleResize)` → retained by `(closure context)` → retained by `Window / addEventListener("resize", ...)`. Reading bottom-to-top instead — root first — that says: a `resize` listener on `window` was never removed, its callback closes over the modal's backdrop element, and as long as that listener is registered, the whole closure and everything it touches stays reachable no matter how many times the modal itself unmounted. The fix is a `removeEventListener` in the modal's cleanup, not anything to do with the modal's own render logic — which the retainer chain told you directly, without needing to read a single line of the modal's source first.

### Q: Snapshots vs the Allocation Instrumentation Timeline — when would you use the latter?

**Answer.** The two-snapshot Comparison workflow above answers "did a leak happen." The **Allocation instrumentation on timeline** view (a separate recording mode in the Memory panel) answers "exactly *when*, during a recording, did the leaking allocations happen" — it records continuously and renders a bar chart across the recording's timeline, where each blue bar's height is proportional to memory allocated in that window, and bars that stay **blue** instead of fading to **grey** represent memory that's still live at the end of the recording (grey means it was later collected — not a leak). This is the tool for "the leak happens somewhere during this multi-step flow, and I don't know which step" — you record continuously through the whole flow, then click a still-blue region on the timeline to filter the object list down to just the allocations from that narrow window, which narrows "which of my five steps leaked" to one step directly instead of guessing which pair of before/after snapshots to take.

---

# PART D — Lab data vs field data, and setting up RUM

[`./09-system-design.md`](./09-system-design.md) covers the Core Web Vitals targets themselves (LCP/INP/CLS thresholds) and what to fix for each — not repeated here. This section is about *how you actually find out what real users experience*, which is glossed over almost everywhere.

### Q: Why isn't a Lighthouse score enough?

**Answer.** Lighthouse is **lab data**: one run, on one simulated device profile, over one simulated network throttle, usually on a fast CI machine or your own laptop. It's reproducible and great for catching regressions in CI, but it is structurally incapable of representing your actual user distribution — it can't show you the user on a three-year-old Android phone on a spotty subway connection, and that user is real and often a meaningful fraction of traffic. **Field data (RUM — Real User Monitoring)** is measurements taken from actual page loads by actual users, which is the only source of truth for what people are really experiencing. Lab data is for debugging a known regression with a controlled, repeatable setup; field data is for knowing whether you have a problem at all.

### Q: How do you actually wire up RUM? Walk through it.

**Answer.** The piece usually skipped in interviews is the concrete mechanism, so make it concrete:

1. **Install the `web-vitals` library.** It's the Chrome team's own small JS library that listens for the browser-native performance signals underlying each Core Web Vital and normalizes them into one clean API.
2. **Register a callback per metric.** Each callback fires once a metric is *finalized* for that page view — for example, LCP isn't known until the largest paint candidate stops changing, which the library tracks for you, so you don't have to reason about `PerformanceObserver` timing edge cases yourself.
3. **Send the metric with `navigator.sendBeacon`**, not a normal `fetch`. This is the detail that matters: `sendBeacon` is purpose-built to reliably deliver a small payload even as the page is being torn down — the browser queues the request and guarantees it survives navigation. A regular `fetch` call made during `unload`/`pagehide` can be silently cancelled by the browser before the request completes, which is exactly when a lot of these metrics (final CLS, final INP) become available — right as the user is leaving.

```javascript
import { onLCP, onINP, onCLS, onFCP, onTTFB } from "web-vitals";

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,        // "LCP" | "INP" | "CLS" | ...
    value: metric.value,
    id: metric.id,             // unique per page load, lets you dedupe
    rating: metric.rating,     // "good" | "needs-improvement" | "poor"
    navigationType: metric.navigationType,
  });

  // sendBeacon survives page unload; fetch can be cancelled by navigation
  navigator.sendBeacon("/analytics/vitals", body);
}

onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onCLS(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

4. **Aggregate server-side by percentile**, not by average.

**Why reach for the library instead of `PerformanceObserver` directly?** You *can* hand-roll this with the raw `PerformanceObserver` API (`new PerformanceObserver((list) => {...}).observe({ type: "largest-contentful-paint", buffered: true })`), and knowing that this is what the library wraps is worth saying — it demonstrates you understand the primitive, not just the convenience wrapper. But each metric has real edge cases the library already handles: LCP candidates can change as more content paints in, so the "final" value isn't known until the page starts being backgrounded or a user interacts (which stops LCP observation, per spec); CLS needs to distinguish genuine layout shifts from ones the user caused by scrolling or that follow within 500ms of an input; INP needs to track the worst interaction across the whole page session, not just the first one. Reimplementing all of that correctly is real, easy-to-get-subtly-wrong work — which is exactly why "use `web-vitals`, know what it wraps" is the answer that reads as senior rather than "I built it from `PerformanceObserver` myself" with no acknowledgment of the edge cases.

### Q: Why p75, and why not just average the numbers?

**Answer.** An average hides the tail. If 80% of your users get a 1.5s LCP and 20% get a 6s LCP, the mean might land around 2.4s — comfortably under the 2.5s "good" threshold — while a fifth of real people are having a genuinely bad experience that the average made invisible. **p75** (the value below which 75% of page loads fall) is the standard Core Web Vitals reporting percentile precisely because it's resistant to that trick: it forces you to confront the experience of the worse-off majority-minus-a-quarter, not just the well-connected median user. It's also the percentile Google's own field tools (CrUX, PageSpeed Insights field data) report against, so it's the number that lines up with how the rest of the industry — and Search ranking signals — evaluate the same metric.

**The trap:** segmenting away the tail instead of investigating it. A team that reports "our p75 LCP is 2.1s, we're good" while ignoring that p95 is 8s on a specific device tier or geography hasn't actually looked at the data — they've picked the percentile that made the dashboard green and stopped there. p75 is the *reporting* standard because it's a reasonable single number for a scorecard; it is not a reason to stop segmenting by device class, connection type (`navigator.connection.effectiveType`, sent alongside the beacon), and geography when you're actually debugging, because the field data's whole value is in what it reveals about the users the lab data can't represent.

---

# PART E — Network panel: reading a waterfall

[`./04-react-data.md`](./04-react-data.md) covers the request-waterfall problem conceptually (why sequential fetches create staircases). This section is about actually **seeing** it in the Network panel and reading the request bars.

### Q: What do you look for in the waterfall to find a render-blocking resource?

**Answer.** Each request is one horizontal row with a bar showing when it started, how long it took, and — critically — its position relative to other requests and relative to the page lifecycle markers (the vertical lines Chrome draws for **DOMContentLoaded**, in blue, and **Load**, in red, with a similar marker for First Paint/First Contentful Paint when the "Screenshots" filmstrip is enabled above the waterfall).

A render-blocking resource is one that: sits near the top of the waterfall (requested early, in `<head>`), has a long bar (slow to arrive), and — the part that actually makes it blocking — the FCP/first-paint marker sits *after* that bar finishes, not overlapping it. A synchronous `<script>` with no `async`/`defer` behaves the same way: parsing visibly halts at that row until the script's bar completes. Compare that against a resource fetched with `defer`, `async`, or one that's simply below the fold and lazy-loaded — its bar can be long too, but the paint markers land *before* it finishes, so it isn't blocking anything the user sees.

### Q: How do you read request priority in the panel, and how do `fetchpriority`/`preload` change it?

**Answer.** Chrome assigns every request an internal scheduling priority — visible as a **Priority** column in the Network panel (add it via the column-header right-click menu if it's not shown): `Highest`, `High`, `Medium`, `Low`, `Lowest`. This isn't cosmetic — it governs the order the browser actually issues requests in when bandwidth is contended, which is a real cause of the waterfall-shaped delay [`./04-react-data.md`](./04-react-data.md) describes, separate from any code-level sequencing.

Two things move a request up that queue, and you can watch them do it directly in the panel: `<img fetchpriority="high">` on a hero image bumps its Priority column value up and visibly moves its request earlier in the waterfall relative to same-type resources that didn't get the hint; `<link rel="preload" as="...">` does the same by telling the browser about a critical resource *before* the parser would otherwise discover it (e.g., a font referenced only inside CSS, which the browser can't know about until the CSS itself has downloaded and parsed) — you'll see the preloaded request's bar start noticeably earlier than it would via normal discovery order.

### Q: What's the Initiator column for, and how does it help with an unexpected request?

**Answer.** The **Initiator** column (next to Priority, also added via the column picker if hidden) names *what caused* each request — a specific line in a specific source file, `Parser` for something discovered directly in HTML, or another request for a chain (a CSS file that itself requested a font). Click the initiator link and DevTools jumps you to the exact call site in the Sources panel. This is the fast answer to "why is this third-party script loading at all, and who's asking for it" — instead of grepping the codebase for the URL, click the row and read the initiator chain directly. It's also how you actually confirm a waterfall is component-tree-shaped rather than something else: if request B's initiator is a script that only ran after request A's response was processed, that's the fetch-on-render pattern from [`./04-react-data.md`](./04-react-data.md) made visible — click through and you'll usually land on a `useEffect` or a `.then()` callback.

### Q: Waterfall view vs the summary bar at the bottom — what does each add?

**Answer.** The row-by-row waterfall (Part E's main subject) tells you about individual requests. The **summary footer** at the bottom of the Network panel aggregates: total requests, total transferred size, total resource size (uncompressed), and — the two numbers worth reading first on any "why is this slow" investigation — **DOMContentLoaded** and **Load** times, each also drawn as a vertical line across every row above. Before drilling into any single request's bar, glance at where those two lines sit: if `Load` is at 8s but the visible content appeared (per the filmstrip) at 1.5s, the page is *usably* fast even though the network tab "looks slow" — a lot of that 8s might be non-blocking analytics and below-the-fold images the user never waited on. Reading the summary line first prevents chasing a request that never actually delayed anything the user cared about.

### Q: How do you tell TTFB apart from client-side slowness, just from the waterfall?

**Answer.** Look at the first segment of a request's bar — before the colored "content downloading" portion, there's typically a lighter or grey/green leading segment representing time spent waiting: DNS lookup, connection, SSL, and then **Time to First Byte** — the gap between the request being sent and the first byte of the response coming back. Hovering a request row shows this broken out explicitly:

| Segment | What it means | Who owns fixing it |
|---|---|---|
| Queueing / Stalled | Browser hasn't dispatched it yet — connection limits, higher-priority requests ahead of it | Frontend — priority hints, HTTP/2 multiplexing, fewer origins |
| DNS Lookup | Resolving the hostname | Infra/DNS provider |
| Initial Connection / SSL | TCP + TLS handshake | Infra — connection reuse, `preconnect` |
| **Waiting (TTFB)** | Request sent, waiting for the first response byte | **Backend** — server logic, DB query, cold start |
| Content Download | Streaming the response body | Frontend/CDN — compression, payload size |

A long **Waiting (TTFB)** segment on the main document request specifically is a server-side signal — the backend took a long time to generate the response, or the database query behind it was slow, or there's a slow origin/CDN cold-start. No amount of frontend code changes touches that segment; it means the bottleneck isn't your bundle, your React tree, or your rendering strategy at all — it's upstream. This is the single fastest way to rule the entire frontend in or out of a slowness investigation before spending any time in the Performance or React panels.

---

# PART F — Bundle analysis

### Q: How do you read a bundle treemap?

**Answer.** Tools like `source-map-explorer`, `webpack-bundle-analyzer`, and `rollup-plugin-visualizer` all render the same basic shape: a **treemap**, where each box is a module or package, **box area is proportional to the bytes it contributes** to the final output, and boxes are **nested** to mirror the module/dependency hierarchy — a package's box contains the boxes of the files inside it.

Two things to scan for immediately: **one disproportionately large box** relative to how small its role in the app is (a date-formatting library taking up a bandwidth budget that suggests it pulled in a locale database you don't need, a chart library imported for one small sparkline pulling in every chart type it supports) — that's a signal to check whether a lighter alternative or a more targeted import path exists. And **the same package name appearing as two separate boxes**, usually at two different version numbers when you hover them — this is a duplicate-dependency bug, almost always caused by a semver mismatch between something you depend on directly and something a transitive dependency pulled in independently, so the package manager couldn't dedupe them into one shared copy. Two copies of the same library, each contributing their own weight to the bundle, is a pure loss with no benefit — the fix is usually a lockfile-level override/resolution pinning both consumers to the same version.

### Q: What does the treemap NOT tell you, and how do you avoid being misled by it?

**Answer.** Most analyzers default to showing **uncompressed** byte size (sometimes minified, sometimes not, depending on the tool and whether it runs pre- or post-minification), while what actually crosses the network is **gzip or Brotli compressed** size. A box that looks enormous uncompressed — highly repetitive generated code, like a big icon-font glyph table or a large JSON schema — can compress extremely well and cost far less on the wire than its box area suggests, while a box of already-dense, high-entropy code (already-minified third-party bundles, WASM, image data mistakenly inlined as base64) compresses poorly and costs closer to its displayed size. Most analyzers (`webpack-bundle-analyzer`, `source-map-explorer` with the right flag) can toggle a "show gzip size" mode — check that toggle before deciding a box is worth the effort to shrink, otherwise you can spend real time trimming a box that was never actually expensive on the wire.

The other trap: a treemap taken **after** tree-shaking and minification already ran shows you what survived, not what was eliminated — it can look clean while hiding the fact that an entire heavy module got included because one function from it, used once, prevented the bundler from shaking the rest of the module away. If a package's box is smaller than you'd expect for "the whole library" but still present, that's often exactly this: named-export usage that should have enabled shaking but didn't, usually because the package itself isn't marked `"sideEffects": false` in its `package.json` or ships CommonJS instead of ESM.

---

# PART G — A worked "diagnose this slow page" walkthrough

### Q: "This page feels slow." Walk me through how you'd find out why.

**Answer — order matters as much as the tools themselves.** Guessing which tool to open first is what separates "knows the concepts" from "has actually debugged this."

1. **Reproduce and quantify before touching any tool.** "Slow" is not a starting point. Which metric — load time, a specific interaction lag, jank during scroll? On what device and network — your dev machine on office wifi is not representative? Get a number and a repro before diagnosing anything.
2. **Lighthouse for a first-pass lab read.** Cheap, fast, and gives you a rough category (loading vs interactivity vs layout shift) and a prioritized list of audits to chase, even though it's not the final word (see Part D).
3. **Network panel next, to rule out — or confirm — a loading/server problem.** Check TTFB on the document request (Part E) and scan for render-blocking resources before assuming the problem is in your JS at all. If TTFB is high, the investigation moves to the backend, and everything below is moot.
4. **Performance panel main-thread recording, if it's specifically an interaction or responsiveness complaint.** Record the janky interaction, find the long tasks (Part B), and read whether the flame chart's colored bands skew yellow (JS-bound) or purple (layout-bound) — that alone tells you which of the next two steps to take.
5. **React DevTools Profiler, only if the Performance panel points at React render work specifically** (heavy yellow/scripting time that Bottom-Up traces into React internals or your own component functions). Don't open the Profiler first out of habit — open it once you have evidence the problem is render work, then use Part A's workflow to localize it in the tree.
6. **Memory panel, only if the symptom is growing-over-time rather than one-off slowness** — the page starts fine and degrades the longer it's open, or after repeating an action. That shape is the leak signature from Part C; a one-off slow interaction is not a memory investigation and starting there wastes time.

**Why this order:** each step is cheap-to-expensive and general-to-specific. Quantifying costs nothing and prevents chasing a phantom. Lighthouse and the Network panel rule out entire categories (server, loading) in minutes. Only after those are cleared do you pay the cost of a targeted main-thread recording, and only after *that* points at React specifically do you pay the cost of profiling component renders. Jumping straight to the React Profiler on a report of "the page is slow" is the single most common wasted-effort move — the problem is frequently server TTFB or a render-blocking script, not a single component.

**Step 7, the one people skip: verify the fix against the same tool that found the problem, not a different one.** If you found the issue as a wide red bar in the React Profiler, the proof it's fixed is a re-recorded profile showing that bar shrink or disappear — not "the page feels faster now." If you found a render-blocking stylesheet in the Network waterfall, the proof is the FCP marker moving earlier in a re-recorded waterfall. Fixing the diagnosed cause and re-measuring with the *same instrument* closes the loop; skipping it is how a fix that felt right ships without evidence it actually moved the number, and regresses silently later.

---

# PART H — What actually gets asked

### Q: "Walk me through how you'd find out why this page is slow."

**Answer.** This is Part G verbatim, spoken aloud: quantify first, Lighthouse for a first pass, Network panel to rule server/loading in or out, Performance panel for main-thread work if it's an interaction complaint, React Profiler only once the Performance panel implicates React specifically, Memory panel only for a growing-over-time symptom. State the order and the reason for the order — the reasoning is the actual signal being graded, not the tool names.

### Q: "How do you tell the difference between a rendering problem and a network problem, just from what you see in DevTools?"

**Answer.** Two different panels, two different signatures, and you don't need to guess — read them directly.

- A **network problem** shows up as: a long **Waiting (TTFB)** segment on the document or a key data request (Part E), and/or a visibly long, early-positioned bar in the waterfall that sits before the FCP marker with nothing else running on the main thread while it happens. The Performance panel's main thread track is mostly idle (grey) during that window — the browser is simply waiting on the network, not doing work.
- A **rendering problem** shows up as: the Performance panel's main thread track full of activity during the slow window, with long-task triangles, and the colored bands telling you which kind — yellow-dominant means JS execution (very possibly React render work, confirmable in the Profiler), purple-dominant means style/layout thrashing.

The one-sentence version worth saying in the room: *"if the main thread is idle while it's slow, it's the network; if the main thread is busy while it's slow, it's rendering — and the color of what's busy tells you whether that's JS or layout."*

---

## The seven sentences worth memorising

- In the React Profiler, width = render duration, color = relative cost in that commit, position = tree depth, and a wide **parent** bar is usually just its children's widths summed — drill down before blaming the top of the tree.
- "Why did this render" names the exact prop/state/hook/context cause for that render; use it instead of eyeballing prop diffs.
- In the Performance panel, Bottom-Up sorted by self time finds your actual hot function fastest — Call Tree total time on a function often just reflects what it *called*, not what it *did*.
- A long task gets a red triangle past 50ms because that's the threshold tied to how INP measures input responsiveness; read the flame chart's color (yellow = script, purple = layout, green = paint) to triage the category before reading function names.
- Finding a leak is Comparison-view snapshot diffing across repeated actions, and finding *why* it's retained is reading the Retainers panel bottom-up from the detached node back to the root holding it.
- RUM is `web-vitals` callbacks fired per finalized metric, shipped via `navigator.sendBeacon` (because a normal `fetch` can be cancelled by the very page-unload that triggers the metric), aggregated at p75 because an average hides the bad tail.
- Diagnose a slow page in order — quantify, Lighthouse, Network, Performance main-thread, React Profiler, Memory — cheapest and most general first, most specific and most expensive last.

---

*Back to the [answer bank index](./README.md)*
