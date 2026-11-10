> **Not used currently.** Since 2026-11-06 the landing header has no account popper and no session detection: one "Go to studio" link button (https://studio.ultralabs.app) replaces it, and Studio handles its own sign-in redirect. The archived popper code is in `_archive/liquid-glass-old/user-popper/`. This note stays for the case the marketing site ever moves under *.ultralabs.app.

# ul_session presence flag

## Scope: only on the same registrable domain
The flag works **only** when the marketing site runs under the same registrable domain as the apps (`*.ultralabs.app`).

- Today the marketing landing runs on **ultra-labs.eu**. That is a different registrable domain (a different *site*) from **ultralabs.app**. A cookie set with `Domain=.ultralabs.app` is **never sent to and never readable from** ultra-labs.eu. So the production landing has no way to know whether someone is signed in.
- Do not try to work around this. Credentialed cross-site fetches, hidden iframes and postMessage bridges are blocked or partitioned by Safari (ITP) and Chrome (third-party cookie and storage partitioning), and they leak presence across sites.

## What the landing does
- Header config `sessionAware: false` is the default for every variant (`landing`, `docs`). The account popper is **stateless**: "Open Studio" (primary) → `https://studio.ultralabs.app` (Studio redirects to sign-in when there is no session), "Sign in" and "Sign up" → `https://auth.ultralabs.app/auth`. No presence dot.
- The signed-in variant ("Open Studio", "My account", "Sign out" + presence dot) stays in the component. It renders only when `sessionAware` is `true`, either from the explicit `signedIn` prop or from the cookie reader. Use it only if the marketing site is later served from a `*.ultralabs.app` subdomain. The showcase and `landing/chrome/header-spec` turn it on to keep both states testable.

## Cookie (auth app, only relevant once sessionAware is on)
- After sign-in: `ul_session=1; Domain=.ultralabs.app; Path=/; Secure; SameSite=Lax`. Not `HttpOnly` (the header reads it), no token, no user data. Value is always `1`.
- Clear it on sign-out and when the session expires (same Domain and Path, `Max-Age=0`).
- The real session cookie stays `HttpOnly` and is never read by the marketing site.

## Never for access decisions
The flag is a UI hint for presence only. Anyone can set it in their browser. It must never gate content, features, prices or API calls, and nothing may trust it server-side. Studio and the account app check the real session themselves.
