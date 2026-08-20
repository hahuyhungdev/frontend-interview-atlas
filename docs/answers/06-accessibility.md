# Accessibility

Covers §6 of the [knowledge map](../frontend-knowledge-map.md). Explicitly graded at Moniepoint, JioHotstar, Cult.fit, LinkedIn and MakeMyTrip — treated as a requirement, not a bonus.

> Component-level ARIA implementations live in [Machine Coding](./07-machine-coding-core.md) and [Machine Coding II](./08-machine-coding-more.md); this is the model behind them.

---

## Q: Make this dropdown accessible. What does that actually mean?

**Answer — four layers, in order:**

**1. Semantics.** Use the native element when one exists. A real `<button>` gives you keyboard activation, focus, and the correct role for free; a `<div onClick>` gives you none of it and needs `role`, `tabIndex`, and manual Enter/Space handling to reach parity. *The first rule of ARIA is don't use ARIA.*

**2. Keyboard operability.** Everything doable with a mouse must be doable without one: Tab to reach, arrows to move within a composite widget, Enter/Space to activate, Escape to dismiss. **Roving tabindex** is the pattern — exactly one item in the widget has `tabIndex={0}`, the rest `-1`, so Tab enters and leaves the widget while arrows navigate inside it.

**3. State communication.** ARIA describes what native HTML can't: `aria-expanded`, `aria-selected`, `aria-controls`, `aria-labelledby`, `aria-activedescendant`, `aria-current`. Attributes must be kept in sync with real state — stale ARIA is worse than none, because it actively lies to the screen reader.

**4. Focus management.** Opening a modal moves focus into it and traps it there; closing returns focus to the trigger. Async content that changes needs `aria-live="polite"` or the update is silent. Never remove focus outlines — use `:focus-visible` so keyboard users get a ring and mouse users don't.

**Then the non-widget baseline:** 4.5:1 contrast for body text, never color as the *only* signal, touch targets ≥ 44px, labels tied to inputs, alt text that conveys purpose (`alt=""` for decorative), and respecting `prefers-reduced-motion`.

---

## Q: How would you optimize event listeners on a large list? *(LinkedIn)*

**Answer.** **Event delegation** — one listener on the container instead of one per item, relying on bubbling.

```javascript
list.addEventListener("click", (e) => {
  const card = e.target.closest("[data-user-id]");
  if (!card || !list.contains(card)) return;
  handleConnect(card.dataset.userId);
});
```

Three wins: constant memory regardless of list size, **it works for items added later** without rewiring, and cleanup is a single `removeEventListener`.

**Caveats to raise:** some events don't bubble (`focus`, `blur`, `mouseenter`/`mouseleave` — use `focusin`/`focusout` and `mouseover`/`mouseout`), and `e.target` can be a nested child, which is why `closest()` rather than a direct comparison.

**In React** this is mostly moot — React attaches one delegated listener at the root and synthesizes events. Say that; it shows you know the framework already solved it.

---
