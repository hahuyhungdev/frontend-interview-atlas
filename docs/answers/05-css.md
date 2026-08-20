# CSS & Layout

§5 of the [knowledge map](../frontend-knowledge-map.md) is marked ★★ but got only a short section in `04`. CSS is where React-first candidates lose rounds — it cost people at Amazon, BrowserStack, LinkedIn and Apple in this corpus, all of whom ran live layout exercises.

This is the deep version: the models underneath, then the modern features, then the things that actually get graded.

---

## PART A — THE MODELS UNDERNEATH

### 1. Everything is a box, and the box has a sizing mode

```css
/* Default: width applies to the CONTENT only. Padding and border are added on top. */
box-sizing: content-box;   /* 200px width + 20px padding + 2px border = 244px on screen */

/* What you almost always want: width includes padding and border. */
box-sizing: border-box;    /* 200px total, content shrinks to 156px */
```

```css
*, *::before, *::after { box-sizing: border-box; }
```

**Why this reset is universal:** with `content-box`, adding padding to a `width: 100%` element makes it overflow its parent. That single behaviour caused a decade of layout pain.

**Margin collapsing** — the other box surprise. Adjacent vertical margins merge into the larger of the two, rather than summing. `margin-bottom: 20px` above `margin-top: 30px` gives 30px, not 50px. It happens between siblings, between a parent and its first/last child, and in empty blocks.

It does **not** happen in flex or grid containers, or across a border/padding boundary, or with `overflow: hidden`. That's a large part of why modern layouts using `gap` feel predictable — `gap` never collapses.

### 2. Formatting contexts explain the weird behaviour

Most "why is this element doing that" questions come down to which formatting context it's in.

- **Block formatting context (BFC)** — a mini layout world. Created by `overflow` other than visible, `display: flow-root`, flex/grid items, `position: absolute`, `contain: layout`. Inside a BFC: floats are contained, margins don't collapse through it.
- **Flex/grid formatting context** — children become flex/grid items. `float`, `vertical-align` and margin collapsing stop applying entirely.

**The practical use:** `display: flow-root` on a parent contains its floated children with no side effects — the modern replacement for the clearfix hack.

### 3. Stacking contexts and z-index — the full model

Covered briefly in `04`; here is the complete picture, because it is the most commonly misunderstood part of CSS.

`z-index` only compares **siblings within the same stacking context**. A child can never escape its parent's context, however high its z-index.

**What creates a stacking context:**
- `position: relative/absolute` **with** a `z-index` other than auto
- `position: fixed` or `sticky` (always)
- `opacity` less than 1
- `transform`, `filter`, `backdrop-filter`, `perspective`, `clip-path`, `mask`
- `will-change` naming any of the above
- `isolation: isolate`
- `contain: paint` or `content`
- flex/grid children with a `z-index` other than auto

**The trap that actually bites:** you add `transform: translateY(-2px)` for a hover effect, and a dropdown inside that card silently starts rendering behind its siblings. Nothing about the dropdown changed.

**Paint order within one context**, lowest to highest: background/borders → negative z-index → block boxes → floats → inline content → `z-index: 0`/`auto` → positive z-index.

**The fixes, in order of preference:**
1. **Portal** the overlay to `document.body` — escapes the whole problem
2. `isolation: isolate` to deliberately scope a context and stop leakage
3. As a last resort, restructure the DOM so the overlay is a sibling of what it must cover

### 4. Specificity and the cascade

Specificity is `(inline, id, class/attribute/pseudo-class, element/pseudo-element)`, compared left to right:

```css
a                          /* 0,0,0,1 */
.nav a                     /* 0,0,1,1 */
#header .nav a             /* 0,1,1,1 */
[data-open="true"] .nav a  /* 0,0,2,1 */
:is(#a, .b) span           /* 0,1,0,1 — :is takes its MOST specific argument */
:where(#a, .b) span        /* 0,0,0,1 — :where is ALWAYS zero */
```

**`:where()` is the tool for library authors.** Zero specificity means consumers can override your styles with a single class, no `!important` arms race:

```css
:where(.btn) { padding: 0.5rem 1rem; }   /* trivially overridable */
```

