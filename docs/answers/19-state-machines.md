# State Machines & Complex UI State

This extends [`../frontend-knowledge-map.md`](../frontend-knowledge-map.md) §12 (State Management & Data Fetching) with a pattern that appears nowhere across the 23-article corpus — nobody in those loops was asked about state machines, explicit transitions, or XState, which is itself a gap worth knowing about. It is the direct continuation of ["derive, don't duplicate"](../core-insights.md#model-4-single-source-of-truth-derive-everything-else) from Model 4 in `core-insights.md`: that document modeled the *shape* of state so illegal combinations can't be represented; this one models the *behavior* — the events and rules that move you between states — which is a harder and more general problem than shape alone.

---

# PART A — The problem: boolean soup

**Answer.** Here is how almost everyone starts a data-fetching component, and why it quietly rots:

```javascript
function SearchResults() {
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // every effect, every branch, has to set some subset of these
  // and remember NOT to leave the others in a stale state
  async function fetchResults(query) {
    setIsLoading(true);
    setIsError(false);
    try {
      const results = await search(query);
      setData(results);
      setHasData(true);
      setIsLoading(false);
    } catch (e) {
      setError(e);
      setIsError(true);
      setIsLoading(false);
      // forgot to reset hasData — if a previous search had succeeded,
      // hasData is still true while isError is now also true
    }
  }
  // ...
}
```

Four independent booleans is $2^4 = 16$ representable combinations. Write out what a handful of them *mean*:

| `isLoading` | `isError` | `hasData` | `isRefetching` | Meaning |
|---|---|---|---|---|
| `true` | `false` | `false` | `false` | First load in flight — fine |
| `false` | `false` | `true` | `false` | Showing data — fine |
| `false` | `true` | `false` | `false` | Errored, no data — fine |
| `true` | `true` | `true` | `false` | **Loading AND errored AND has data, simultaneously?** |
| `false` | `false` | `false` | `true` | **Refetching data that was never fetched?** |
| `true` | `false` | `true` | `true` | **Loading and refetching at once — two different words for the same thing?** |

Roughly half the 16 combinations either mean nothing or mean two contradictory things at once. Nothing in the type system or the runtime stops you from being in one of them — only the discipline of every future contributor remembering to set every flag correctly, every time, in every branch. And now the actual failure mode: someone adds a "retrying after a transient error" state six months later. That's not a fifth boolean bolted onto a stable design — it's an audit of **every existing `if (isLoading)` and `if (isError)` check in the component**, because the new state interacts with all of them and you don't know which checks silently assumed the old four were exhaustive.

**Name the shape of the bug precisely.** With $n$ independent booleans, the *representable* state space grows as $2^n$. The *meaningful* state space — the set of situations that can actually occur in a fetch lifecycle — grows roughly linearly: idle, loading, success, error, maybe refetching, maybe retrying. The gap between "representable" and "meaningful" is not wasted space — it is exactly where bugs live, because every one of those extra combinations is a state your component can be rendered in that nobody designed for and nobody tested.

**This is the same disease Model 4 names, one level deeper.** [`core-insights.md`'s "make illegal states unrepresentable"](../core-insights.md) and [`04-react-data.md`'s discriminated-union treatment](./04-react-data.md#q-typescript-as-design-not-annotation) both fix this at the **type level** — they collapse `{isLoading, isError, hasData}` into a single tagged union so the compiler refuses to construct the nonsense combinations:

```typescript
type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: T };
```

That is a genuinely load-bearing fix, and if you haven't read it, go read it first — this document doesn't repeat it. But notice what it *doesn't* cover: it says what shapes are legal to **be in**. It says nothing about which **transitions** between them are legal. A discriminated union does not stop you from writing `setState({ status: "success", data })` directly from `{ status: "idle" }`, skipping loading entirely, or from firing a `RETRY` action when you're already in `success` with nothing to retry. The type is a snapshot constraint, not a rulebook for how snapshots may follow one another. **That's the gap state machines close: not "what shapes exist" but "what can happen next, from here, and what happens when it does."** Shape is a noun. Behavior is a verb. This document is about the verb.

---

# PART B — Vocabulary: states, events, transitions, guards, actions

Five words, each with a precise meaning, each illustrated with the smallest possible example before any domain complexity gets involved.

**State** — a finite, named mode the system can be in, at a given moment, to the exclusion of every other mode. Not "loading is true" — `"loading"` *is* the mode, full stop. A traffic light is in exactly one of `red`, `green`, `yellow` — never two, never zero.

**Event** — something that happens, from outside the machine's own control, that might cause it to change mode. `TIMER_EXPIRED`, `FETCH`, `RESOLVE`, `REJECT`, `RETRY`, `USER_CLICKED_BACK`. Events are inputs; states are outputs.

**Transition** — a rule of the form *"when in state X and event Y occurs, move to state Z."* This is the actual rulebook — the thing a discriminated union has no way to express.

**Guard** — a condition that must evaluate `true` for a transition to actually fire, even though the state and event match. `RETRY` only moves `error → uploading` **if** `retryCount < 3`; otherwise the event is a no-op (or routes somewhere else, like a "give up" state).

**Action** — a side effect that fires as a consequence of a transition: logging, calling an API, showing a toast, incrementing a counter. Actions don't decide *where* you go; they're what happens *because* you went there.

**The minimal worked example — a traffic light, in plain data, no library at all:**

```javascript
// A transition table is the whole machine, expressed as data.
// Read it as: "current state" -> "event that fires" -> "next state"
const trafficLightMachine = {
  initial: "red",
  states: {
    red:    { on: { TIMER: "green" } },
    green:  { on: { TIMER: "yellow" } },
    yellow: { on: { TIMER: "red" } },
  },
};

function transition(machine, currentState, event) {
  const stateDef = machine.states[currentState];
  const nextState = stateDef.on?.[event];
  return nextState ?? currentState; // unknown event in this state: ignore it, stay put
}

let light = trafficLightMachine.initial;       // "red"
light = transition(trafficLightMachine, light, "TIMER"); // "green"
light = transition(trafficLightMachine, light, "TIMER"); // "yellow"
light = transition(trafficLightMachine, light, "HONK");  // "yellow" — HONK isn't a valid event here, ignored
```

Everything downstream in this document — `useReducer` and XState alike — is a fancier version of that transition table plus somewhere to keep guards, actions, and extra data (`context`) that doesn't fit into a state name (like a retry counter).

---

# PART C — A realistic example: an upload widget

**Answer.** Model the states an upload widget can actually be in, as mutually exclusive named modes rather than flags:

```
idle ──SELECT_FILE──▶ selected ──UPLOAD──▶ uploading ──SUCCESS──▶ success
                                               │
                                             ERROR
                                               ▼
                                             error ──RETRY (guard: attempts < 3)──▶ uploading
                                               │
                                             (RESET from idle/selected/success/error)──▶ idle
```

**Why this is a real improvement, not a stylistic one:** in the boolean version, "uploading" and "error" were two flags that could both be `true` at once even though that combination is nonsense. Here, `uploading` and `error` are two different *values* of the same field — the type system (or, in plain JS, simple convention) makes it structurally impossible to be in both. You didn't need to remember to keep them mutually exclusive. **The bug class is eliminated by construction, not caught by review.**

### C.1 — As a plain `useReducer`

```typescript
type UploadState =
  | { status: "idle" }
  | { status: "selected"; file: File }
  | { status: "uploading"; file: File; attempts: number }
  | { status: "success"; url: string }
  | { status: "error"; file: File; attempts: number; message: string };

type UploadEvent =
  | { type: "SELECT_FILE"; file: File }
  | { type: "UPLOAD" }
  | { type: "SUCCESS"; url: string }
  | { type: "ERROR"; message: string }
  | { type: "RETRY" }
  | { type: "RESET" };

function uploadReducer(state: UploadState, event: UploadEvent): UploadState {
  switch (state.status) {
    case "idle":
      // idle only listens for SELECT_FILE — everything else is a no-op from here
      return event.type === "SELECT_FILE" ? { status: "selected", file: event.file } : state;

    case "selected":
      if (event.type === "UPLOAD") return { status: "uploading", file: state.file, attempts: 0 };
      if (event.type === "SELECT_FILE") return { status: "selected", file: event.file };
      return state;

    case "uploading":
      if (event.type === "SUCCESS") return { status: "success", url: event.url };
      if (event.type === "ERROR")
        return { status: "error", file: state.file, attempts: state.attempts, message: event.message };
      return state; // UPLOAD fired again mid-upload: ignored, not a valid transition

    case "error":
      // this IS the guard: RETRY only does something below the attempt ceiling
      if (event.type === "RETRY" && state.attempts < 3)
        return { status: "uploading", file: state.file, attempts: state.attempts + 1 };
      if (event.type === "RESET") return { status: "idle" };
      return state;

    case "success":
      return event.type === "RESET" ? { status: "idle" } : state;
  }
}
```

**Read this as: `useReducer` IS a state machine — it's just one where the transition table lives in imperative `switch`/`if` code and convention, rather than in a declarative structure you can inspect, print, or visualize.** Every `case` is a state; every `if (event.type === ...)` is a transition; the `attempts < 3` check is a guard written by hand. Nothing about this is wrong — it fully solves the boolean-soup problem above. It's simply implicit: the *rulebook* only exists as a side effect of reading the whole function, and nothing stops a future edit from adding a transition that quietly breaks an invariant the original author had in their head but never wrote down anywhere inspectable.

### C.2 — As an XState machine

```typescript
import { setup, assign } from "xstate";

const uploadMachine = setup({
  types: {
    context: {} as { file: File | null; attempts: number; url: string | null; message: string | null },
    events: {} as
      | { type: "SELECT_FILE"; file: File }
      | { type: "UPLOAD" }
      | { type: "SUCCESS"; url: string }
      | { type: "ERROR"; message: string }
      | { type: "RETRY" }
      | { type: "RESET" },
  },
  guards: {
    // the guard is now a named, reusable, independently-testable predicate —
    // not an inline `if` buried in a reducer branch
    canRetry: ({ context }) => context.attempts < 3,
  },
}).createMachine({
  id: "upload",
  initial: "idle",
  context: { file: null, attempts: 0, url: null, message: null },
  states: {
    idle: {
      on: { SELECT_FILE: { target: "selected", actions: assign({ file: ({ event }) => event.file }) } },
    },
    selected: {
      on: {
        UPLOAD: "uploading",
        SELECT_FILE: { actions: assign({ file: ({ event }) => event.file }) }, // stays in "selected"
      },
    },
    uploading: {
      on: {
        SUCCESS: { target: "success", actions: assign({ url: ({ event }) => event.url }) },
        ERROR: {
          target: "error",
          actions: assign({
            message: ({ event }) => event.message,
            attempts: ({ context }) => context.attempts + 1,
          }),
        },
      },
    },
    error: {
      on: {
        RETRY: { target: "uploading", guard: "canRetry" }, // event is simply ignored if the guard fails
        RESET: { target: "idle", actions: assign({ file: null, attempts: 0, url: null, message: null }) },
      },
    },
    success: {
      on: { RESET: { target: "idle", actions: assign({ file: null, attempts: 0, url: null, message: null }) } },
    },
  },
});
```

**What XState actually adds on top of the reducer above:** the transition table becomes a first-class, declarative *data structure* — `states`, `on`, `guard`, `target` — rather than control flow you have to trace by reading every branch. That buys you three concrete things a reducer doesn't give you for free: (1) the machine can be **visualized** as a diagram directly from this definition, (2) invalid transitions are **structurally impossible to add by accident** — there's no `default:` fallthrough to forget, an event with no matching `on` entry is simply ignored by the runtime, and (3) the machine can be **inspected, tested, and serialized** independently of any component that uses it. Nothing here is new *logic* versus the reducer — it's the same rules, made declarative instead of imperative.

---

# PART D — Hierarchical and parallel states, briefly

**Hierarchical (nested) states — a concrete case.** The `error` state above is really two different situations wearing one name: a network hiccup you can retry, and a file that's fundamentally rejected (wrong type, too large) that no retry will fix. Model that as nested states:

```typescript
error: {
  initial: "retryable",
  states: {
    retryable: { on: { RETRY: { target: "#upload.uploading", guard: "canRetry" } } },
    fatal: {}, // no RETRY handler at all — the state itself makes retry unavailable
  },
  on: { RESET: "#upload.idle" }, // shared by BOTH sub-states, defined once on the parent
},
```

Both sub-states inherit the parent's shared behavior (they're both still "error," the RESET handler defined once on `error` applies to either), while differing in what's actually offered — a retry button only renders when `state.matches({ error: "retryable" })`; a fatal error shows a message and nothing else. Without hierarchy you'd duplicate the RESET handling into both, or reach back for a boolean (`isFatal`) bolted onto the flat `error` state — which is exactly the boolean-soup problem from Part A, recurring one level down.

**Parallel states, in one paragraph.** Some pieces of state genuinely don't interact and shouldn't be flattened into one machine just because they live in the same component. A form's *validation* machine (`validating → valid / invalid`) and its *submission* machine (`idle → submitting → submitted / failed`) are logically independent — a field can be mid-validation while a previous submission is still resolving — and forcing them into one flat set of states produces a combinatorial explosion of compound state names (`validating-and-submitting`, `invalid-and-failed`, ...) that's the exact 2ⁿ problem from Part A again, just relocated into the machine definition instead of out of it. XState supports declaring two (or more) regions as running in parallel inside one machine so each can be reasoned about — and visualized — independently.

**One sentence of naming precision, because it's asked about:** hierarchy and parallelism are specifically what distinguish a full **statechart** — David Harel's 1987 formalism, designed for exactly this kind of nested, concurrent UI logic — from a plain finite state machine, which is flat by definition. That's why XState calls itself a statechart library rather than an FSM library: FSMs alone don't have a good answer for "the error state has two flavors" or "these two concerns are independent," and statecharts do.

---

# PART E — XState in React practice

**Answer.** `useMachine` wires a machine definition into a component: it returns the current snapshot and a `send` function, and re-renders the component whenever the snapshot changes — the same contract as `useReducer`, deliberately.

```tsx
import { useMachine } from "@xstate/react";

function UploadWidget() {
  const [state, send] = useMachine(uploadMachine);

  return (
    <div>
      {state.matches("idle") && (
        <input type="file" onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) send({ type: "SELECT_FILE", file });
        }} />
      )}

      {state.matches("selected") && (
        <button onClick={() => send({ type: "UPLOAD" })}>
          Upload {state.context.file?.name}
        </button>
      )}

      {state.matches("uploading") && <Spinner label="Uploading…" />}

      {state.matches("success") && (
        <p>Done. <a href={state.context.url!}>View file</a></p>
      )}

      {/* checking nested state directly — see Part D */}
      {state.matches({ error: "retryable" }) && (
        <div>
          <p>{state.context.message}</p>
          <button onClick={() => send({ type: "RETRY" })}>
            Retry ({state.context.attempts}/3)
          </button>
        </div>
      )}
      {state.matches({ error: "fatal" }) && <p>Upload failed: {state.context.message}</p>}
    </div>
  );
}
```

Notice what disappeared compared to the boolean-soup component in Part A: there is no `if (isLoading && !isError)` guesswork anywhere in this JSX. Every branch is `state.matches(...)` against a name that the machine itself guarantees is mutually exclusive with every other branch. You cannot accidentally render both the spinner and the error message, because the machine cannot be in `uploading` and `error` at the same time — there's no code path to defend against, because there's no state to defend against.

**The honest, non-hyped case for the visualizer.** XState's machine definitions can be rendered as an actual diagram (Stately's visualizer, or `@xstate/graph` for headless inspection) directly from the `createMachine` call — no separate document to keep in sync, because the diagram *is* the code. That's a genuinely different artifact than a reducer, and it earns its keep in one specific way: **a PM or a QA engineer can look at a state diagram and immediately spot a missing transition** — "what happens if the user hits back while the upload is in flight?" — in a way that scanning `switch` statements across a reducer file almost never surfaces for someone who doesn't read code fluently. That's not a hypothetical selling point; it's the actual reason teams adopt statecharts on complex flows (checkout, onboarding, multi-step wizards) — the diagram becomes a shared artifact between engineering and product, not just documentation *of* the code but a design surface *for* the flow, reviewable before a line of the component is written.

