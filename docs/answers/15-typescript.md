# TypeScript in Depth

§11 of the [knowledge map](../frontend-knowledge-map.md) is marked ★, but the corpus barely touches it — TypeScript was explicitly required at exactly one company, Moniepoint ("no `any`, correct generics"), and everywhere else it's implicit at best. Most of what follows is not corpus-derived; it's the professional depth a senior TS question actually probes, because the market baseline has risen well past what 23 crawled interview writeups happened to mention.

The discriminated-union-for-state pattern and the "validate at the edges" principle are already covered in depth elsewhere in this repo — this document links to those rather than re-deriving them, and spends its own space on generics, the type-level features nobody teaches themselves, and the operators that get silently misused.

---

# PART A — THE TYPE SYSTEM MODEL

### 1. TypeScript is structural, not nominal

**Answer.** In Java or C#, two types are compatible only if one is declared to extend or implement the other — compatibility is a fact about *names in the source*. TypeScript doesn't work that way. It's **structural**: a type is compatible with another if its *shape* satisfies it, regardless of declared relationship. This is duck typing, formalized and checked at compile time.

```typescript
interface Point2D { x: number; y: number; }
interface Vector2D { x: number; y: number; }

function distance(p: Point2D): number {
  return Math.sqrt(p.x ** 2 + p.y ** 2);
}

const v: Vector2D = { x: 3, y: 4 };
distance(v);   // compiles — Vector2D was never declared to relate to Point2D at all
```

Nothing links `Point2D` and `Vector2D`. TypeScript only asked "does this value have an `x: number` and a `y: number`?" — and it did.

**Why this surprises Java/C# engineers:** they expect assignability to require a declared `implements`/`extends`. In TS, **excess properties are fine on existing variables, but object literals get extra scrutiny** — the one place nominal-style strictness sneaks back in:

```typescript
function makePoint(p: Point2D) { return p; }

makePoint({ x: 1, y: 2, z: 3 });          // ✗ error: 'z' does not exist in type 'Point2D'
const obj = { x: 1, y: 2, z: 3 };
makePoint(obj);                            // ✓ fine — obj is a variable, not a literal
```

**Excess property checking** exists specifically to catch typos in object literals (`{ colour: 'red' }` passed where `color` was expected) at the one point where structural typing would otherwise silently accept it. It's not a general nominal-typing feature — it evaporates the moment the object goes through a variable.

**Follow-up an interviewer asks next:** "does this mean two unrelated classes with the same fields are interchangeable?" Yes, for public members. Classes with `private`/`protected` members regain nominal-like behavior, because TS *does* check whether the private member originated from the same declaration.

### 2. `interface` vs `type` — the real difference, not the folklore

**Answer.** They overlap for plain object shapes, and most "which one is better" debate is noise. The parts that actually differ:

**`interface` can be extended after the fact — declaration merging.** Two `interface` declarations with the same name are merged into one, which is exactly how you augment a third-party or global type you don't own:

```typescript
// Some other file — a library or your own global.d.ts
interface Window {
  __APP_VERSION__: string;
}

// Anywhere else in the project, this now type-checks:
console.log(window.__APP_VERSION__);   // string, not `any`, with no cast
```

`type` cannot do this — declaring the same type alias twice is a compile error. That single capability is why library `.d.ts` files and global augmentation are always written as `interface`.

**`type` can express what `interface` structurally cannot** — unions, intersections of non-object types, tuples, mapped types, conditional types:

```typescript
type Status = "idle" | "loading" | "success" | "error";   // interface can't express a union
type Point = [x: number, y: number];                        // a labeled tuple
type Nullable<T> = T | null;                                 // generic over a primitive union
```

**The pragmatic rule:** `interface` for object shapes that represent an entity and might need extension or merging (component props, API models, anything a consumer of your library might augment). `type` for everything that isn't a plain object shape — unions, tuples, function signatures, mapped/conditional types. When it's genuinely just an object shape with no merging need, either works; pick `interface` for public API surfaces because merging stays available later without a breaking change.

### 3. `unknown` vs `any` vs `never`

**Answer.** These sit at the extremes of the type system's usefulness, and confusing them is a fast way to lose a TS interview.

**`any` turns type checking off** for that value, and — this is the part people miss — for everything it subsequently touches. It's virulent:

```typescript
function parse(json: string): any {
  return JSON.parse(json);
}

const user = parse('{"id": 1}');
user.nam.toUpperCase();   // no error — `any` propagated, the typo ships to production
```