**Cascade layers** (`@layer`) sit *above* specificity in the cascade — a rule in a later layer beats an earlier layer regardless of how specific the earlier one is:

```css
@layer reset, base, components, utilities;

@layer components { #very .specific .selector { color: red; } }
@layer utilities  { .text-blue { color: blue; } }   /* wins — later layer */
```

This is the real solution to third-party CSS fighting your own. Put vendor CSS in an early layer and yours in a later one, and specificity stops mattering across the boundary.

**Full cascade order:** origin & importance → **layer** → specificity → source order.

---

## PART B — LAYOUT

### 5. Flexbox — the parts people get wrong

```css
.container {
  display: flex;
  flex-direction: row;        /* main axis: horizontal */
  justify-content: center;    /* along the MAIN axis */
  align-items: center;        /* along the CROSS axis */
  gap: 1rem;                  /* never collapses, unlike margins */
  flex-wrap: wrap;
}
```

**The `flex` shorthand is the thing to know cold:**

| Shorthand | Longhand | Behaviour |
|---|---|---|
| `flex: 1` | `1 1 0%` | All items **equal width**, content ignored |
| `flex: auto` | `1 1 auto` | Items grow **from their content size** |
| `flex: none` | `0 0 auto` | Never grows or shrinks |
| `flex: 0 1 auto` | (the default) | Shrinks if needed, never grows |

`flex: 1` vs `flex: auto` is the difference between equal columns and content-proportional columns. Reach for the wrong one and a long label blows out your layout.

**`min-width: auto` is the classic flexbox bug.** Flex items refuse to shrink below their content's minimum size — so a long unbroken string or a `<pre>` block overflows the container instead of shrinking.

```css
.flex-child { min-width: 0; }        /* the fix, for row direction */
.flex-child { min-height: 0; }       /* the fix, for column direction */
```

This is exactly the bug class behind the article-clipping fix in this project.

### 6. Grid — the parts that earn their keep

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1.5rem;
}
```

**That one line is a fully responsive card grid with no media queries.** Cards are at least 16rem, share space equally above that, and reflow automatically.

- **`auto-fill`** keeps empty tracks — the row stays "full width" with gaps
- **`auto-fit`** collapses empty tracks — remaining items stretch to fill

**Named template areas** make complex layouts readable and trivially rearrangeable per breakpoint:

```css
.app {
  display: grid;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  grid-template-columns: 16rem 1fr;
  grid-template-rows: auto 1fr auto;
  min-height: 100dvh;
}
.app > header { grid-area: header; }
.app > aside  { grid-area: sidebar; }

@media (max-width: 48rem) {
  .app {
    grid-template-areas: "header" "main" "sidebar" "footer";
    grid-template-columns: 1fr;
  }
}
```

**Subgrid** lets a child align to its parent's tracks — the fix for "cards in a grid whose titles and buttons should line up even with different content lengths":

```css
.card {
  grid-row: span 3;
  display: grid;
  grid-template-rows: subgrid;   /* title, body and footer align across all cards */
}
```

**Flexbox vs Grid, stated as a rule:** Grid is layout-first and two-dimensional — you define the structure and place content into it. Flexbox is content-first and one-dimensional — items distribute along one axis according to their own size. A grid cell is very often a flex container.

### 7. Positioning and `position: sticky`

`sticky` is the one people get wrong. It fails silently, and the reasons are always the same three:

```css
.sticky-header {
  position: sticky;
  top: 0;              /* 1. REQUIRED — a threshold must be set */
  z-index: 10;
}
```

1. **No threshold** — `sticky` with no `top`/`bottom`/`left`/`right` does nothing at all.
2. **An ancestor has `overflow: hidden` / `auto` / `scroll`** — sticky positions against the nearest scrolling ancestor, so it sticks inside that box and appears not to work.
3. **The parent is too short** — an element can only stick within its own parent's box. If the parent is exactly as tall as the sticky element, there's no room to travel.

---

## PART C — MODERN CSS WORTH KNOWING

### 8. Container queries — respond to the container, not the viewport

The single biggest shift in CSS since Grid. A component can adapt to the space **it** has, which is what component-based UI actually needs.

```css
.card-wrapper { container-type: inline-size; container-name: card; }