---

# PART F — The trap: when NOT to reach for a library

**The trap.** A toggle. A single modal's open/closed flag. A three-tab selector. None of these need XState — and `useState` for them isn't a compromise or "good enough for now," it is the objectively correct tool. Reaching for a state-machine library on a two-state boolean adds a machine definition, a new mental model the whole team now has to carry, and a dependency — real, measurable ceremony — to solve a problem that `const [open, setOpen] = useState(false)` already solves completely, with zero ambiguity about what state you're in. This is over-engineering in exactly the same shape as [the Moniepoint `useMemo` example in `02-react-core.md`](./02-react-core.md#q-usememo-vs-usecallback-difference-and-when-to-use-each): a tool applied because it's known and interesting, not because the problem asked for it.

**The actual decision heuristic — reach for explicit modeling (a hand-written transition table via `useReducer`, or a full XState machine) when at least one of these is true:**

1. **The state has more than roughly four meaningful modes.** Below that, a `useState` per genuinely independent concern is more readable than a machine definition; above it, tracking which combinations are legal by memory stops working.
2. **Invalid combinations are actually reachable with your current approach, and have caused (or plausibly will cause) real bugs** — not "theoretically representable," but "someone will hit this." The upload widget in Part C qualifies; a modal's open flag does not.
3. **The transition logic itself is complex, not just the state shape** — "what happens next depends on what happened before" is genuinely hard to trace by reading the code as written. A guarded retry with an attempt ceiling, a back button that's valid from some states and not others, an async validation step that can be interrupted — these are transition-complexity problems, and that complexity doesn't go away by not naming it; it just becomes implicit and undocumented.