`any` isn't "I don't know the type," it's "stop checking this and everything downstream of it." A single `any` at a boundary can silently erase type safety through an entire call chain.

**`unknown` is the type-safe version of "I don't know."** You can assign anything to it, but you can't *use* it until you narrow:

```typescript
function parseSafe(json: string): unknown {
  return JSON.parse(json);
}

const user = parseSafe('{"id": 1}');
user.id;                              // ✗ error: 'user' is of type 'unknown'
if (typeof user === "object" && user !== null && "id" in user) {
  (user as { id: unknown }).id;       // now it type-checks, because you proved something
}
```

Every external boundary — `JSON.parse`, a fetch response, `localStorage.getItem`, a third-party callback payload — should be typed `unknown`, never `any`. It forces the narrowing step that `any` lets you skip and then forget.

**`never` is the bottom type** — a type with no possible values. Functions that always throw or always loop return `never`, and TS uses it to power **exhaustiveness checking**:

```typescript
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "square"; side: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle": return Math.PI * shape.radius ** 2;
    case "square": return shape.side ** 2;
    default: {
      const assertNever: never = shape;   // if a variant is ever added and unhandled here, this LINE fails to compile
      throw new Error(`Unhandled shape: ${assertNever}`);
    }
  }
}
```

The `never` assignment only type-checks if every member of the union has been eliminated by the preceding cases — add a `"triangle"` variant to `Shape` without adding a `case` for it, and the `default` branch stops compiling. It converts "did we forget a case" from a runtime bug into a build failure, which is the single highest-value use of `never` in application code.

---

# PART B — GENERICS DONE PROPERLY

### 4. Generic functions: constraints, defaults, and not over-constraining

**Answer.** A generic parameter is a placeholder that lets the *caller's* type flow through untouched, instead of you widening it to something looser to make the function compile.

```typescript
// Without generics: you'd have to write this per-type, or type items as unknown[]
function groupBy<T, K extends string>(
  items: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  for (const item of items) {
    const key = keyFn(item);
    (result[key] ??= []).push(item);   // ??= avoids re-checking existence separately
  }
  return result;
}

const orders = [{ status: "paid" as const, id: 1 }, { status: "pending" as const, id: 2 }];
const grouped = groupBy(orders, (o) => o.status);
// grouped is Record<"paid" | "pending", { status: ...; id: number }[]> — inferred, not written
```

`K extends string` is a **constraint** — it says "K can be any type, as long as it's assignable to string," which is required because `Record`'s key type must be a valid object key. Without it, `K` could infer as something un-indexable and the whole thing falls apart.

**Default type parameters** matter for ergonomics on rarely-customized generics:

```typescript
interface ApiResponse<TData = unknown> {
  data: TData;
  status: number;
}
// ApiResponse alone still compiles, defaulting TData to unknown rather than erroring
```

**The trap:** over-constraining hurts inference. If you write `groupBy<T extends { id: string }>` because you *think* every caller has an `id`, you've now made the function unusable for anything that doesn't — and TS will infer `T` as the constraint's shape in edge cases rather than the caller's actual richer type. Constrain to the *minimum* shape the function body actually needs, not the shape you expect callers to have.

### 5. Generic React components

**Answer.** The value type should flow from the data you pass in through to every callback, so the compiler — not a code review comment — catches a mismatched `onChange`.

```tsx
interface SelectProps<T> {
  options: T[];
  value: T;
  onChange: (value: T) => void;
  getLabel: (option: T) => string;
  getKey: (option: T) => string;
}

function Select<T>({ options, value, onChange, getLabel, getKey }: SelectProps<T>) {
  return (
    <select
      value={getKey(value)}
      onChange={(e) => {
        const selected = options.find((o) => getKey(o) === e.target.value);
        if (selected) onChange(selected);   // onChange only ever receives a T, never a raw string
      }}
    >
      {options.map((option) => (
        <option key={getKey(option)} value={getKey(option)}>
          {getLabel(option)}
        </option>
      ))}
    </select>
  );
}

interface Currency { code: string; symbol: string; }

<Select<Currency>
  options={currencies}
  value={selectedCurrency}
  onChange={(currency) => setSelectedCurrency(currency)}   // currency: Currency, inferred — not string
  getLabel={(c) => `${c.symbol} ${c.code}`}
  getKey={(c) => c.code}
/>;
```