.card { display: grid; gap: 1rem; }

@container card (min-width: 30rem) {
  .card { grid-template-columns: 12rem 1fr; }   /* side-by-side when the CARD is wide */
}
```

**Why this matters:** with media queries, the same card in a sidebar and in a main column must be styled by viewport — which tells you nothing about the space the card actually occupies. Container queries make components genuinely portable.

**Container query units** — `cqi` (inline size), `cqb`, `cqmin`, `cqmax` — size type relative to the container rather than the viewport.

### 9. `:has()` — the parent selector

```css
/* Style a label when the input inside it is invalid */
.field:has(input:invalid) { border-color: var(--danger); }

/* A card that contains an image gets a different layout */
.card:has(> img) { grid-template-columns: 8rem 1fr; }

/* Form-level state without any JavaScript */
form:has(input:checked) .submit { opacity: 1; }

/* "Previous sibling" — impossible before :has */
li:has(+ li:hover) { opacity: 0.5; }
```

`:has()` takes the specificity of its **most specific argument**, and it removes a large class of "I need JavaScript just to add a class" situations.

### 10. Custom properties are more than variables

```css
:root {
  --space: 1rem;
  --brand: oklch(62% 0.19 295);
}
```

They **cascade and inherit**, which plain preprocessor variables cannot do:

```css
.theme-dark { --surface: oklch(20% 0 0); }   /* every descendant now resolves differently */
```

**Runtime-readable and writable from JS** — the bridge between CSS and JS design tokens:

```javascript
element.style.setProperty('--x', `${event.clientX}px`);
getComputedStyle(el).getPropertyValue('--brand');
```

**`@property` gives them a type**, which makes them animatable — plain custom properties are not:

```css
@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
.spinner { transition: --angle 300ms; }   /* now actually animates */
```

**The token pattern that scales:** primitives → semantic → component.

```css
:root {
  --blue-600: oklch(55% 0.2 260);   /* primitive: what it is */
  --color-action: var(--blue-600);  /* semantic: what it means */
}
.btn-primary { background: var(--color-action); }   /* component: where it's used */
```

Only the semantic layer is referenced by components, so rebranding touches one block. This is exactly the Moniepoint story from the corpus — 200+ hardcoded values reduced to ~180 semantic tokens.

### 11. Modern colour: `oklch()`

```css
--brand: oklch(62% 0.19 295);          /* lightness, chroma, hue */
--brand-hover: oklch(from var(--brand) calc(l - 0.08) c h);
--surface: color-mix(in oklch, var(--brand) 8%, white);
```

**Why `oklch` over `hsl`:** HSL lightness is not perceptual — `hsl(60 100% 50%)` (yellow) and `hsl(240 100% 50%)` (blue) claim the same lightness but yellow is drastically brighter. OKLCH lightness *is* perceptually uniform, so a palette generated by varying `L` has consistent contrast across hues. That makes accessible palettes derivable rather than hand-tuned.

### 12. Fluid type and spacing without media queries

```css
:root {
  --step-0: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --step-3: clamp(1.9rem, 1.5rem + 2vw, 3rem);
  --space-section: clamp(3rem, 2rem + 5vw, 8rem);
}
```

`clamp(min, preferred, max)` scales smoothly between breakpoints instead of jumping. **Accessibility caveat worth stating:** a `vw`-only preferred value breaks browser zoom, because viewport units don't respond to it. Always include a `rem` component in the middle term — `1.5rem + 2vw`, never `2vw` alone.

### 13. Logical properties

```css
/* Physical — breaks in right-to-left languages */
margin-left: 1rem;  padding-right: 2rem;  text-align: left;  border-left: 2px;