**Say this directly, because it's graded as heavily as the tool itself:** knowing when *not* to reach for a state machine is not a lesser skill than knowing how to build one. The interview signal in "explicit state modeling" questions is rarely "did you know XState exists" — it's whether you can look at a genuinely simple toggle and *not* over-model it, and look at a genuinely tangled multi-step flow and *not* keep pushing more booleans into it past the point where that's still legible. Both directions of that judgment are the actual answer.

---

# PART G — Decision framework: `useState` vs `useReducer` vs XState

Each rung adds something specific over the one below it — not "more powerful" in the abstract, but a concrete capability the previous tool structurally lacks:

- **`useState`.** Right for state that is genuinely independent and uncorrelated — this piece of data doesn't constrain what values another piece can hold. A toggle, a text input's value, a hovered index. The moment two `useState` calls have to be kept in sync by hand (`isLoading` and `isError` from Part A), you've outgrown this rung, whether or not you've noticed yet.

- **`useReducer`.** Adds a **single choke point** — one function through which every transition must pass — so you can enforce "this event can only do X from state Y" with a `switch` on the current state, as in Part C.1. What it does *not* add: the transition rules still live in imperative code. Reading the rulebook means reading the whole reducer function; there's nothing to hand a non-engineer, print, or run a graph algorithm over.