**Why this beats a non-generic `SelectProps<T = unknown>` with casts inside:** without the generic, `onChange` would have to accept `unknown` or a raw string key, and every call site would need a manual lookup and a type assertion — exactly the kind of cast that survives a refactor silently and breaks at runtime. The generic pushes the type-safety to the call site, where the compiler actually has the information to check it.

**Follow-up:** "why not just `<T,>` with a trailing comma in a `.tsx` file?" Because JSX parses `<T>` as a tag start; `Select<T>({ ... }: SelectProps<T>)` written as an arrow function needs the trailing-comma or `extends unknown` trick (`<T,>(...) => ...` or `<T extends unknown>(...) => ...`) specifically in `.tsx` files. A `function` declaration, as above, sidesteps the ambiguity entirely — which is one real reason to prefer `function` over an arrow for generic components.

### 6. `infer` — pulling a type out of another type

**Answer.** `infer` only appears inside a conditional type, and it lets you *capture* part of a type's structure into a new type variable instead of just testing it.

```typescript
type Awaited2<T> = T extends Promise<infer U> ? U : T;
//                              ^^^^^^^^^^^^^ — "if T is a Promise of something, capture that something as U"

type A = Awaited2<Promise<string>>;   // string
type B = Awaited2<number>;             // number — falls through, not a Promise

type ElementType<T> = T extends (infer U)[] ? U : never;
type C = ElementType<string[]>;   // string
```

This is exactly how the built-in `ReturnType<T>`, `Parameters<T>`, and `Awaited<T>` utility types are implemented — `infer` is the mechanism behind them, not a separate niche feature:

```typescript
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
```

**Why it matters beyond trivia:** any time you're writing your own utility type that needs to reach *into* a generic and pull out a piece of it — the resolved value of a promise, the props type of a component, the element type of an array — `infer` is the only tool that does it. Recognizing that pattern is what separates "I've used `ReturnType`" from "I understand how `ReturnType` works," which is the actual thing being tested.

---

# PART C — MAPPED, CONDITIONAL, AND TEMPLATE LITERAL TYPES

### 7. Mapped types, built from scratch

**Answer.** A mapped type iterates over the keys of an existing type and transforms each property — it's a `for...in` loop at the type level.

```typescript
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

interface Config {
  api: { url: string; timeout: number };
  debug: boolean;
}

type FrozenConfig = DeepReadonly<Config>;
// { readonly api: { readonly url: string; readonly timeout: number }; readonly debug: boolean }
```

`[K in keyof T]` is the mapping clause. The conditional inside (`T[K] extends object ? recurse : T[K]`) is what makes it *deep* rather than shallow — the built-in `Readonly<T>` and `Partial<T>` only go one level.

**The modifiers, and why `+`/`-` exist:**

```typescript
type Mutable<T> = { -readonly [K in keyof T]: T[K] };   // strips readonly
type Required2<T> = { [K in keyof T]-?: T[K] };          // strips the optional modifier
type Optional<T> = { [K in keyof T]+?: T[K] };            // adds it (same as no prefix, but explicit)
```

`+readonly`/`+?` are the same as bare `readonly`/`?` — the interesting one is `-`, because it's the only way to *remove* a modifier a mapped type would otherwise inherit. Without `-readonly`, you cannot write a type that takes a readonly object and produces a mutable one; `Partial`/`Required`'s own implementations use exactly this to invert `?`.

### 8. Conditional types and the distribution surprise

**Answer.** `T extends U ? X : Y` reads like a ternary, and mostly behaves like one — until `T` is a union, where it silently does something most engineers don't expect until they've been bitten by it once.

```typescript
type ToArray<T> = T extends any ? T[] : never;

type Result = ToArray<string | number>;
// You might expect: (string | number)[]
// What you actually get: string[] | number[]
```

This is a **distributive conditional type**: when the checked type is a *bare* type parameter and you feed it a union, TypeScript applies the conditional to *each member of the union separately* and unions the results back together. `ToArray<string | number>` doesn't run once with `T = string | number` — it runs once for `T = string` and once for `T = number`, then unions `string[] | number[]`.

**Before/after, made concrete:**

```typescript
type NonNullable2<T> = T extends null | undefined ? never : T;

type A = NonNullable2<string | null | number>;
// distributes: (string extends null|undefined ? never : string)
//            | (null   extends null|undefined ? never : null)     -> never
//            | (number extends null|undefined ? never : number)
// never is dropped from unions automatically, so A = string | number — this is HOW NonNullable actually works
```

