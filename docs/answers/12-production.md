# Production Engineering

The work that never appears in an interview write-up, because nobody interviews on it — and which is most of the actual job. Fills Part 2 of [`../core-insights.md`](../core-insights.md).

---

# PART A — Working in Code You Didn't Write

## Q: You join a team with a 200k-line React app. How do you become productive?

**Answer.** Interviews start from a blank file; the job almost never does. The skill is comprehension speed, and it has a method.

**1. Run it and use it first.** Before reading any code, use the product as a user. You cannot navigate a codebase whose purpose you don't understand.

**2. Follow one feature end to end.** Pick something small and real — "what happens when a user changes their email?" Trace it: the form component → the handler → the API call → the endpoint → the database → the response → the state update → the re-render. **One vertical slice teaches you more than a week of browsing horizontally.**

**3. Read the boundaries, not the internals.** Routes tell you the surface area. `package.json` tells you the technology bets. The data layer tells you the domain model. Skip the internals until you need them.

**4. Use the tools.** `git log --follow` on a confusing file, `git blame` to find who to ask, and the PR that introduced the weird code — the description usually explains it.

**5. Change something small and ship it.** Nothing teaches the build, review, and deploy pipeline like using it. Do this in week one.

**The mindset that matters most: assume the weird code has a reason.** Chesterton's fence — don't remove it until you know why it's there. That defensive `if` you want to delete probably encodes a production incident. Ask, or check the blame. Junior engineers rewrite; senior engineers find out why first.

---

## Q: How do you migrate a large legacy codebase?

**Answer.** Never with a rewrite. Big-bang rewrites fail because you spend a year reproducing behavior nobody documented, while the old system keeps moving.

**The strangler fig pattern:** grow the new system around the old one, route traffic across piece by piece, and remove the old parts once nothing calls them.

**The mechanics:**

1. **Establish a seam.** Put an interface between the old code and its callers. Now you can swap implementations without touching call sites — the adapter is what makes incremental possible at all.
2. **Migrate at a natural boundary** — one route, one feature, one component tree. Ship each independently.
3. **Feature-flag every switch**, so rollback is a config change, not a deploy.
4. **Run both and compare** for high-risk paths — send traffic to old and new, log the differences, fix until they agree, then cut over.
5. **Delete the old path.** The step teams skip, which is how you end up maintaining two systems forever. Migration isn't done until the old code is *gone*.

**Concrete framing for common cases:**
- *Class → hooks:* migrate on touch. Don't schedule a sprint for it.
- *JS → TS:* `allowJs`, rename files as you touch them, `strict: false` initially, tighten per-directory. A repo-wide `strict: true` on day one produces 4,000 errors and gets abandoned.
- *Old state library → new:* run both stores, migrate one slice at a time, keep them in sync during the transition.
- *Framework migration:* route-level split at the proxy — `/new/*` to the new app, everything else to the old.

**The rule:** every step must be independently shippable and independently revertable. A migration that can only be evaluated at the end is a rewrite wearing a disguise.

---

# PART B — Observability & Incident Response

## Q: How do you know your frontend is broken before users tell you?

**Answer.** You can't fix what you can't see, and you won't see it unless you instrumented it beforehand. **Four layers:**

**1. Error tracking** (Sentry or similar)
- Upload **source maps** — a minified stack trace is useless
- Tag every event with **release version**, so you can bisect to a deploy
- Attach user context: browser, device, route, feature flags, user ID
- **Alert on rate spikes, not individual errors.** One error is noise; a 50× jump is an incident
- Group intelligently — one bad component can produce 10,000 events that are one bug

**2. Real user monitoring (RUM)**
- Core Web Vitals from **real users at p75/p95**, not lab averages
- Segment by device tier, connection, and geography — your p50 is a fast laptop on office wifi, and it hides everything
- **Lab data (Lighthouse) is for debugging; field data is for truth.** Say this — it's the distinction that separates people who've run performance work from people who've read about it

**3. Structured event logging**
- A **centralized event taxonomy**: `ORDER_CREATED` is a typed constant with a defined payload, not a string typed in 40 files
- Consistent context enrichment (session, user, device) applied once at the logger, not per call site
- Funnels and drop-off become queryable rather than guessable

**4. API observability from the client**
- Failure rates and latency per endpoint, **as the browser sees them**
- This catches what server metrics miss entirely: CORS failures, DNS problems, client timeouts, ad-blockers, corporate proxies, offline. Your backend dashboard shows 100% success while 3% of users can't reach it at all

---

## Q: A user reports a bug you can't reproduce. What do you do?

**Answer — a procedure, not a guess.**

1. **Get their exact context** — browser, version, OS, device, route, timestamp, account. "Doesn't work" is not a bug report; get to a reproducible statement.
2. **Check error tracking for that timeframe and user.** Often the exception is already sitting there with a stack trace.
3. **Session replay** if available — it turns "I clicked and nothing happened" into a video.
4. **Check what's different about them:** feature flags, A/B bucket, permissions, locale, data shape (an account with 10,000 items, an empty state, a null field your types promised couldn't be null), browser extensions.
5. **Bisect by release.** If it started Tuesday, diff Tuesday's deploy.
6. **Reproduce with their data**, not yours. Most "unreproducible" bugs are data-shape bugs.
7. **Fix, then write the regression test.** Without it the bug returns silently in six months and you pay the whole cost again.