- **XState / statecharts.** Adds making the transition table itself the **source of truth** — a data structure you can inspect, diff, visualize, and generate tests from, and one where an event handler literally cannot exist outside the table because there's no separate imperative code path for it to hide in. Also the only rung of the three with a real answer for hierarchy (Part D's nested error states) and parallelism (independent sub-machines) without resorting to compound state-name explosion.

The practical rule: default to `useState`, promote to `useReducer` the moment two pieces of state must agree, and promote again to a statechart only when the transition *rules* — not just the state *shape* — are complex enough that a diagram would tell a teammate something the code doesn't already make obvious in five seconds of reading.

---

# PART H — A real interview-style modeling exercise

**Prompt: "Design the state for a multi-step checkout form with async validation per step and the ability to go back."**

**Answer.** Work top-down: name the steps, then for each step name the sub-states it actually passes through, then name the events, then find the guards last — guards fall out naturally once transitions are written down honestly.

**Steps:** `shipping`, `payment`, `review` (three steps is enough to demonstrate the pattern; a real form might have more).

**Per-step sub-states** (this is the hierarchical pattern from Part D, applied once per step):

```
shipping.editing     — user is filling the form, no validation in flight
shipping.validating  — async validation call is in flight (address lookup, etc.)
shipping.invalid     — validation returned errors; user is back to editing them
shipping.valid       — validation passed; NEXT is now available
```