That's genuinely useful here — it's the mechanism behind the built-in `NonNullable`, `Exclude`, and `Extract`. But it's also the thing that produces `string[] | number[]` when a single `(string | number)[]` was intended.

**Opting out — wrap both sides in a tuple:**

```typescript
type ToArrayNonDistributive<T> = [T] extends [any] ? T[] : never;

type Result2 = ToArrayNonDistributive<string | number>;   // (string | number)[] — the union stays whole
```

`[T]` is no longer a *bare* type parameter to the conditional — it's a one-element tuple containing `T` — so distribution doesn't trigger. This `[T] extends [U]` idiom is the standard, if slightly opaque, way to say "treat this union as one thing."

**Follow-up:** "why does this matter in practice?" Any time you write a conditional type over a parameter that callers might pass a union into, you need to consciously decide whether distribution is wanted (it usually is, for `Exclude`-style filtering) or a bug (it usually is, for "wrap the whole type in a container").

### 9. Template literal types — a typed event emitter

**Answer.** Template literal types let you compute string *types*, not just string values, which makes previously-stringly-typed APIs checkable.

```typescript
type EventMap = {
  click: { x: number; y: number };
  submit: { formId: string };
};

type EventName = keyof EventMap;                          // "click" | "submit"
type HandlerName = `on${Capitalize<EventName>}`;           // "onClick" | "onSubmit"

class TypedEmitter<Events extends Record<string, unknown>> {
  private listeners: { [K in keyof Events]?: Array<(payload: Events[K]) => void> } = {};

  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void) {
    (this.listeners[event] ??= []).push(handler);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    this.listeners[event]?.forEach((handler) => handler(payload));
  }
}

const emitter = new TypedEmitter<EventMap>();
emitter.on("click", (payload) => payload.x);         // payload is { x: number; y: number } — no cast
emitter.on("submit", (payload) => payload.formId);   // formId: string
emitter.emit("click", { x: 1, y: 2 });                 // ✗ error if you pass { formId: "..." } here instead
emitter.on("scroll", () => {});                        // ✗ error — "scroll" isn't a key of EventMap
```

Nothing about `on`/`emit` needed a template literal here — the payoff of template literal types shows up when you need to *derive new string unions from existing ones*, as with `HandlerName` above, or when building typed CSS custom property names:

```typescript
type ColorToken = "primary" | "surface" | "danger";
type CssVar = `--color-${ColorToken}`;   // "--color-primary" | "--color-surface" | "--color-danger"

function setToken(name: CssVar, value: string) {
  document.documentElement.style.setProperty(name, value);
}
setToken("--color-primary", "oklch(62% 0.19 295)");   // ✓
setToken("--colour-primary", "red");                    // ✗ typo caught at compile time, not in DevTools
```

### 10. Utility types worth having memorized

| Type | What it does | One-line use case |
|---|---|---|
| `Partial<T>` | Makes every property optional | A patch/update payload — `updateUser(id, patch: Partial<User>)` |
| `Required<T>` | Makes every property required, strips `?` | Asserting a fully-populated config after defaults are merged in |
| `Readonly<T>` | Makes every property `readonly` | Freezing a value passed into a function that shouldn't mutate it |
| `Pick<T, K>` | Selects a subset of keys | A form's editable fields from a larger entity: `Pick<User, "name" \| "email">` |
| `Omit<T, K>` | Excludes a subset of keys | A create-payload without server-assigned fields: `Omit<User, "id" \| "createdAt">` |
| `Record<K, V>` | A map type from key union to value type | `Record<Role, Permission[]>` — a lookup table, keys statically known |
| `Exclude<T, U>` | Removes union members assignable to `U` | Narrowing a broad status union down for one UI state |
| `Extract<T, U>` | Keeps only union members assignable to `U` | Pulling just the error variants out of a discriminated union |
| `ReturnType<T>` | The return type of a function type | Typing a variable from a factory function without duplicating the shape |
| `Parameters<T>` | A tuple of a function type's parameter types | Wrapping a function while forwarding its exact argument types |
| `Awaited<T>` | Unwraps nested `Promise`s (recursively) | The resolved value type of an `async` function's return type |

---

# PART D — NARROWING, `satisfies`, AND CONST ASSERTIONS

### 11. Type guards

**Answer.** Narrowing is how TypeScript lets a wide type become a specific one *within a branch*, and each guard shape narrows differently.

