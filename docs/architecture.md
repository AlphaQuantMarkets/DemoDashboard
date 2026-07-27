# AlphaQuant — Architecture Analysis

> Read-only analysis of the repository as of 2026-07-25 (branch `kk`, commit `6253aab`). No source files were modified to produce this document.

## 0. Executive Summary

AlphaQuant is marketed (README.md) as an "AI-powered Stock Risk Analysis & Investment Learning Platform" built on **React**, deployed to **GitHub Pages**. The actual implementation is materially different from that description:

- The frontend is **vanilla HTML/CSS/JavaScript** (no framework, no build step, no bundler) — not React.
- Only **one of several UI surfaces** (the AI Tutor chat) is wired to a real LLM (Google Gemini). The main dashboard's chatbot and "AI Analysis" tab are rule-based/canned-response simulations.
- There are **two independent, undocumented data stores**: Supabase (Postgres, holds `stock_prices`) and a separate Postgres instance reached via `DATABASE_URL` (holds `users`), with no visible schema/migration files for either.
- Authentication is a **custom-built, insecure** username/password system (plaintext passwords, no sessions/JWT, no server-side authorization) — `bcrypt` is a listed dependency but unused.
- There are **three parallel front-end codebases** (`frontend/`, `frontend/Learn/`, `ai-tutor/`) with duplicated assets, duplicated `aboutalphaquant` pages, and no shared component/module system.

This document describes the system **as it exists**, not as the README describes it. Discrepancies are called out explicitly in §11–12.

---