Same four sub-states repeat for `payment` and `review`, which is itself a signal this is the right decomposition — a genuinely reusable per-step pattern rather than three bespoke shapes.

**Events:**

```
FIELD_CHANGED     — any input inside the current step changed
SUBMIT_STEP       — user hit "Next" — triggers validation, doesn't advance yet
VALIDATION_OK     — the async validation call resolved successfully
VALIDATION_FAILED — the async validation call resolved with errors
BACK              — go to the previous step
```

**The transitions, written as the actual rulebook** (abbreviated to `shipping → payment`; `payment → review` is the same shape):

```typescript
shipping: {
  initial: "editing",
  states: {
    editing:    { on: { SUBMIT_STEP: "validating" } },
    validating: {
      // no FIELD_CHANGED or SUBMIT_STEP handler here — this is the guard, expressed
      // structurally: the events simply don't exist while validating, so NEXT
      // (a second SUBMIT_STEP) can't double-fire mid-flight, no `isSubmitting` flag needed
      on: { VALIDATION_OK: "valid", VALIDATION_FAILED: "invalid" },
    },
    invalid: { on: { FIELD_CHANGED: "editing", SUBMIT_STEP: "validating" } },
    valid:   { on: { FIELD_CHANGED: "editing" } }, // editing again invalidates the prior pass
  },
  on: {
    // BACK is allowed from every sub-state of "shipping" except when it's the first step —
    // defined once on the parent so it doesn't need repeating in editing/validating/invalid/valid
  },
},
```