```typescript
function handle(value: string | number | Date | Error) {
  if (typeof value === "string") value.toUpperCase();          // typeof — primitives
  else if (value instanceof Date) value.getFullYear();          // instanceof — class instances
  else if (typeof value === "number") value.toFixed(2);
}

interface Circle { kind: "circle"; radius: number; }
interface Square { kind: "square"; side: number; }
function area(shape: Circle | Square) {
  if ("radius" in shape) return Math.PI * shape.radius ** 2;   // `in` — discriminating by property presence
  return shape.side ** 2;
}
```

**Custom type predicates** are the only clean option when the narrowing logic doesn't reduce to a single `typeof`/`instanceof`/`in` check:

```typescript
interface ApiError { ok: false; message: string; }
interface ApiSuccess<T> { ok: true; data: T; }

function isSuccess<T>(res: ApiSuccess<T> | ApiError): res is ApiSuccess<T> {
  return res.ok === true;
}

async function load() {
  const res = await fetchUser();
  if (isSuccess(res)) return res.data;   // res narrowed to ApiSuccess<User> here
  throw new Error(res.message);           // res narrowed to ApiError here
}
```

The `res is ApiSuccess<T>` return annotation is what makes it a *predicate* rather than a plain boolean function — a plain `boolean` return would type-check identically at the call site but give you no narrowing at all inside the `if`. This is the one place a helper function actually changes what the compiler knows, not just what the code reads like.

### 12. `satisfies` — precise, and precisely misunderstood

**Answer.** `satisfies` checks a value against a type **without changing the value's inferred type**. That's the specific gap between it and a normal annotation, and it's worth being exact about, because most explanations gloss over it.

```typescript
type RouteConfig = Record<string, { path: string; auth: boolean }>;

// Plain annotation — widens every value to RouteConfig's value type
const routesAnnotated: RouteConfig = {
  home: { path: "/", auth: false },
  admin: { path: "/admin", auth: true },
};
routesAnnotated.home.path;     // string — correct, but that's all TS remembers
Object.keys(routesAnnotated);  // string[] — "home" and "admin" specifically are forgotten

// satisfies — checked against RouteConfig, but keeps the literal inferred type
const routesSatisfies = {
  home: { path: "/", auth: false },
  admin: { path: "/admin", auth: true },
} satisfies RouteConfig;
routesSatisfies.home.path;      // still string, and still checked as a valid RouteConfig value
routesSatisfies.notARoute;      // ✗ error — TS still knows the exact key set is only "home" | "admin"
```

With a plain `: RouteConfig` annotation, the object is *widened* to exactly `RouteConfig` and every key-specific detail is thrown away — `Object.keys` returns `string[]`, and typo'd property access like `.notARoute` would actually be caught too (because it's still checked as `RouteConfig`), but any code that wants to iterate the *known* keys, or autocomplete on `"home"` specifically, gets nothing. `satisfies` keeps the narrow, literal type TS would have inferred anyway (`{ home: {...}; admin: {...} }`), while still validating it's assignable to `RouteConfig` — you get the error-checking of an annotation *and* the precision of no annotation at all.

**The trap:** people reach for `satisfies` and expect it to change the *declared* type the way a cast does. It doesn't cast or convert anything — it's purely a compile-time check that runs, then gets out of the way and lets inference proceed as if it weren't there. If you need the value's type to actually *become* `RouteConfig` (for example to pass it somewhere expecting that exact type), you still want a plain annotation, or both.

### 13. `as const` and deriving unions from values

**Answer.** `as const` tells TypeScript to infer the **narrowest possible type** for a literal — a specific string, not `string`; a readonly tuple, not a mutable array — instead of the usual widening.

```typescript
const status = "loading";          // widened to string, unless const-declared in certain contexts
const status2 = "loading" as const; // type is literally "loading"

const point = [10, 20];             // number[]
const point2 = [10, 20] as const;   // readonly [10, 20]
```

**The pattern that comes up constantly — derive a union type from a single array of allowed values,** so the values and the type can never drift apart:

```typescript
const ROLES = ["admin", "editor", "viewer"] as const;
type Role = (typeof ROLES)[number];   // "admin" | "editor" | "viewer"

function hasAccess(role: Role) { /* ... */ }
hasAccess("owner");   // ✗ error — not one of ROLES

// ROLES is still a real array at runtime — usable for a <select>, validation, iteration
ROLES.map((r) => <option key={r} value={r}>{r}</option>);
```