/* Logical — adapts automatically */
margin-inline-start: 1rem;  padding-inline-end: 2rem;
text-align: start;  border-inline-start: 2px;
```

Also `inline-size`/`block-size` instead of `width`/`height`, and shorthands like `margin-inline: auto` (the modern centering idiom) and `padding-block: 2rem`.

**Use them by default even in an English-only project** — identical cost, and RTL support becomes nearly free later.

---

## PART D — MOTION AND PERFORMANCE

### 14. Animate only what's cheap

The rendering pipeline is **JavaScript → Style → Layout → Paint → Composite**. Which property you animate decides how much of it re-runs per frame:

| Property | Triggers | Cost |
|---|---|---|
| `transform`, `opacity` | Composite only | Cheap — GPU, off main thread |
| `background-color`, `box-shadow`, `border-radius`, `filter` | Paint → Composite | Moderate |
| `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size` | **Layout** → Paint → Composite | Expensive, and cascades to siblings |

```css
/* ✗ layout every frame */
.menu { transition: height 300ms; }

/* ✓ composite only */
.menu { transform: scaleY(0); transform-origin: top; transition: transform 300ms; }
```

**`will-change` is a scalpel, not a blanket.** It promotes an element to its own GPU layer *before* the animation. Applied broadly it exhausts GPU memory and makes things slower. Add it on hover-intent, remove it when the animation ends.

**Animating to `height: auto`** — long impossible, now solved two ways: `interpolate-size: allow-keywords` on `:root`, or a grid with `grid-template-rows: 0fr → 1fr`.

### 15. Respect motion preferences

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Vestibular disorders make parallax and large motion genuinely nauseating. This is a WCAG requirement, not a nicety — and it's a strong signal in an interview because almost nobody adds it unprompted.

### 16. Easing that doesn't look mechanical

```css
--ease-out-quad: cubic-bezier(0.25, 0.46, 0.45, 0.94);
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);   /* fast start, long settle */
--ease-spring:   linear(0, 0.4 20%, 1.02 55%, 0.99 75%, 1);
```

**The rule:** things entering the screen use **ease-out** (fast then settle), things leaving use **ease-in**. `linear` reads as robotic; `ease-in-out` on entry feels sluggish. Durations: 150ms for micro-interactions, 200–300ms for most transitions, 400ms+ only for large movements.

---

## PART E — WHAT ACTUALLY GETS GRADED

The corpus ran live CSS exercises at BrowserStack, Amazon and Apple. The stated criteria were: semantic HTML, Flexbox/Grid, spacing consistency, typography, alignment, responsiveness, component organisation, pixel accuracy.

**The order to work in:**

1. **Semantic HTML first, unstyled.** Get the document right, then style it. `header`/`nav`/`main`/`section`/`article`/`footer` with a correct heading hierarchy.
2. **Extract the system before the components** — spacing scale, type scale, colours, radii as custom properties. This is what separates a designed page from an eyeballed one.
3. **Layout outside-in** — page grid, then sections, then components.
4. **Spacing consistency over pixel accuracy.** The corpus is explicit: *"maintaining proper layout and visual consistency was more important than achieving a perfect match."*
5. **Responsive as you go**, not bolted on afterwards.

**The Amazon lesson, worth repeating:** the candidate reached for React + Tailwind and was asked to redo it in plain HTML/CSS. If a live exercise doesn't specify, build it with semantic HTML and hand-written CSS so the fundamentals are visible, and *say* where you'd reach for a framework in production.

**A useful debugging one-liner:**

```css
* { outline: 1px solid oklch(70% 0.15 20 / 0.4); }
```

Instantly reveals overflow, unexpected margins and misalignment.

---

## The five sentences worth memorising

1. **`z-index` only compares siblings inside the same stacking context** — and `transform`, `opacity`, `filter` all silently create one.
2. **`flex: 1` is `1 1 0%` (equal), `flex: auto` is `1 1 auto` (content-proportional)** — and flex items need `min-width: 0` to shrink below their content.
3. **Grid is two-dimensional and layout-first; Flexbox is one-dimensional and content-first** — a grid cell is usually a flex container.
4. **Only `transform` and `opacity` skip layout and paint** — everything else costs real work every frame.
5. **Container queries let a component respond to its own space**, which is what media queries never could.

---

*Next: [`03-react-advanced.md`](./03-react-advanced.md) — React beyond hooks and re-renders.*
