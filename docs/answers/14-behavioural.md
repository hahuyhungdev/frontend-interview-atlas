# Behavioural & Engineering Maturity

Covers §21 of the [knowledge map](../frontend-knowledge-map.md). Two loops in the corpus ended here after clean technical rounds — this is not filler.

---

*Two loops in the corpus ended here after clean technical rounds. This is not filler.*

## Q: Why are you looking for a change? / Will you relocate?

**The corpus context:** JioHotstar and Cult.fit both spent the hiring-manager round almost entirely on relocation and retention, and both rejected on those grounds despite positive technical feedback.

**Answer structure — pull, not push.** Lead with what you're moving *toward*, not what you're escaping. Criticizing your current employer reads as risk. "I've taken my current role as far as it goes on scale — I want to work on systems serving millions of users and learn from a larger frontend org" is a reason to hire you. "My manager is difficult" is a reason to worry.

**On relocation, be direct and specific.** Vagueness reads as "will leave in six months," which is exactly the fear. If you'll relocate, say so with a timeline. If you want remote or hybrid, say that plainly and let them decide. A clear no is far better received than an ambiguous yes, and the ambiguity is what sank both loops here.

**Address retention before they raise it.** "I've been at my current company three years and I'm looking for somewhere I can grow over a similar horizon" pre-empts the concern.

---

## Q: Tell me about a challenging project. *(STAR)*

**Structure**, with the time budget that matters:

- **Situation** (15%) — context, just enough to make the stakes legible.
- **Task** (15%) — *your* specific responsibility, not the team's.
- **Action** (50%) — what **you** did, decisions made, alternatives rejected and why.
- **Result** (20%) — quantified where possible, plus what you learned.

**The three most common failures:** narrating team accomplishments with "we" throughout so your contribution is invisible; describing what happened without the *decisions*; and no measurable outcome.

**Prepare four stories that flex to most questions:** a hard technical problem you solved, a conflict or disagreement you navigated, a failure and what changed afterward, and something you owned end-to-end. Have numbers.

---

## Q: Walk me through a project on your resume.

**The corpus is emphatic:** *"Expect follow-up questions on every project you mention"* and *"be prepared to justify every technology you mention."*

**Structure:** what the product did and who used it → your specific scope → the architecture and *why that shape* → the hardest problem and how you solved it → what you'd do differently now.

**Prepare a justification for every line on your resume.** If it says Redux, be ready for "why not Context?" If it says Next.js, "why not plain React?" If it says a microfrontend, "what did that cost you?" A technology you can't defend is worse than one you never listed — it reads as résumé padding, and interviewers probe exactly there.

**"What would you do differently"** is a strength question disguised as a weakness question. A candidate with no critique of their own past work hasn't reflected on it. Give a real one with the reasoning that changed.

---

## Q: How do you handle disagreement with a senior engineer?

**Answer.** Separate the decision from the person. Establish what you actually disagree about — usually it's priorities or constraints, not facts. Bring data: a benchmark, a prototype, a failure case. Make your reasoning falsifiable and invite correction.

Then the part that matters most: **disagree and commit.** If the decision goes against you, support it fully — no passive resistance, no "I told you so" when problems surface. Write down the concern and the revisit condition ("if p95 goes above X, we should reconsider"), so it's a documented engineering decision rather than a grudge.

**Have a real example where you were wrong.** It's more persuasive than one where you were right, because it demonstrates you actually update.

---

## Q: How do you monitor and debug production issues? *(MakeMyTrip's hiring-manager round)*

**Answer — four layers:**

1. **Error tracking** (Sentry) — capture exceptions with source maps for readable stacks, release tagging, and user context. Alert on rate spikes, not individual errors.
2. **RUM** — real Core Web Vitals from real users at p75/p95, segmented by device and geography. Lab numbers hide the tail.
3. **Structured event logging** — a centralized event taxonomy (`ORDER_CREATED`, not free-text), so funnels and drop-off are queryable.
4. **API observability** — client-side failure rates and latencies per endpoint, which catch problems the backend's own metrics miss (CORS, timeouts, offline, ad blockers).

**For a user-reported bug:** reproduce with their exact context (browser, device, feature flags, account state) → check error tracking for correlated exceptions → session replay if available → bisect by release. **Then add a regression test**, so the same bug can't return silently.

---

*Back to the [knowledge map](../frontend-knowledge-map.md) · [corpus analysis](../frontend-react-insights.md)*