Without `as const`, `ROLES` infers as `string[]`, and `(typeof ROLES)[number]` collapses to plain `string` — the whole point is lost. This single pattern removes an entire class of bug where the allowed-values array and its type annotation are maintained separately and quietly go out of sync.

---

# PART E — TYPING REAL FRONTEND CODE

### 14. Typing React props: `children`, and DOM event handlers

**Answer.** `children: ReactNode` is correct almost everywhere — it accepts strings, numbers, elements, fragments, arrays, and `null`/`undefined`, which is what "anything JSX can render" actually means:

```tsx
interface CardProps { children: React.ReactNode; }
```

`ReactElement` is narrower and correct specifically when you need to call `.type` or `.props` on the child, or you're enforcing "exactly one element, not text or an array" — for example a component that clones its single child to inject a prop:

```tsx
interface TooltipTriggerProps { children: React.ReactElement; }   // must be a single cloneable element

function TooltipTrigger({ children }: TooltipTriggerProps) {
  return React.cloneElement(children, { "aria-describedby": "tooltip" });
}
```

Passing a plain string into a `ReactElement`-typed `children` fails to compile — correctly, since `cloneElement` on a string would crash at runtime.

**DOM event handlers, typed precisely:**

```tsx
function SearchInput() {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    console.log(e.target.value);   // .value exists and is a string — HTMLInputElement is known
  }
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
  }
  return <input onChange={handleChange} />;
}
```

**The trap:** typing a handler's event as `any` (or omitting the type and letting `noImplicitAny` slip through in a loosely configured project) compiles today and breaks silently on the next refactor — rename `target` to something else, change the element type, and nothing complains until it's in production. `ChangeEvent<HTMLInputElement>` vs `ChangeEvent<HTMLSelectElement>` vs `ChangeEvent<HTMLTextAreaElement>` each expose a slightly different `.target` shape; getting the generic right is what makes the handler actually type-safe rather than type-annotated theater.

### 15. A type-safe reducer, briefly

The discriminated-union approach to reducer state — modeling actions as a tagged union and getting compiler-enforced exhaustiveness in the `default` case — is covered in full, with the "four booleans vs four states" contrast, in [`04-react-data.md`](./04-react-data.md). The one addition worth making here: the `never`-based exhaustiveness check from Part A §3 of this document is exactly the mechanism that reducer's `default` branch relies on — same technique, applied to actions instead of shapes:

```typescript
type Action =
  | { type: "increment"; by: number }
  | { type: "reset" };

function reducer(state: number, action: Action): number {
  switch (action.type) {
    case "increment": return state + action.by;
    case "reset": return 0;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
```

### 16. Typing an API client — a type is a hope, Zod is the guarantee

[`11-security.md`](./11-security.md) makes the point that user-facing data must be validated at the boundary and trusted afterward. The same logic applies to *your own backend's* response, and it's worth being blunt about why: a hand-written `interface User { id: string; email: string }` describes what you *expect* the network to send. It compiles away entirely at runtime and enforces nothing — a backend change, a null field, a renamed key all pass straight through it silently.

```typescript
import { z, type ZodSchema } from "zod";

async function get<T>(url: string, schema: ZodSchema<T>): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const json: unknown = await res.json();     // unknown, not `T` — you haven't earned T yet
  return schema.parse(json);                   // throws with a precise diff if the shape is wrong; returns T if not
}

const UserSchema = z.object({ id: z.string(), email: z.string().email() });
type User = z.infer<typeof UserSchema>;         // the TS type is DERIVED from the runtime schema, not hand-duplicated

const user = await get("/api/user/1", UserSchema);   // user: User, and it's genuinely that shape
```

`z.infer<typeof UserSchema>` is the detail that closes the loop — instead of maintaining a Zod schema *and* a hand-written interface that can drift apart, the compile-time type is generated from the single runtime source of truth. One schema, one type, and a thrown error at the exact moment reality stops matching the contract instead of a `Cannot read property 'toUpperCase' of undefined` three components downstream.

### 17. Declaration files and module augmentation

**Answer.** A `.d.ts` file contains **type information only** — no runtime code, nothing emitted to the bundle. You need one in two situations: typing an untyped JS dependency, or augmenting a global/module type you don't own the source of.

```typescript
// types/legacy-widget.d.ts — an untyped JS library with no @types package
declare module "legacy-widget" {
  export function mount(el: HTMLElement, options?: { theme?: string }): void;
  export function unmount(el: HTMLElement): void;
}
```

