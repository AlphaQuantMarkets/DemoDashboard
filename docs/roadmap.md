# AlphaQuant — Development Roadmap

> Companion document to [docs/architecture.md](architecture.md). This roadmap turns the findings in that document's §11 (Technical Debt) and §12 (Missing Features) into sequenced, shippable milestones. **Nothing in this document has been implemented** — it is planning only.

## How to read this roadmap

- Milestones are grouped into 5 phases, ordered by priority: security first, then correctness, then cleanup, then feature completeness, then longer-horizon growth.
- Every milestone touches **fewer than 10 files** by design, so each can land as a single reviewable PR.
- **Complexity** uses T-shirt sizing against a solo engineer's time: `XS` (<1 day), `S` (1–2 days), `M` (3–5 days), `L` (5–10 days). Nothing here is sized `XL` — anything that would be is a sign it needs to be split into more milestones before work starts.
- **Depends on** lists milestone IDs that must land first. Milestones without a listed dependency can be picked up independently/in parallel.
- File lists use repo-relative paths from `docs/architecture.md`. `(new)` marks a file to be created; `(delete)` marks a file/directory to be removed.

## Milestone summary

| ID | Phase | Objective | Complexity | Depends on |
|---|---|---|---|---|
| [M1](#m1-hash-and-verify-passwords-properly) | 1. Security Hardening | Hash passwords with bcrypt instead of storing/comparing plaintext | S | — |
| [M2](#m2-real-session-based-authentication) | 1. Security Hardening | Replace trust-the-client `localStorage` auth with server-issued JWT sessions | M | M1 |
| [M3](#m3-enforce-ai-tutor-premium-access-server-side) | 1. Security Hardening | Tie premium gating to real identity and enforce it server-side | S | M2 |
| [M4](#m4-backend-hardening-cors-rate-limiting-env-docs) | 1. Security Hardening | Lock down CORS, add rate limiting, document required env vars | S | — |
| [M5](#m5-consolidate-the-stock-data-sync-pipeline) | 2. Data Integrity | Retire the redundant/unused Node cron sync worker, keep one source of truth | XS | — |
| [M6](#m6-version-controlled-database-schema) | 2. Data Integrity | Add checked-in SQL migrations for `users` and `stock_prices` | S | — |
| [M7](#m7-replace-fake-beta-with-a-real-calculation) | 2. Data Integrity | Compute Beta from real covariance against a benchmark index instead of a random number | M | M6 |
| [M8](#m8-backend-mediated-stock-data-api) | 2. Data Integrity | Move price-data reads behind the Express API instead of direct client-side Supabase access | M | M6 |
| [M9](#m9-remove-dead-and-legacy-code) | 3. Cleanup & Consistency | Delete commented-out/unused code paths flagged in the architecture audit | XS | — |
| [M10](#m10-centralize-frontend-configuration) | 3. Cleanup & Consistency | Single shared config for API base URL / Supabase keys instead of duplicated hardcoded values | S | — |
| [M11](#m11-deduplicate-the-learn-modules-about-page-and-assets) | 3. Cleanup & Consistency | Remove duplicated About page and asset copies under `frontend/Learn/` | XS | — |
| [M12](#m12-persist-user-scoped-state-server-side) | 4. Feature Completeness | Move watchlist and learning progress from `localStorage` to per-user backend storage | M | M2, M6 |
| [M13](#m13-ai-response-validation-guardrail-layer) | 4. Feature Completeness | Add a real, code-level check that Gemini responses contain no buy/sell/hold language | S | — |
| [M14](#m14-backend-automated-test-suite--ci) | 4. Feature Completeness | Stand up a test suite and CI workflow for the backend | M | M1 |
| [M15](#m15-structured-logging--observability) | 4. Feature Completeness | Replace `console.log`/`console.error` with structured logging | S | — |
| [M16](#m16-admin-back-office-mvp) | 5. Platform Growth | Minimal protected admin view (user count, recent signups, health) | M | M2 |
| [M17](#m17-i18n-scaffolding-pilot) | 5. Platform Growth | Introduce a strings-file/loader pattern, piloted on one surface | M | — |
| [M18](#m18-subscription-billing-foundation-stripe-scaffold) | 5. Platform Growth | Scaffold a `subscriptions` table and Stripe service stub behind the real premium gate | L | M3, M6 |

---

## Phase 1 — Security Hardening

These are the highest-severity items from architecture.md §11 (items #1–3) and block almost everything else that touches identity.

### M1: Hash and verify passwords properly

**Objective:** Stop storing and comparing passwords in plaintext. `bcrypt` is already a declared dependency and is currently unused — wire it in.

**Complexity:** S (1–2 days)

**Affected files:**
- `backend/routes/auth.js` — hash on signup (`bcrypt.hash`), verify on login (`bcrypt.compare`) instead of `INSERT`/`===` on raw passwords
- `backend/package.json` — no dependency change needed (bcrypt already listed); bump/confirm version pin
- `backend/migrations/0000_rehash_or_reset_existing_passwords.sql` (new) — one-time remediation for any existing plaintext rows (reset or force password-change flow; do not silently "hash the plaintext" without invalidating old sessions)

**Acceptance criteria:**
- [ ] `POST /api/auth/signup` never writes a plaintext password to the database.
- [ ] `POST /api/auth/login` verifies via `bcrypt.compare` and returns 401 on mismatch, exactly as before from the client's perspective.
- [ ] Any pre-existing plaintext-password rows are migrated or invalidated — not silently left in place.
- [ ] `GET /api/auth/signup` response no longer includes the password field in any form (currently returns `RETURNING *`).

---

### M2: Real session-based authentication

**Objective:** Replace the current "client remembers a JSON blob in `localStorage`" pseudo-auth with a server-issued, server-verifiable token (JWT), so backend routes can actually know who is calling them.

**Complexity:** M (3–5 days)

**Affected files:**
- `backend/routes/auth.js` — issue a signed JWT on successful login/signup
- `backend/middleware/authMiddleware.js` (new) — verifies `Authorization: Bearer <token>` and attaches `req.user`
- `backend/package.json` — add `jsonwebtoken`
- `frontend/auth.js` — store the returned token (not the raw user object) and attach it as an `Authorization` header on subsequent requests
- `ai-tutor/tutorApi.js` — attach the stored token to `/api/ai/tutor` calls
- `frontend/app.js` — read `currentUser` from a decoded/validated token rather than trusting raw `localStorage["user"]`

**Acceptance criteria:**
- [ ] A successful login/signup returns a signed token with a defined expiry (e.g. 7 days).
- [ ] At least one backend route enforces `authMiddleware` and returns 401 for missing/invalid/expired tokens (used to validate the middleware works end to end).
- [ ] The frontend no longer treats presence of `localStorage["user"]` alone as proof of identity for anything security-relevant.
- [ ] Existing login/signup UX (modal, alerts, navbar state) continues to work unchanged from the user's point of view.

---

### M3: Enforce AI Tutor premium access server-side

**Objective:** Make `requirePremiumTutorAccess` actually check something real instead of being a no-op unless an unset env var equals `"required"`, and tie the client-side gate to the same source of truth.

**Complexity:** S (1–2 days)

**Depends on:** M2 (needs a verifiable identity to check premium status against)

**Affected files:**
- `backend/migrations/0001_add_users_is_premium.sql` (new) — add `is_premium boolean default false` to `users`
- `backend/services/tutorAccess.js` — check `req.user.is_premium` (from the verified JWT/DB lookup) instead of an environment flag
- `backend/routes/ai.js` — ensure `authMiddleware` runs before `requirePremiumTutorAccess`
- `ai-tutor/premiumAccess.js` — derive premium state from the authenticated session/token, not from arbitrary `localStorage["user"]` fields the client can set itself
- `ai-tutor/tutorPage.js` — remove reliance on the localhost-only dev-bypass flag, or gate it behind an explicit backend "dev mode" response instead of a client-settable flag

**Acceptance criteria:**
- [ ] Calling `POST /api/ai/tutor` directly (e.g. via curl) with no/invalid token is rejected before it reaches Gemini.
- [ ] A non-premium authenticated user receives a 403 with the existing `PREMIUM_REQUIRED` error code.
- [ ] Setting `localStorage.user.isPremium = true` in devtools no longer grants tutor access.
- [ ] A documented way exists to flip a test user's `is_premium` flag for local development (SQL snippet or seed script, not a client-trusted flag).

---

### M4: Backend hardening (CORS, rate limiting, env docs)

**Objective:** Close the "wide open" gaps noted in architecture.md §11.12 — unrestricted CORS, no rate limiting, undocumented required env vars.

**Complexity:** S (1–2 days)

**Affected files:**
- `backend/server.js` — restrict `cors()` to known frontend origins; mount rate-limiting middleware on `/api/*`
- `backend/package.json` — add `express-rate-limit`
- `backend/.env.example` (new) — document `DATABASE_URL`, `GEMINI_API_KEY`, `PORT`, `AI_TUTOR_PREMIUM_MODE` (or its M3 replacement), `JWT_SECRET` (from M2)
- `README.md` — point to `backend/.env.example` in a "local setup" note

**Acceptance criteria:**
- [ ] Requests from origins outside an explicit allowlist are rejected by CORS in a non-development environment.
- [ ] `POST /api/auth/login`, `POST /api/auth/signup`, and `POST /api/ai/tutor` return `429` after a defined threshold of requests from the same client in a time window.
- [ ] A new contributor can run the backend locally using only `backend/.env.example` as a reference, with no undocumented required variable.

---

## Phase 2 — Data Integrity & Correctness

Addresses architecture.md §11 items #6–8: redundant sync pipelines, no schema in version control, and a fabricated risk metric presented as real.

### M5: Consolidate the stock data sync pipeline

**Objective:** Remove the unused, drifted `backend/update-data.js` (Node/`node-cron`, pulls from `api.vnstock.bio`, not run by CI) so there is exactly one supported sync path: `backend/update_stock.py` via GitHub Actions.

**Complexity:** XS (<1 day)

**Affected files:**
- `backend/update-data.js` (delete)
- `backend/package.json` — remove the `update-data` and `dev` (nodemon) scripts and the now-unneeded `node-cron`/`axios` dependencies if nothing else uses them
- `README.md` — remove any reference to the Node sync worker; document `update_stock.py` + the GitHub Actions schedule as the single source of truth

**Acceptance criteria:**
- [ ] Only one script in the repo writes to `stock_prices`.
- [ ] `npm run` in `backend/` no longer exposes a script that starts a second, unscheduled sync process.
- [ ] `.github/workflows/update-stock.yml` is unaffected and continues to be the only scheduled data sync.

---

### M6: Version-controlled database schema

**Objective:** Check in SQL migrations for both the `users` table (`DATABASE_URL`) and `stock_prices` table (Supabase), replacing schemas that currently exist only implicitly in query code.

**Complexity:** S (1–2 days)

**Affected files:**
- `backend/migrations/0002_create_users.sql` (new)
- `backend/migrations/0003_create_stock_prices.sql` (new)
- `backend/package.json` — add a migration runner (e.g. `node-pg-migrate`) and a `migrate` script
- `backend/db.js` — no functional change; add a comment pointing to the migrations directory as the schema source of truth
- `README.md` — document how to run migrations for local setup

**Acceptance criteria:**
- [ ] Running the migration script against an empty Postgres database produces a `users` table matching current production columns (`id`, `username` unique, `password`, plus `is_premium` if M3 has landed).
- [ ] Running it against an empty Supabase/Postgres database produces a `stock_prices` table with the unique constraint on `(symbol, trading_date)` that `update_stock.py` already relies on.
- [ ] No manual/undocumented schema step is required to stand up a fresh environment.

---

### M7: Replace fake Beta with a real calculation

**Objective:** Fix the correctness issue in architecture.md §11.8 — the dashboard currently shows a seeded-random "Beta" alongside genuinely computed volatility/Sharpe/drawdown, misrepresenting simulated data as real analysis.

**Complexity:** M (3–5 days)

**Depends on:** M6 (needs a stable place to add a benchmark symbol to the synced universe)

**Affected files:**
- `backend/update_stock.py` — add a benchmark index symbol (e.g. `VNINDEX`) to the synced ticker set
- `frontend/app.js` — `computeMetrics()`: replace the random Beta with `cov(stock returns, benchmark returns) / var(benchmark returns)`; fetch/cache benchmark series alongside the selected stock's series
- `frontend/stocks.json` — add the benchmark symbol's display metadata (excluded from the user-facing ticker picker, used only as the comparison series)

**Acceptance criteria:**
- [ ] Beta is computed from the same real Supabase price data already used for volatility/Sharpe/drawdown — no `Math.random()` in the metrics path.
- [ ] The seeded-random Beta code path (`app.js:135-136` region, per architecture.md §2.1) is fully removed, not left dead alongside the new logic.
- [ ] Beta updates correctly when switching between tickers and time periods, matching manual spot-checks against a reference calculation.

---

### M8: Backend-mediated stock data API

**Objective:** Address the "no unified API layer for market data" gap (architecture.md §12) by giving the Express backend a `/api/stocks` surface, and pointing the main dashboard at it instead of querying Supabase directly from the browser.

**Complexity:** M (3–5 days)

**Depends on:** M6

**Affected files:**
- `backend/routes/stocks.js` (new) — `GET /api/stocks/:symbol/history`, backed by the Supabase service-role client server-side
- `backend/services/stockService.js` (new) — wraps the Supabase query/pagination logic currently duplicated ad hoc in `frontend/app.js`
- `backend/server.js` — mount `/api/stocks`
- `frontend/app.js` — `loadStockData()` calls the new backend endpoint instead of `window.supabaseClient` directly
- `frontend/supabase.js` — scope down to only what's still needed client-side (or remove if nothing remains — see acceptance criteria)
- `frontend/index.html` — remove the Supabase JS SDK `<script>` tag if `frontend/supabase.js` is fully retired

**Acceptance criteria:**
- [ ] The dashboard renders identical price/volume/candlestick data as before, sourced through `/api/stocks/...` instead of a direct Supabase client call.
- [ ] The Supabase anon key is no longer required in any file shipped to the browser (removed or left only where still genuinely needed, with a documented reason).
- [ ] Backend response times/pagination behavior are validated against the existing 500-row/ticker cap so no regression in load time.

---

## Phase 3 — Cleanup & Consistency

Addresses architecture.md §11 items #5, #9–10 and §8. Each of these is intentionally small and independent so they can be picked up opportunistically.

### M9: Remove dead and legacy code

**Objective:** Delete the code paths the architecture audit flagged as unused, so the codebase reflects what actually runs.

**Complexity:** XS (<1 day)

**Affected files:**
- `frontend/app.js` — remove the commented-out `fetch('https://api.anthropic.com/v1/messages', ...)` block, the unused `generateStockData()`/seeded-PRNG generator, and the `fakeStockCache` localStorage cleanup shim
- `frontend/Learn/guide.json` (delete) — confirmed unreferenced by `Learn/app.js`
- `frontend/Learn/stocks.json` (delete) — confirmed unreferenced by `Learn/app.js`

**Acceptance criteria:**
- [ ] `grep`-ing the repo for `api.anthropic.com`, `generateStockData`, and `fakeStockCache` returns no matches.
- [ ] The Learn module continues to function identically (it never read these JSON files to begin with, per architecture.md §2.2).
- [ ] No behavior change is observable in the running app — this is a pure deletion milestone.

---

### M10: Centralize frontend configuration

**Objective:** Fix the duplicated/inconsistent hardcoded backend URL and Supabase credentials (architecture.md §8) by introducing one shared config file.

**Complexity:** S (1–2 days)

**Affected files:**
- `frontend/config.js` (new) — exports `API_BASE_URL` and Supabase URL/key as named constants
- `frontend/auth.js` — use `API_BASE_URL` instead of the two hardcoded literals
- `frontend/supabase.js` — use the shared constants (if still present after M8) instead of its own hardcoded values
- `ai-tutor/tutorApi.js` — use the same `API_BASE_URL` instead of the unset `window.ALPHAQUANT_API_BASE_URL` fallback pattern
- `frontend/index.html` — include `config.js` before `auth.js`/`supabase.js`
- `ai-tutor/index.html` — include `config.js` before `tutorApi.js`

**Acceptance criteria:**
- [ ] There is exactly one place in the frontend codebase where the backend base URL string literal appears.
- [ ] The AI Tutor page works correctly whether served from the Express host or from a static origin, because it now resolves the same explicit `API_BASE_URL` the dashboard uses (closing the inconsistency noted in architecture.md §2.3).
- [ ] Changing environments (e.g. pointing at a staging backend) requires editing exactly one file.

---

### M11: Deduplicate the Learn module's About page and assets

**Objective:** Remove the full duplicate of `frontend/aboutalphaquant/` living under `frontend/Learn/aboutalphaquant/`, and the duplicated image assets, per architecture.md §2.2/§8.

**Complexity:** XS (<1 day)

**Affected files:**
- `frontend/Learn/aboutalphaquant/` (delete directory)
- `frontend/Learn/assets/` (delete duplicated `banner.png`, `chatbot.png`, `home-button.jpg` — keep only what's genuinely Learn-specific, if anything)
- `frontend/Learn/index.html` — point the "Giới thiệu"/About link at `../aboutalphaquant/aboutalphaquant.html` instead of the local duplicate

**Acceptance criteria:**
- [ ] Only one copy of the About page and its assets exists in the repo.
- [ ] Navigating to "About" from within the Learn module lands on the same content as from the main dashboard.
- [ ] No broken image links or 404s in the Learn module after asset removal (manually verified in-browser).

---

## Phase 4 — Feature Completeness

Addresses the remaining high-value gaps from architecture.md §12: no persisted user data, no AI response validation, no tests, no observability.

### M12: Persist user-scoped state server-side

**Objective:** Move watchlist (`frontend/app.js`) and learning progress (`frontend/Learn/app.js`, currently `alphaquant_learning_state_v1`) from `localStorage`-only to per-user backend storage, so state survives across devices/cache clears.

**Complexity:** M (3–5 days)

**Depends on:** M2 (needs real identity), M6 (needs schema/migration workflow in place)

**Affected files:**
- `backend/migrations/0004_create_user_state.sql` (new) — `user_watchlists` and `user_learning_progress` tables keyed on `user_id`
- `backend/routes/userState.js` (new) — `GET/PUT` endpoints for watchlist and learning progress, protected by `authMiddleware`
- `backend/server.js` — mount the new route
- `frontend/app.js` — sync watchlist to the backend on change, falling back to `localStorage` for logged-out users
- `frontend/Learn/app.js` — sync learning progress the same way

**Acceptance criteria:**
- [ ] A logged-in user's watchlist persists across a `localStorage` clear (verified by reloading after clearing site data while a valid session token exists).
- [ ] The same holds for learning progress (lessons completed, XP, level).
- [ ] Logged-out users retain the current `localStorage`-only behavior — this milestone adds persistence, it doesn't require login to use either feature.

---

### M13: AI response validation/guardrail layer

**Objective:** Add a code-level check on Gemini's output before it reaches the user, rather than relying solely on prompt instructions — closing the gap between the README's "Response Validation" step and what the code actually does (architecture.md §9).

**Complexity:** S (1–2 days)

**Affected files:**
- `backend/services/responseValidator.js` (new) — flags/redacts responses containing directive buy/sell/hold language against a defined keyword/pattern list
- `backend/routes/ai.js` — run the validator on `askGemini()`'s output before responding; on a flagged response, return a safe fallback message instead
- `backend/prompts/tutorPrompt.js` — minor adjustment if needed to keep prompt and validator vocabulary consistent

**Acceptance criteria:**
- [ ] A response containing clearly directive language (e.g. "you should buy X now") is caught and replaced with a fallback, verified via a test prompt engineered to elicit that language.
- [ ] Normal educational responses pass through unchanged.
- [ ] The validation step is logged (which response was flagged, if any) for later review.

---

### M14: Backend automated test suite + CI

**Objective:** Add the test coverage and CI enforcement architecture.md §11.11 notes is completely absent today.

**Complexity:** M (3–5 days)

**Depends on:** M1 (tests should exercise the real hashing behavior, not plaintext comparison)

**Affected files:**
- `backend/package.json` — add `jest` and `supertest`, replace the placeholder `test` script
- `backend/tests/auth.test.js` (new) — signup/login happy path + duplicate-username + wrong-password cases
- `backend/tests/ai.test.js` (new) — request validation cases for `/api/ai/tutor` (missing question, over-length question, non-premium rejection)
- `backend/server.js` — export the `app` instance separately from the `listen()` call so tests can import it without binding a port
- `.github/workflows/backend-tests.yml` (new) — run `npm test` in `backend/` on every PR

**Acceptance criteria:**
- [ ] `npm test` in `backend/` runs and passes locally against a test database/mocked dependencies.
- [ ] CI fails a PR that breaks either the auth or AI route's core validation logic.
- [ ] No real Gemini or production database calls are made during the test run (mocked/stubbed).

---

### M15: Structured logging & observability

**Objective:** Replace ad hoc `console.log`/`console.error` calls with structured, leveled logging as a foundation for future monitoring (architecture.md §11.12).

**Complexity:** S (1–2 days)

**Affected files:**
- `backend/server.js` — add a logging middleware (e.g. `pino-http`) for request logs
- `backend/package.json` — add the logging dependency
- `backend/routes/auth.js` — replace `console.log`/`console.error` with the structured logger
- `backend/routes/ai.js` — same
- `backend/db.js` — log connection errors through the same logger instead of an unhandled/ad hoc path

**Acceptance criteria:**
- [ ] Every request to the backend produces a structured log line (method, path, status, duration).
- [ ] No remaining `console.log`/`console.error` calls in `backend/routes/` or `backend/db.js`.
- [ ] Log output includes enough detail to debug a failed login or a failed Gemini call without additional instrumentation.

---

## Phase 5 — Platform Growth

Longer-horizon items from architecture.md §12. These are scoped as **foundations only** — each is deliberately narrow so it fits the file-count constraint; full delivery of admin tooling, i18n, and billing each needs further follow-on milestones once the foundation lands.

### M16: Admin/back-office MVP

**Objective:** Give the team a minimal, protected way to see basic operational data (user count, recent signups, backend health) without touching the database directly — the smallest possible slice of architecture.md §12's "no admin/back-office tooling" gap.

**Complexity:** M (3–5 days)

**Depends on:** M2 (needs real auth to protect the admin view)

**Affected files:**
- `backend/migrations/0005_add_users_role.sql` (new) — `role` column on `users` (`user` / `admin`)
- `backend/middleware/requireAdmin.js` (new) — checks `req.user.role === 'admin'`
- `backend/routes/admin.js` (new) — `GET /api/admin/summary` (user count, signups in last 7 days, `/api/health` data merged in)
- `backend/server.js` — mount `/api/admin`

**Acceptance criteria:**
- [ ] A non-admin authenticated user gets 403 from `/api/admin/summary`.
- [ ] An admin user gets accurate counts matching a manual SQL query against the same database.
- [ ] No frontend UI is required for this milestone — it's an API foundation; a UI is explicitly out of scope and would be a follow-up milestone.

---

### M17: i18n scaffolding (pilot)

**Objective:** Introduce a strings-file/loader pattern instead of hardcoded Vietnamese/English text, piloted on the smallest reasonable surface rather than attempting the full app at once (which would blow past the 10-file constraint — architecture.md §12 notes text is scattered across `app.js`, `Learn/app.js`, and `tutorPrompt.js`).

**Complexity:** M (3–5 days)

**Affected files:**
- `frontend/i18n/vi.json` (new) — extracted strings for the navbar + auth modal only (pilot scope)
- `frontend/i18n/en.json` (new) — English equivalents
- `frontend/i18n.js` (new) — minimal loader (`t(key)` lookup, defaulting to `vi`)
- `frontend/index.html` — navbar/auth-modal markup references string keys instead of inline text
- `frontend/auth.js` — alert/error strings pulled from the loader

**Acceptance criteria:**
- [ ] The navbar and auth modal render identically to today when the loader defaults to `vi`.
- [ ] Switching the loader's active locale to `en` (manually, no UI toggle required yet) renders the navbar and auth modal in English with no missing-key fallbacks.
- [ ] A follow-up-work note is left (e.g. in `README.md` or a tracked issue) listing the remaining surfaces (`app.js`, `Learn/app.js`, `tutorPrompt.js`) still to migrate — this milestone is explicitly a pilot, not full coverage.

---

### M18: Subscription/billing foundation (Stripe scaffold)

**Objective:** Lay the groundwork for real subscription billing behind the premium gate established in M3 — schema and a service stub only, not a full checkout flow (which is its own multi-milestone effort).

**Complexity:** L (5–10 days)

**Depends on:** M3, M6

**Affected files:**
- `backend/migrations/0006_create_subscriptions.sql` (new) — `subscriptions` table (`user_id`, `stripe_customer_id`, `status`, `current_period_end`)
- `backend/services/stripeService.js` (new) — thin wrapper for creating a Stripe customer and checkout session (no webhook handling yet)
- `backend/routes/billing.js` (new) — `POST /api/billing/checkout-session` (creates a session, returns the redirect URL)
- `backend/server.js` — mount `/api/billing`
- `backend/.env.example` — add `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`
- `backend/services/tutorAccess.js` — read premium status from `subscriptions.status` instead of only `users.is_premium`, falling back to the M3 flag during rollout

**Acceptance criteria:**
- [ ] Hitting `/api/billing/checkout-session` as an authenticated user returns a valid Stripe-hosted checkout URL (test-mode Stripe account).
- [ ] No webhook handling, payment-status syncing, or frontend checkout UI is claimed as done by this milestone — those are explicitly follow-up work, called out in the PR description.
- [ ] Existing `is_premium`-based access (from M3) continues to work unchanged for any user who isn't yet in the `subscriptions` table, so this milestone can't regress current tutor access.

---

## Sequencing recommendation

1. **Phase 1 (M1–M4)** first, in order — everything downstream that touches identity assumes real hashing and real sessions exist.
2. **Phase 2 and Phase 3 can run in parallel** with each other and with the tail end of Phase 1, since they don't share files with the auth work (M7 and M8 only need M6, not M2/M3).
3. **Phase 4** items are mostly independent of each other (M13, M15 have no dependencies at all) except M12, which needs auth (M2) and schema tooling (M6) first.
4. **Phase 5** is intentionally last — each milestone there is a foundation for further work rather than a finished feature, and M16/M18 both need real auth/premium status to mean anything.