## 1. Overall Project Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Static hosting (GitHub Pages, per README/_config.yml)              │
│                                                                       │
│  index.html ──redirect──▶ frontend/index.html (main dashboard)      │
│                              ├─ frontend/Learn/index.html (gamified  │
│                              │    learning module, self-contained)  │
│                              ├─ frontend/aboutalphaquant/*.html      │
│                              └─ ai-tutor/index.html (AI chat)        │
└─────────────────────────────────────────────────────────────────────┘
        │ direct REST calls (client-side SDK)     │ fetch() to fixed
        ▼                                          │ Render.com host
┌────────────────────────┐            ┌────────────▼──────────────────┐
│ Supabase (Postgres)     │            │ backend/ — Express API         │
│ project zexculbaijqtwopzyvgj │       │ (hosted separately, e.g.       │
│ table: stock_prices     │            │  alphaquant-api-cg7b.onrender  │
│ read: anon/publishable key,          │  .com)                         │
│  client-side, unauthenticated │      │  - /api/auth/signup, /login    │
│ write: service-role key,      │      │  - /api/ai/tutor                │
│  server-side only             │      │  - serves ai-tutor/ + frontend/ │
└───────────▲─────────────┘            │    as static files too         │
            │ upsert                    └───────┬─────────────┬─────────┘
┌───────────┴───────────────┐                    │             │
│ backend/update_stock.py    │           ┌────────▼──────┐  ┌───▼─────────┐
│ (run daily by GitHub       │           │ Postgres        │  │ Google       │
│  Actions cron)             │           │ (DATABASE_URL)  │  │ Gemini API   │
│ backend/update-data.js     │           │ table: users    │  │ (gemini-2.5- │
│ (alt. Node/cron variant,   │           │ plaintext pwds  │  │  flash)      │
│  not used by CI)           │           └─────────────────┘  └─────────────┘
│ data source: vnstock       │
│ (api.vnstock.bio / PyPI    │
│  vnstock package)          │
└─────────────────────────────┘
```

**Key architectural characteristics:**

- **No backend-for-frontend / API gateway pattern** — the browser talks directly to Supabase for price data (bypassing the Express backend entirely) and only goes through the Express backend for auth and the AI tutor.
- **No build pipeline** — no `package.json` at repo root, no bundler (Webpack/Vite/etc.), no TypeScript, no npm workspace linking frontend and backend. `backend/package.json` only covers the Node server and data-sync scripts.
- **Two deployment targets**: static frontend (GitHub Pages, implied by `_config.yml` Jekyll excludes + README) and a separately hosted Express API (Render.com, hardcoded URL in `frontend/auth.js`).
- **Two separate scheduled data-sync mechanisms** for the same job (see §10), one driven by GitHub Actions (Python) and one a standalone long-running Node cron process — only the Python one is actually wired into CI.

---

## 2. Frontend Structure

All frontend code is static, framework-free HTML/CSS/JS served as-is (no transpilation). There are **three independently-bootstrapped front-end applications** sharing a repo but not sharing code:

### 2.1 Main dashboard — `frontend/`
- `index.html` (768 lines) — single-page shell with a sticky navbar, auth modal, sidebar (stock picker, period slider, watchlist), and 6 tab panels: Single-Stock Analysis, Compare, AI Analysis (demo), Glossary, Community (static mockup, no backend), Market Replay. Loads Tailwind CSS (CDN), Plotly.js 2.32.0 (CDN), Supabase JS SDK v2 (CDN), then local `supabase.js` → `auth.js` → (deferred) `app.js`.
- `app.js` (1584 lines) — owns essentially all interactivity: tab switching, chart rendering (candlestick/volume/line via Plotly), stock comparison, watchlist, onboarding hover-guide overlays, market-replay playback, and an in-page chatbot widget. Holds a single mutable `STATE` object; no component framework, direct DOM manipulation via `getElementById`.
- `auth.js` — login/signup modal logic; calls the remote Express API directly (hardcoded URL) and stores the returned user object in `localStorage["user"]` (no token).
- `supabase.js` — initializes `window.supabaseClient` with a hardcoded project URL and publishable (anon) key.
- `stocks.json` — static ticker metadata (`{name, seed}` per symbol) and a financial glossary array.
- `guide.json` — hover-tooltip content driving the onboarding "Product Feature Hover Guide."
- `aboutalphaquant/` — standalone About page (own HTML/CSS/JS + team-photo assets).

### 2.2 Learning module — `frontend/Learn/`
- A **second, self-contained SPA** (`index.html` + `app.js`, 550 lines) implementing a 5-route gamified learning flow (home / learn / practice / sandbox / achievements): hardcoded lesson content with quizzes (XP/leveling), a "pick the highest-volume stock" practice exercise, a fake-cash portfolio sandbox, and an achievements/badges screen. Persists all state to a single `localStorage` key (`alphaquant_learning_state_v1`), entirely separate from the main dashboard's storage.
- Does **not** import `auth.js` or `supabase.js` from the parent frontend; instead it reimplements a stub, non-functional login/signup modal inline (explicitly labeled in the markup as a page with no backend wiring).
- Ships its own copies of `guide.json` / `stocks.json` and a full duplicate of `aboutalphaquant/` (HTML/CSS/JS + 5 image assets) — both are dead weight (never fetched by `Learn/app.js`).

### 2.3 AI Tutor — `ai-tutor/`
- `index.html` + `premiumAccess.js` + `tutorApi.js` + `tutorPage.js` (no bundler, no shared app.js). Links the parent frontend's `style.css` for shared visual styling but otherwise standalone.
- `tutorPage.js` renders a chat UI, seeds context from a `localStorage` key written by the main dashboard (`alphaquant_tutor_stock_context_v1`), and calls the backend via `tutorApi.js`.
- `premiumAccess.js` implements a **client-side-only** "premium" gate (checks flags in `localStorage["user"]`, plus a localhost-only dev bypass toggle) — see §6 for why this provides no real security.

### Frontend libraries/CDNs in use
Tailwind CSS (CDN, JIT config inline), Plotly.js 2.32.0 (CDN), `@supabase/supabase-js@2` (CDN), Google Fonts (Space Mono, DM Sans). No package manager governs any of this — versions are pinned only by the CDN URL string.

---

## 3. Backend Structure

`backend/` is a small Express 5 application (CommonJS, no TypeScript):

```
backend/
├── server.js              — app bootstrap, route mounting, static file serving
├── db.js                  — pg Pool wrapper around DATABASE_URL
├── routes/
│   ├── auth.js             — POST /signup, POST /login (users table)
│   └── ai.js                — POST /tutor (Gemini-backed)
├── services/
│   ├── geminiServices.js    — thin wrapper over @google/genai
│   └── tutorAccess.js       — premium-gate middleware (effectively disabled by default)
├── prompts/
│   └── tutorPrompt.js       — prompt template for the AI tutor
├── update-data.js           — Node/cron alternative stock-sync worker (not used by CI)
├── update_stock.py          — Python stock-sync script (used by GitHub Actions)
└── .env                     — local secrets (only GEMINI_API_KEY currently set)
```

**Runtime dependencies** (`backend/package.json`): `express`, `cors`, `dotenv`, `pg`, `@supabase/supabase-js`, `@google/genai`, `axios`, `node-cron`, `bcrypt` (installed but never imported anywhere in the codebase).

**What `server.js` actually does:**
- Mounts `/api/ai` → `routes/ai.js`, `/api/auth` → `routes/auth.js`.
- `GET /` and `GET /api/health` — basic liveness/config-presence checks (reports whether `DATABASE_URL`/`GEMINI_API_KEY` are set, not whether they actually work).
- `GET /api/db-health` — runs `SELECT NOW()` against the auth Postgres DB.
- Also serves `ai-tutor/` and `frontend/` as static file trees (`GET /ai-tutor` and `/ai-tutor/*`, `/frontend/*`) — meaning this single Express process is simultaneously an API server and (optionally) a static host, distinct from whatever serves the GitHub Pages copy.
- A generic JSON-parse-error handler; **no other error-handling middleware, no request logging, no rate limiting, no helmet/security headers.**

There is no ORM, no query builder, and no migrations tooling — all SQL is raw template-literal `pool.query()` calls (parameterized correctly with `$1`/`$2`, so no SQL injection in the current code, but no abstraction layer either).

---

## 4. Routing

**Frontend routing** is purely file-based static navigation (no client-side router/history API):
- `/index.html` → meta-refresh redirect to `/frontend/index.html`
- `/frontend/index.html` — main dashboard (tabs are DOM show/hide, not URL-addressable)
- `/frontend/Learn/index.html` — learning module (route state kept in-memory/localStorage, not in the URL)
- `/frontend/aboutalphaquant/aboutalphaphaquant.html` — About page
- `/ai-tutor/index.html` — AI tutor chat page (also servable via Express at `GET /ai-tutor`)

No tab/section within `frontend/app.js` or `Learn/app.js` is deep-linkable — reloading or sharing a URL always lands on the default view.

**Backend routing** (Express, mounted in `server.js`):

| Method | Path | Handler |
|---|---|---|
| GET | `/` | inline in `server.js` |
| GET | `/api/health` | inline in `server.js` |
| GET | `/api/db-health` | inline in `server.js` |
| GET | `/ai-tutor`, `/ai-tutor/*` | static file serving |
| GET | `/frontend/*` | static file serving |
| POST | `/api/auth/signup` | `routes/auth.js` |
| POST | `/api/auth/login` | `routes/auth.js` |
| POST | `/api/ai/tutor` | `routes/ai.js` |

---

## 5. API Endpoints

### `POST /api/auth/signup`
- Body: `{ username, password }`
- Inserts directly into `users(username, password)`, returns the full inserted row (including the plaintext password) as JSON.
- 400 on duplicate username (Postgres unique-violation code `23505`), 500 on other errors (leaks `err.message` is avoided here but not consistently elsewhere).

### `POST /api/auth/login`
- Body: `{ username, password }`
- Looks up by username, compares `user.password !== password` as a **plaintext string comparison**, returns `{ success, user: { id, username } }` on match.
- No session/cookie/JWT is issued — the client just remembers the returned object.

### `POST /api/ai/tutor`
- Gated by `requirePremiumTutorAccess` middleware (no-op unless `AI_TUTOR_PREMIUM_MODE=required`, which is not set anywhere in the current `.env`).
- Body: `{ question, userLevel, stockContext }` — validates `question` is a non-empty string ≤1200 chars, whitelists `userLevel` to `beginner|intermediate|advanced`, defensively narrows `stockContext` to a plain object or `null`.
- Builds a prompt (`prompts/tutorPrompt.js`) instructing Gemini to answer in Vietnamese, stay educational, never give buy/sell recommendations, and respects length/tone constraints.
- Calls Gemini (`gemini-2.5-flash`) via `services/geminiServices.js`, returns `{ answer }`.
- Maps upstream 401/403/429 to the same status code, everything else to 500 with a generic message.

### Health/diagnostics
`GET /api/health` and `GET /api/db-health` — see §3.

**Not implemented as backend endpoints** (handled client-side against Supabase instead): fetching stock prices, watchlist persistence, comparison data. There is no `/api/stocks*` surface at all — `frontend/app.js` and `backend/update_stock.py`/`update-data.js` both talk to Supabase directly, bypassing the Express API entirely for market data.

---

## 6. Authentication Flow

There are **two unrelated "auth" mechanisms** in this codebase that do not interoperate:

### 6.1 Username/password (dashboard login/signup)
1. User submits the auth modal in `frontend/index.html` → `auth.js` `signUp()`/`login()`.
2. Request goes to a **hardcoded remote origin** (`https://alphaquant-api-cg7b.onrender.com`), independent of whatever origin served the page.
3. Backend (`routes/auth.js`) does a raw SQL insert/select against the `users` table with **passwords stored and compared in plaintext** — `bcrypt` is a declared dependency but is never imported or used anywhere in the repo.
4. No token (JWT/session cookie) is ever issued. On success, the client stores `{id, username}` (signup) or the full `user` object (login) into `localStorage["user"]`.
5. All "logged in" UI state (`updateNavbar()`, `currentUser` in `app.js`) is derived purely from the presence/shape of `localStorage["user"]` — **trivially forgeable from devtools**, and no backend route actually checks this token/identity for authorization (there is no `Authorization` header sent anywhere, no middleware validating a logged-in user on any route).

### 6.2 "Premium" gate for the AI Tutor
1. `ai-tutor/premiumAccess.js` checks `localStorage["user"]` for `isPremium===true` / `subscription==='premium'` / `plan==='premium'`, or (only on `localhost`) a dev-only bypass flag settable via an in-page "Upgrade" button.
2. Server-side, `backend/services/tutorAccess.js`'s `requirePremiumTutorAccess` middleware is a **no-op** unless the env var `AI_TUTOR_PREMIUM_MODE` is literally set to `"required"` — which it is not, in the current `.env`. So today, the client-side gate is cosmetic only; anyone can call `POST /api/ai/tutor` directly (e.g. via curl) with no gating whatsoever, and anyone can flip `localStorage.user.isPremium = true` in devtools to unlock the UI regardless of any real subscription status.

### 6.3 Supabase access
The browser holds a **publishable/anon** Supabase key (safe by Supabase's design to expose client-side) and issues unauthenticated `select` queries against `stock_prices`. There is no Supabase Row-Level-Security policy visible in-repo (none of this is version-controlled — RLS config lives in the Supabase project, outside this repository), so its effectiveness can't be verified from the codebase alone. Writes to Supabase only ever happen server-side (GitHub Actions / the Node cron worker) using a separate **service-role key**, never exposed to the browser.

There is **no unified identity** across the two systems — a "logged in" dashboard user and Supabase access are completely disconnected; nothing scopes stock data or premium access to a specific authenticated identity server-side.

---

## 7. Database Structure

Two separate database backends exist, **neither has a migration file, schema file, or ORM model checked into the repo** — schemas are inferred entirely from query code.

### 7.1 Supabase Postgres (project `zexculbaijqtwopzyvgj`) — market data
Table `stock_prices`, inferred from `backend/update_stock.py` / `backend/update-data.js` upsert code and `frontend/app.js` select queries:

| Column | Type (inferred) | Notes |
|---|---|---|
| `symbol` | text | ticker, e.g. `FPT` |
| `trading_date` | date | |
| `open` | numeric | |
| `high` | numeric | |
| `low` | numeric | |
| `close` | numeric | |
| `volume` | numeric/bigint | |

Unique constraint implied by `onConflict: "symbol,trading_date"` used in both sync scripts. Read client-side with the anon key; written server-side with the service-role key via batched upserts (batch size 500 in the Python script).

### 7.2 Auth Postgres (`DATABASE_URL`, provider unspecified in repo — likely also Supabase or a managed Postgres, but not confirmed) — user accounts
Table `users`, inferred from `backend/routes/auth.js`:

| Column | Type (inferred) | Notes |
|---|---|---|
| `id` | serial/int (implied by `RETURNING *`, `user.id` usage) | PK |
| `username` | text, unique (unique-violation `23505` handled explicitly) | |
| `password` | text | **stored in plaintext**, no hash column, no salt |

No other tables (no premium/subscription table, no session table, no watchlist table — watchlists live only in browser `STATE`, never persisted server-side).

---

## 8. Reusable Components

There is effectively **no shared component system** — this is a significant structural gap for a multi-surface product:

- No shared JS module for the navbar/auth-modal/footer across `frontend/`, `frontend/Learn/`, and `ai-tutor/` — each either duplicates markup or reimplements a stub version (see §2.2).
- No shared config module for constants like the backend base URL — it's hardcoded twice, verbatim, in `auth.js` (signup and login), and the AI tutor uses a *different* resolution strategy (`window.ALPHAQUANT_API_BASE_URL || ''`, relative fallback) that is never actually configured — an inconsistency that only "works" because of how the tutor page happens to be served.
- No shared CSS design-system beyond duplicated Tailwind CDN `<script>` config blocks and a shared `style.css` link from `ai-tutor` back into `frontend`.
- No componentized chart/metric-card rendering — `renderCandlestick`, `renderVolume`, `renderPriceLine` in `app.js` are free functions operating on fixed DOM ids, not reusable across the two chart-bearing surfaces (dashboard vs. Learn's practice mode, which doesn't chart at all).
- Assets (`banner.png`, `chatbot.png`, `home-button.jpg`, team photos) are physically duplicated under `frontend/Learn/assets/` and `frontend/Learn/aboutalphaquant/assets/` rather than referenced from a single shared assets directory.

The closest things to "reusable" building blocks are the two JSON content files (`stocks.json`, `guide.json`), and even those are duplicated (with drift risk) rather than shared between `frontend/` and `frontend/Learn/`.

---

## 9. Current AI Integration

- **Real LLM integration exists in exactly one place**: `POST /api/ai/tutor` → `services/geminiServices.js` → Google Gemini (`gemini-2.5-flash`), used by the standalone `ai-tutor/` chat page. The prompt template (`prompts/tutorPrompt.js`) enforces Vietnamese responses, length limits by question complexity, and explicit guardrails against giving buy/sell/hold recommendations or price predictions — consistent with the product's stated "educational only" positioning in the README.
- **Everywhere else, "AI" in the UI is simulated**:
  - The dashboard's floating chatbot widget (`initChatbot()` in `app.js`) has a real `fetch()` call to `https://api.anthropic.com/v1/messages` fully present in the code but **commented out**; the live code path (`askAI()`) just plays back two hardcoded canned responses with a typewriter animation.
  - The "AI Analysis" tab (Tab 5, explicitly labeled "Demo mode" in the HTML) computes a `riskScore` from a hand-written formula and fills in canned Vietnamese sentence templates — there is no model call involved at all.
- The README's "AI Workflow" diagram (Frontend → Backend API → Market Data → Context Builder → Prompt Builder → LLM → Response Validation → Frontend UI) matches the *intended* design of the `/api/ai/tutor` path reasonably well, except there is no explicit "Response Validation" step in code — the Gemini response is returned to the client as-is, relying entirely on prompt instructions (not a code-level filter/guardrail) to avoid recommendation-like language.
- No conversation memory/history is persisted anywhere (server or client) beyond the single `stockContext` object relayed from the dashboard via `localStorage`.

---

## 10. Current Stock Data Flow

**Ingestion (write path) — two independent, redundant implementations:**

1. **`backend/update_stock.py`** (the one actually used in production via CI): pulls full daily OHLCV history (from 2023-01-01 to today) for 8 hardcoded tickers (`VNM, VIC, HPG, FPT, MWG, VHM, TCB, MBB`) using the `vnstock` PyPI package, deduplicates locally, and batch-upserts (500 rows/batch) into Supabase `stock_prices` on conflict `(symbol, trading_date)`. Triggered daily by `.github/workflows/update-stock.yml` (cron `30 11 * * *` UTC ≈ 18:30 ICT) plus manual `workflow_dispatch`, using `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` GitHub Actions secrets.
2. **`backend/update-data.js`** (Node/`node-cron` equivalent, **not invoked by CI or any documented process**): same 8 tickers, but pulls only the *latest* record per symbol (`limit=1`) from a different source (`api.vnstock.bio` REST API) every 6 hours, upserting the same table/conflict key. This appears to be a legacy or alternative worker intended to run as a standalone long-lived process (`npm run dev`), not currently orchestrated anywhere in the repo (no Dockerfile, no process manager config, no second GitHub Actions workflow for it).

**Consumption (read path):**
- `frontend/app.js` (`loadStockData()`) queries Supabase `stock_prices` **directly from the browser** using the anon/publishable key — paginated 1000-row fetches, filtered to only **3 of the 8** synced tickers (`FPT, HPG, VNM`), capped to the most recent 500 rows per ticker.
- Derived risk metrics (`computeMetrics()`) are computed **client-side** from this real price data for volatility, Sharpe ratio, and max drawdown — but **Beta is not computed from real market covariance**; it's a seeded-random value in a fixed range, i.e. presented as real analysis but is fake.
- A legacy synthetic-data generator (`generateStockData()` + seeded PRNG) still exists in `app.js` but is dead code in the current `init()` flow, with explicit cleanup code that deletes an old `fakeStockCache` localStorage key from earlier versions of the app.
- The backend Express API has **no endpoint at all** for serving stock data — it plays no role in the read path.

---

## 11. Technical Debt

Ordered roughly by severity/impact:

1. **Plaintext password storage and comparison** (`routes/auth.js`) with `bcrypt` present in `package.json` but never used anywhere — a straightforward, high-severity fix that's already one `npm install` away from being addressed.
2. **No real authentication/session mechanism** — no JWT/cookie/session store; "logged in" state is a client-trusted `localStorage` object with no server-side verification on any subsequent request. Any route that should be "logged-in only" isn't actually protected.
3. **AI Tutor premium gating is non-functional by default** — client-side-only check, trivially bypassed via devtools; server-side middleware is permissive unless a specific env var most deployments won't have set is present.
4. **No input sanitization/escaping on user-controlled text rendered into the DOM** in several places (e.g. usernames rendered into `userInfo.textContent` is safe since it's `textContent`, but this should be audited across `app.js`/`Learn/app.js` wherever `innerHTML` is used with any user- or JSON-sourced string).
5. **Hardcoded, environment-agnostic backend URL** (`https://alphaquant-api-cg7b.onrender.com`) duplicated in two places in `auth.js` — no config abstraction, no way to point a local dev frontend at a local backend without editing source.
6. **Two redundant, drifted stock-sync implementations** (`update_stock.py` vs `update-data.js`) — different data sources (vnstock PyPI vs `api.vnstock.bio` REST), different pull strategies (full history vs latest-only), no shared code, and only one is actually scheduled. The unused one is a maintenance trap for whoever edits it assuming it runs.
7. **No database schema/migrations in version control** for either Postgres instance — `users` and `stock_prices` table shapes exist only implicitly in query code, making onboarding, environment parity, and safe schema evolution error-prone.
8. **Dashboard displays fabricated "Beta"** as if it were computed from real data, alongside genuinely real volatility/Sharpe/drawdown numbers from live Supabase data — a correctness/trust issue for a platform whose entire value proposition (per README) is teaching people to read real risk data.
9. **Significant code/asset duplication** across `frontend/`, `frontend/Learn/`, and `ai-tutor/` (About pages, images, JSON content files, ad hoc login-modal reimplementations) with no shared module system — every change to shared UI (navbar, auth modal, branding) must be manually propagated to multiple files.
10. **Dead code left in place**: commented-out Anthropic API call in `app.js`, unused `generateStockData()`/seeded-PRNG fake-data path, unused `Learn/guide.json` and `Learn/stocks.json`, unused `fakeStockCache` cleanup shim.
11. **No automated tests** anywhere in the repo (`backend/package.json`'s `test` script is the default placeholder that exits 1), no CI step that runs the backend, no linting configuration visible.
12. **No error handling/observability in the backend beyond `console.log`/`console.error`** — no structured logging, no rate limiting, no request validation library (manual ad hoc checks in `routes/ai.js` only), no CORS restriction (`cors()` is wide open with default config, i.e. `Access-Control-Allow-Origin: *`).
13. **README materially misrepresents the tech stack** ("React" frontend) and product state (implies AI reasoning throughout, when most AI-labeled UI is static/simulated) — a documentation-accuracy issue that will mislead new contributors and stakeholders reading it at face value.
14. **No environment-variable documentation/`.env.example` at the backend level** — only `scripts/.env.example` exists (covering Supabase sync vars); `DATABASE_URL`, `PORT`, and `AI_TUTOR_PREMIUM_MODE` are referenced in code but undocumented anywhere.
15. **Secrets/log hygiene**: `backend/server.out.log` and `backend/server.err.log` are present in the working tree (contents not audited here in depth, but log files from a server process being present in a repo directory is a footgun if ever accidentally committed alongside real secrets or PII).

---

## 12. Missing Features Compared to a Production-Ready Investment Learning Platform

- **No real authentication stack**: password hashing, email verification, password reset, OAuth/social login, MFA, session/token expiry and revocation, CSRF protection.
- **No authorization layer**: no roles/permissions (free vs. premium), no server-side enforcement anywhere of who can access what — premium tutor access is the one place this exists conceptually and it's not actually enforced.
- **No real subscription/billing integration** (Stripe or similar) — "premium" is a boolean flag a user can set on themselves in devtools.
- **No persisted user data**: watchlists, portfolio sandbox state, learning progress, and comparison sets all live only in browser `localStorage`/in-memory state — nothing survives a cleared cache or a new device, and there's no user-scoped backend storage at all.
- **No unified API layer for market data** — the frontend depends on direct, unauthenticated Supabase access rather than a backend-mediated, cacheable, rate-limited API; this also means business logic (e.g. metric computation) is duplicated risk client-side with no server-side source of truth, and any future change (e.g. real Beta calculation) can't be pushed without a frontend redeploy.
- **No caching/CDN strategy for market data or charts**, no pagination/virtualization for large historical datasets beyond the existing manual page-size caps.
- **No real-time/streaming price updates** — data is only as fresh as the last scheduled sync (daily), with no WebSocket/SSE layer, unsuitable for anything beyond end-of-day educational review.
- **No monitoring/alerting/observability** (no APM, no error tracking like Sentry, no uptime checks beyond the manual `/api/health` endpoint, no structured logs/metrics).
- **No automated testing** (unit, integration, or end-to-end) and no CI pipeline beyond the stock-data cron job — no safety net for regressions across the three frontend surfaces or the backend.
- **No accessibility (a11y) audit/support** evident (no ARIA attributes noted in the explored markup, no keyboard-navigation-specific code).
- **No internationalization framework** — Vietnamese/English text is hardcoded inline throughout templates and prompts rather than externalized to locale files, despite the product likely wanting bilingual reach.
- **No content moderation/guardrail layer for AI responses** beyond prompt instructions — no server-side post-processing check that a Gemini response doesn't contain a recommendation, despite the README explicitly promising this ("Response Validation" step in its AI Workflow diagram is aspirational, not implemented).
- **No admin/back-office tooling** — no way to manage users, review flagged AI conversations, edit lesson content, or manage the ticker universe without editing source files/JSON directly and redeploying.
- **No rate limiting or abuse protection** on any endpoint, including the LLM-backed `/api/ai/tutor`, which is a direct cost/abuse exposure once truly public.
- **No data provenance/compliance disclosures** wired into the UI beyond the static README disclaimer — a production investment-education platform in most jurisdictions would need in-product disclaimers, not just repo documentation.
- **No unified design system/component library**, which will make consistent UX increasingly costly to maintain as the three separate frontend surfaces grow (see §8, §11.9).