Without this, importing `legacy-widget` either fails under `noImplicitAny`-adjacent settings or silently types everything from it as `any` — the declaration file is the difference between "typed at the boundary" and "an `any` hole disguised as a normal import."

**Module augmentation** — extending a type someone else defined, most commonly environment variables:

```typescript
// env.d.ts
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_FEATURE_FLAG_NEW_CHECKOUT: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

```typescript
import.meta.env.VITE_API_URL;                // string, autocompletes
import.meta.env.VITE_TYPOED_VAR_NAME;         // ✗ error — caught at compile time, not at 2am in prod
```

Vite ships a generic `ImportMetaEnv`; without this augmentation every env var access types as `any` or `string | undefined` with no autocomplete, and a typo'd env var name reads as `undefined` at runtime with no compiler signal at all.

---

# PART F — ADOPTING STRICT TYPESCRIPT INCREMENTALLY

### 18. What `strict: true` actually turns on

`strict` is a bundle flag — it's worth knowing what's actually inside it, because "just turn on strict" undersells how many independent behaviors change at once:

| Flag | What it catches |
|---|---|
| `strictNullChecks` | `null`/`undefined` are no longer silently assignable to every type — the single highest-value flag, and the one that finds the most real bugs |
| `noImplicitAny` | Parameters and variables with no inferable type stop silently defaulting to `any` |
| `strictFunctionTypes` | Function parameter types are checked contravariantly, catching unsound callback assignments |
| `strictBindCallApply` | `.bind()`, `.call()`, `.apply()` are checked against the function's real signature instead of accepting anything |
| `strictPropertyInitialization` | A class property typed as non-optional must actually be assigned in the constructor |
| `noImplicitThis` | `this` inside a function with no inferable context stops silently typing as `any` |
| `alwaysStrict` | Emits `"use strict"` and parses in strict mode — the JS-level flag, not really a TS type-checking one |

`strictNullChecks` alone typically produces the largest single batch of new errors on an existing codebase, because it's the flag that finally asks "are you sure this can't be `undefined` here?" everywhere at once.

### 19. Migrating an untyped or loosely-typed codebase

[`12-production.md`](./12-production.md) covers the general strangler-fig migration pattern and states the JS→TS case in one line: `allowJs`, rename on touch, `strict: false` initially, tighten per-directory. Applied concretely to TypeScript specifically:

```jsonc
// tsconfig.json — starting point
{
  "compilerOptions": {
    "allowJs": true,        // .js and .ts coexist; nothing needs to move on day one
    "checkJs": false,       // don't type-check the .js files yet — just let them compile
    "strict": false          // turned on per-directory later, not repo-wide
  }
}
```

1. **`allowJs` + rename on touch.** A file becomes `.ts` when you're already editing it for a real reason, never as a standalone renaming sprint that produces a giant unreviewable diff.
2. **`strict: false` at the root, then a stricter override per directory** as it earns it:
   ```jsonc
   { "include": ["src/features/checkout/**/*"], "compilerOptions": { "strict": true } }
   ```
   New code lands strict from day one; old code tightens on its own schedule.
3. **Never flip `strict: true` repo-wide on day one.** On a real untyped codebase this routinely produces thousands of errors in one shot, the team can't absorb the fix cost, and the flag gets reverted within a sprint — a false start that makes the *next* strictness attempt harder to get buy-in for.
4. **`// @ts-expect-error` over `// @ts-ignore`** for the errors you're deliberately deferring — `@ts-expect-error` itself errors if the line it's suppressing ever starts compiling cleanly, so stale suppressions get flagged instead of accumulating silently forever.

### 20. Readability vs cleverness in type-level code

**Answer.** Type-level programming has the same cost curve as runtime abstraction: a well-placed generic saves real bugs; a clever one becomes the file nobody on the team will touch.

**Earns its keep** — the `groupBy<T, K extends string>` from Part B, or the `DeepPartial<T>` from Part C. Both solve a real, recurring problem, read close to their intent even to someone who's never seen `infer`, and the complexity is proportional to the value delivered.

**A maintenance trap** — a hand-rolled recursive conditional type that reconstructs a REST client's route parameters from a template-literal URL pattern, with three levels of nested `infer` and a nested mapped type, to save writing five interfaces by hand. It's a genuinely impressive piece of type-level programming. It's also unreadable to anyone who hasn't specifically studied advanced conditional types, breaks in ways that produce a wall of inscrutable generic-instantiation errors, and turns "add one query param" into a half-day debugging session for whoever touches it next.