**The guard the prompt is actually testing for:** "prevent `NEXT` while `validating`." Notice it isn't written as an `if (!isValidating)` check guarding a `NEXT` handler that exists everywhere — it's modeled by the `validating` sub-state simply **not having a transition for `SUBMIT_STEP` at all**. That's the same principle as Part C's mutual exclusion: the invalid action isn't caught by a runtime check, it's absent from the table, so there's nothing to accidentally get wrong later when someone edits this file without remembering why the guard was there.

**`BACK`'s placement is the second thing worth saying out loud:** it's declared once on each step's parent node (visible to `editing`, `validating`, `invalid`, and `valid` alike) rather than duplicated into all four sub-states — and note the honest edge case: should `BACK` be allowed from `validating`, mid-flight? That's a product decision, not a technical one (does going back cancel the in-flight validation call, or let it resolve into a step the user has already left?) — and it's exactly the kind of missing-transition question a diagram surfaces immediately (Part E) that reading four sub-state definitions in isolation does not.

---

## The six sentences worth memorising

- Boolean soup grows representable states as $2^n$ while meaningful states grow roughly linearly — that gap is the bug surface, and it's a different problem from the one discriminated unions solve.
- A discriminated union constrains what shape a snapshot may have; a state machine additionally constrains what shapes may follow which — shape versus behavior.
- `useReducer` already is a state machine, just with the transition table written as imperative `switch`/`if` logic instead of an inspectable data structure.
- A guard is best expressed as an *absent* transition, not a runtime `if` guarding a transition that technically exists — absence can't be forgotten to check.
- A state diagram is a genuine communication artifact: it lets a PM or QA engineer spot a missing transition that scanning reducer code never surfaces.
- Reach for explicit modeling past ~4 meaningful modes, real invalid-combination bugs, or transition logic that's hard to trace by reading — below that threshold, `useState` reaching for a library is the same over-engineering the Moniepoint `useMemo` example penalizes.

---

*Back to the [answer bank index](./README.md)*