**The general principle:** unreproducible almost always means *you haven't matched their context yet* — not that it's random. Find the variable you're not controlling.

---

## Q: How do you roll out a risky change safely?

**Answer.** Decouple **deploy** from **release**. Deploying code and turning it on for users should be two separate events.

- **Feature flags** — ship dark, enable for yourself, then 1%, then 10%, then everyone. Rollback is a config toggle, not a revert-and-redeploy.
- **Watch the right metrics during ramp** — error rate, Core Web Vitals, and the *business* metric the feature is meant to move. A 200ms LCP regression that nobody notices is still a regression.
- **Kill switch** for anything touching payments, auth, or data writes.
- **Define rollback criteria before you start**, in numbers. Deciding whether to roll back during an incident, with adrenaline, is how bad calls get made.

**Clean up the flags.** A codebase with 200 stale flags is unreadable and every code path is conditionally live. Flags need expiry dates.

---

# PART C — Internationalization

## Q: What's actually involved in i18n beyond translating strings?

**Answer.** Absent from the corpus entirely, and it breaks layouts and correctness in ways that are expensive to retrofit.

**1. Pluralization is not `count === 1`.**
English has 2 forms. Russian has 4. Arabic has 6. Japanese has 1.

```javascript
new Intl.PluralRules("ru").select(2);   // "few"
// Use ICU message format; never concatenate
// ✗ `${count} item` + (count !== 1 ? "s" : "")
// ✓ "{count, plural, one {# item} other {# items}}"
```

**2. Never concatenate sentence fragments.** `"You have " + n + " new " + type` is unlocalizable — word order differs by language, and translators see disconnected fragments with no context. Pass whole messages with named placeholders.

**3. RTL inverts your entire visual model.** Arabic and Hebrew flip layout direction. This is what **CSS logical properties** are for:

```css
/* ✗ physical — breaks in RTL */
margin-left: 1rem;  padding-right: 2rem;  text-align: left;  border-left: 1px;

/* ✓ logical — adapts automatically */
margin-inline-start: 1rem;  padding-inline-end: 2rem;
text-align: start;  border-inline-start: 1px;
```

Use them by default even in English-only projects — same cost, and RTL becomes nearly free later.

**4. Text expands.** German runs ~30% longer than English; Finnish more. Fixed-width buttons and single-line labels break. Design for overflow, test with the longest locale.

**5. Formatting is locale-specific, and `Intl` is built in and underused.**
```javascript
new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(1234.5);
// "1.234,50 €"  — note the swapped separators
new Intl.DateTimeFormat("ja-JP").format(new Date());
new Intl.RelativeTimeFormat("en").format(-1, "day");     // "1 day ago"
new Intl.ListFormat("en").format(["a", "b", "c"]);       // "a, b, and c"
```

**6. Sorting is locale-dependent.** `["ä","z"].sort()` gives the wrong order in Swedish. Use `localeCompare` or `Intl.Collator`.

---

## Q: The three classic correctness traps.

**Money — never use floats.**
```javascript
0.1 + 0.2 === 0.3;            // false
(1.005).toFixed(2);           // "1.00" — not "1.01"
```
Store **integer minor units** (cents), do arithmetic in integers, format only at the display boundary. Use a decimal library for anything involving rates or division. In a payments-adjacent role this is table stakes, and PayPal-style interviewers notice.

**Time — a timezone is not an offset.**
- An offset (`+05:30`) is a *value*; a timezone (`Asia/Kolkata`) is a *set of rules* that changes twice a year for DST.
- Store **UTC instants** for things that happened.
- For **future** events, store the wall-clock time *and* the intended timezone separately — a 9am meeting scheduled across a DST boundary must stay 9am local, and a stored UTC instant won't.
- "Today" depends on the viewer's timezone; a date-only value (a birthday) is not an instant and must not be stored as one.
- Use `Temporal` or a maintained library; hand-rolled date math is where bugs live.

**Text — strings are not arrays of characters.**
```javascript
"é".length;                    // 1 or 2, depending on Unicode normalization
"👨‍👩‍👧".split("").length;         // 8 — mangles the emoji
[..."👨‍👩‍👧"].length;              // 1 with Intl.Segmenter, still surprising otherwise
"i".toUpperCase();             // "İ" in Turkish locale — breaks case-insensitive compares
```
Normalize with `.normalize("NFC")` before comparing. Use `Intl.Segmenter` for grapheme-correct truncation. And names have no reliable first/last structure — one `fullName` field is more correct than two for most of the world.

---

# PART D — Resilience & the Network

## Q: How do you build for unreliable networks?

**Answer.** The corpus assumes the network works. Real users are on subways, hotel wifi, and throttled data plans.

**The rule: the network is not a function call.** It's slow, it fails, it's unordered, and it costs the user money.