**The heuristic:** if the type-level machinery mirrors a problem your team will hit repeatedly (deriving state shapes, keeping a values-array and its union type in sync, catching a forgotten switch case), build it once and use it everywhere — that's leverage. If it exists to avoid typing five lines by hand *once*, the five lines were cheaper, because they're readable by everyone and debuggable in under a minute.

---

# PART G — WHAT ACTUALLY GETS ASKED

### Q: What's the difference between `interface` and `type`, and when do you pick one?

**Model answer.** They overlap heavily for plain object shapes; the differences that matter are declaration merging (`interface` only — critical for augmenting global or third-party types) and expressiveness (`type` only — unions, tuples, mapped and conditional types can't be written as an `interface`). Pick `interface` for object shapes that represent an entity or a public API surface that might need extension later; pick `type` for anything that isn't a plain object — unions, tuples, function types, or anything built from mapped/conditional types. State the merging example (`Window` augmentation) if pushed for specifics — it's the one capability `type` genuinely cannot replicate.

### Q: Type a generic API response wrapper with a discriminated success/error shape.

**Model answer.**

```typescript
type ApiResult<T> =
  | { status: "success"; data: T }
  | { status: "error"; error: { code: string; message: string } };

async function fetchResult<T>(url: string, schema: z.ZodSchema<T>): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { status: "error", error: { code: String(res.status), message: res.statusText } };
    return { status: "success", data: schema.parse(await res.json()) };
  } catch (e) {
    return { status: "error", error: { code: "NETWORK", message: (e as Error).message } };
  }
}

const result = await fetchResult("/api/user/1", UserSchema);
if (result.status === "success") result.data;      // narrowed to T, no cast
else result.error.message;                            // narrowed to the error branch
```

State why this beats `{ data?: T; error?: string }`: with optional fields, `data` and `error` being simultaneously present or simultaneously absent are both representable and both meaningless — the discriminated union makes those states unconstructable, the same argument as the reducer-state pattern in `04-react-data.md`.

### Q: Write a type-safe event emitter.

**Model answer** — walk through the `TypedEmitter<Events>` implementation from Part C §9: a generic class parameterized by an `Events` map, `on`/`emit` both generic over `K extends keyof Events`, so the payload type at each call site is derived from the event name rather than declared separately and kept in sync by hand. Name the mapped-type-over-a-generic pattern (`{ [K in keyof Events]?: ... }`) explicitly if asked to explain the listener storage — it's what lets a single field hold differently-typed listener arrays per event without a cast anywhere in the implementation.

### Q: What does `satisfies` do that a plain type annotation doesn't?

**Model answer.** A plain `: T` annotation *widens* the expression to exactly `T`, discarding any more specific literal information TS would otherwise have inferred. `satisfies T` checks the expression against `T` — so you still get an error if it doesn't conform — but leaves the *inferred* type as the narrow literal type the expression actually has. Give the `RouteConfig` example from Part D §12 concretely: with a plain annotation, `Object.keys(routes)` types as `string[]`; with `satisfies`, the object's specific key set (`"home" | "admin"`) survives, so downstream code that depends on the exact keys — autocomplete, exhaustive iteration, a lookup indexed by a specific key — keeps working. The one-sentence version: `satisfies` validates without widening.

---

## The six sentences worth memorising

1. **TypeScript is structural** — two unrelated interfaces with the same shape are assignable to each other, and only object *literals* get extra excess-property scrutiny.
2. **`any` disables checking and propagates through everything it touches; `unknown` forces narrowing before use** — every network boundary should start as `unknown`, never `any`.
3. **A bare type parameter in a conditional type distributes over a union** — `T extends U ? X : Y` runs once per union member unless you wrap both sides in a tuple: `[T] extends [U]`.
4. **`satisfies` checks against a type without widening to it** — a plain annotation throws away the literal type TS already inferred; `satisfies` keeps it.
5. **A hand-written `interface User {...}` is a hope about the network, not a guarantee** — Zod (or equivalent) at the fetch boundary, with the TS type derived via `z.infer`, is what makes it honest.
6. **Never flip `strict: true` repo-wide on day one of a migration** — `allowJs`, rename on touch, tighten per-directory, or the flag gets reverted before it finds a single bug.

---

*Back to the [answer bank index](./README.md)*