**What that means concretely:**

- **Every request needs a timeout.** A request with no timeout hangs forever and the UI waits with it.
- **Retry with exponential backoff and jitter** — but **only for idempotent operations.** Retrying `POST /payments` can double-charge. This is the point that matters: make writes idempotent with a client-generated idempotency key, then retrying is safe.
- **Deduplicate in-flight requests.** Three components asking for the same user shouldn't make three calls.
- **Cache and revalidate** rather than refetching from zero.
- **Detect offline** — `navigator.onLine` plus a real heartbeat (`onLine` lies; it reports link status, not reachability). Show state, queue writes, replay on reconnect.
- **Degrade gracefully.** A failed analytics call must never break the page. Wrap non-essential requests so their failure is invisible.

**Perceived performance is a real lever**, not a trick:
- **Skeletons matching the final layout**, so nothing shifts on arrival
- **Optimistic updates** for low-stakes actions
- **Preload on intent** — hover, viewport entry
- **Show partial data** as it arrives instead of waiting for everything

**The empathy check that catches most of it:** throttle to Slow 3G in DevTools and use your own feature. Most teams have never done this, and it surfaces every missing loading state in about two minutes.

---

# PART E — Judgment & Working With People

## Q: How do you decide what to build — and what to push back on?

**Answer.** The most senior engineers in the corpus's own telling weren't rewarded for coding. LinkedIn's Round 6 asked *"how do designers and frontend engineers collaborate?"* and *"tell us about an optimization that significantly improved user experience."* Wayfair and PayPal both ran leadership rounds on ownership and driving decisions.

**Ask what the request is *for* before estimating it.** A feature request is a proposed solution to a problem. Often the problem has a cheaper solution — sometimes a copy change instead of a feature, or a fix to the thing that made users want the workaround.

**How to push back well:**
- **On evidence, not preference.** "This adds 180KB and pushes LCP past 3s on our p75 device" beats "I don't like this library."
- **Offer the alternative.** "No" ends the conversation; "not that, but we could do X for a fifth of the cost" continues it.
- **Name the trade-off in their terms.** Not "this is technical debt" but "this makes every future change in checkout about 30% slower to ship."
- **Then commit.** If the decision goes the other way, support it fully. Write down the concern and the revisit condition — "if p95 exceeds X, we should reconsider" — so it's a documented engineering decision rather than a grudge you bring up later.

**Estimate honestly and in ranges.** "Three to five days, and I'll know by Tuesday which end" is more useful and more trusted than a confident single number that slips.

**The strongest thing you can learn to say: "I don't know, let me find out."** Interviewers and colleagues both read fabricated confidence instantly, and it costs more than the gap it was hiding.

---

## Q: What does good collaboration with design look like?

**Answer.** Get involved **before** the handoff. The cheapest time to raise "this state isn't designed" or "this breaks at 320px" is while it's still a Figma file.

**The questions to ask on every design review** — most designs don't specify them, and they're what you'll be blocked on later:
- What does the **loading** state look like? **Empty**? **Error**?
- What happens with the **longest realistic content**? A 60-character name?
- What's the **keyboard** behavior? Focus order?
- What's the **320px** version, not just the 1440?
- Is this a **new pattern**, or does the design system already have one?

**Push toward the design system.** Every one-off component is permanent maintenance. "We have a Dropdown that does 90% of this — can we use it with a small addition?" is usually a better outcome for both sides than a bespoke build.

**Design tokens are the shared contract.** When designers work in named tokens and you implement those tokens, a palette change is a one-line diff instead of a two-week audit. That's the Moniepoint story from the corpus — 200+ hardcoded values reduced to ~180 semantic tokens — and the benefit worth naming is *cheap change*, not tidiness.

---

## Q: How do you review code well?

**Answer.** Review is where standards actually get set, and most reviews are wasted on the wrong layer.

**Priority order — spend your attention top-down:**
1. **Correctness** — does it work, including at the edges?
2. **Security** — user input, auth, data exposure
3. **Design** — is this the right shape? Will it be painful in six months?
4. **Readability** — will someone understand this at 2am during an incident?
5. **Style** — *automate this entirely.* Prettier and ESLint should mean you never write a style comment.

**How to leave comments:**
- **Distinguish blocking from optional.** Prefix with `blocking:` / `nit:` / `question:`. A wall of undifferentiated comments is impossible to prioritize.
- **Ask rather than assert.** "What happens if `items` is empty here?" surfaces the bug and respects that they may know something you don't.
- **Explain the why.** "Use `useCallback`" teaches nothing; "this is in `TableRow`'s deps, so a new reference each render defeats the memo" teaches the model.
- **Praise the good parts.** Genuinely — it's how good patterns spread.

**And apply the Moniepoint standard: be willing to say "not yet."** That round graded the *willingness to request changes* as much as the findings. Approving code you have real concerns about is a failure of the review, not politeness.

---

*Back to the [answer bank index](./README.md) · [core insights](../core-insights.md) · [knowledge map](../frontend-knowledge-map.md)*
