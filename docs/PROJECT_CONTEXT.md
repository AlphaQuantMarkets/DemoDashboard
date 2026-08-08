# AlphaQuant — Project Context

> Persistent context for a new Claude Code session with no memory of prior
> conversations. Reflects the repository as of **2026-08-09**, branch
> `minh-deploy`, commit `3dac7a5`, working tree clean.
>
> Labels used throughout: **[CODE]** verified by reading the repository directly,
> **[DOC]** verified from `docs/` or `README.md` (not independently re-checked
> against a live system), **[ASSUMPTION]** inferred, not directly verified,
> **[UNKNOWN]** could not be determined from the repository.
>
> This file will drift as work continues. Re-verify anything load-bearing
> against the current code rather than trusting this snapshot blindly.

## 1. What this is

AlphaQuant is a Vietnamese-market stock-analysis and investment-education web
app, built by a student team for a startup competition. **[DOC]** It is
intended as a real, monetizable product — not a technical demo. Stated business
priorities, in order: real-world feasibility, monetizability, technical
feasibility, security, UX, sustainable architecture. **[DOC]**

Core surfaces: a dashboard with real charts and risk metrics, a gamified Learn
module, an AI Investment Tutor (premium-gated, Gemini-backed), an AI Risk
Assessment feature (free, Gemini-backed), and a basic floating support chatbot
that is conceptually separate from the AI Tutor and still uses canned
responses rather than a real LLM call. **[CODE]**

## 2. Current architecture

- **Frontend**: vanilla HTML/CSS/JS. No build step, no bundler, no framework.
  **[CODE]** (`README.md`'s "Technology Stack" section claims React — this is
  false for the current codebase; treat that line as stale. **[DOC]**, contradicted
  by **[CODE]**)
  Three independent surfaces sharing no component code: `frontend/` (dashboard
  + landing/auth/pricing pages), `frontend/Learn/` (learning SPA), `ai-tutor/`
  (AI chat). Tailwind CSS and Plotly.js load via CDN. **[CODE]**
- **Backend**: Express 5, CommonJS, single process (`backend/server.js`). Also
  serves the frontend as static files. **[CODE]**
- **Databases**: two independent Postgres instances.
  - `DATABASE_URL` (developer-provisioned): `users`, `user_watchlists`,
    `user_learning_progress`. Schema managed by `node-pg-migrate`; source of
    truth is `backend/db-migrations/` (idempotent, safe to re-run). Older
    hand-written SQL in `backend/migrations/` is superseded but kept for
    reference. **[CODE]**
  - Supabase (shared, already live): `stock_prices` only, read server-side via
    `backend/services/stockService.js`. The Supabase anon key is no longer
    shipped to the browser. **[CODE]**
- **Auth**: bcrypt (10 rounds) + JWT (`jsonwebtoken`, 7-day expiry),
  `backend/middleware/authMiddleware.js` verifying `Authorization: Bearer`.
  Token stored client-side in `localStorage["authToken"]`. **[CODE]**
- **AI**: Google Gemini `gemini-2.5-flash` via `@google/genai`
  (`backend/services/geminiServices.js`). Two call sites:
  - `POST /api/ai/tutor` — requires auth + `users.is_premium = true`, checked
    server-side per request (`backend/services/tutorAccess.js`).
  - `POST /api/ai/risk-explanation` — no auth, no premium gate (intentional:
    free dashboard tab); inherits the global API rate limiter only.
  Both responses pass through `backend/services/responseValidator.js`
  (`sanitizeExplanation`), a regex/heuristic backstop against directive
  buy/sell/hold language — documented in its own comments as defense-in-depth,
  not a guarantee. No retrieval-augmented generation (RAG) exists anywhere;
  every answer is the model's general knowledge plus a hand-written prompt.
  **[CODE]**
- **Stock data pipeline**: `backend/update_stock.py` (vnstock, VN30 universe,
  ~30 symbols), scheduled daily via `.github/workflows/update-stock.yml` — the
  only sync path. `backend/sync_stock_list.py` refreshes the frontend ticker
  list separately, run by hand when the symbol universe changes. **[CODE]**
- **No Docker, no infrastructure-as-code, no CI beyond the stock-sync
  workflow, no automated test suite.** **[CODE]** (absence confirmed by search)

## 3. Completed milestones

Verified in code, against the 18-milestone roadmap in `docs/roadmap.md`
(`docs/roadmap.md` itself is planning-only and was not trusted at face value —
each item below was independently confirmed by reading the implementation):

**M1–M13, plus a bonus feature milestone, are done. [CODE]**

| # | Milestone | Evidence |
|---|---|---|
| M1 | Password hashing (bcrypt) | `backend/routes/auth.js` |
| M2 | JWT sessions | `backend/middleware/authMiddleware.js` |
| M3 | Server-enforced premium gating | `backend/services/tutorAccess.js` |
| M4 | CORS allowlist + rate limiting + env docs | `backend/server.js`, `backend/.env.example` |
| M5 | Retired redundant Node sync worker | `update-data.js` no longer exists |
| M6 | Version-controlled DB migrations | `backend/db-migrations/` |
| M7 | Real Beta (covariance-based, not random) | `computeBeta()` in `frontend/app.js` |
| M8 | Backend-mediated stock API | `backend/routes/stocks.js`; `frontend/supabase.js` and anon key fully removed |
| M9 | Dead code removed | confirmed by grep for previously-flagged strings |
| M10 | Centralized frontend config | `frontend/config.js` |
| M11 | Deduplicated Learn module assets | no duplicate About page/assets under `frontend/Learn/` |
| M12 | Server-side watchlist / learning progress | `backend/routes/userState.js`, wired into `app.js` / `Learn/app.js` |
| M13 | AI response guardrail | `backend/services/responseValidator.js`, wired into `/tutor` |
| M19* | AI Risk Assessment (new feature, not in original M1–M18 set) | `backend/prompts/riskExplanationPrompt.js`, `POST /api/ai/risk-explanation`, `frontend/riskApi.js` |

## 4. Incomplete milestones

**M14–M18 are not started. No partial or orphaned work was found for any of
them.** **[CODE]**

| # | Milestone | Status |
|---|---|---|
| M14 | Backend test suite + CI | Not started — `npm test` is still the default placeholder; no test files; no CI workflow for the backend |
| M15 | Structured logging | Not started — no logging dependency; `console.log`/`console.error` throughout |
| M16 | Admin API MVP | Not started — no admin route, no `role` column |
| M17 | i18n pilot | Not started — no `frontend/i18n/` |
| M18 | Stripe/billing foundation | Not started — no billing route, service, or migration |

Do not assume the full 18-milestone roadmap is complete. Do not assume M14–M18
have any in-progress work to resume.

## 5. Known issues

- **`docs/setup.md` and `README.md` describe an email-verification flow that no
  longer exists.** It was built (commit `84de8ca`) and later deliberately
  removed (commit `1b68208`, "Remove email verification and auto-login after
  signup", 2026-08-07). Current signup sets `is_email_verified = true`
  unconditionally; login never checks it; there is no
  `/api/auth/verify-email` or `/api/auth/resend-verification` route. Following
  those docs' testing checklist verbatim will hit dead endpoints. **[CODE]**,
  contradicting **[DOC]**
- **`docs/architecture.md` is a frozen historical snapshot**, explicitly dated
  and pinned to commit `6253aab` — it describes the pre-M1 state (plaintext
  passwords, no JWT, no stock API, three duplicated frontend surfaces), all of
  which has since been fixed. Useful for historical "why," not current truth.
  **[DOC]**
- **`docs/gap-analysis.md` (BMC-vs-code) predates M12/M13/M19** — its
  "Missing"/"Partial" verdicts on server-side persistence, response
  validation, and AI risk explanation are stale in places. Re-verify against
  code before quoting its numbers in business/pitch materials. **[DOC]**,
  partially superseded by **[CODE]**
- README's Technology Stack section still says "React" — false, always has
  been for this codebase. **[DOC]** contradicted by **[CODE]**
- No automated tests exist, so no regression safety net protects auth,
  premium-gating, or the AI guardrail logic. **[CODE]**
- No runtime/manual testing was performed during this audit — bugs beyond the
  documentation mismatches above are **[UNKNOWN]**, not ruled out.

## 6. Production deployment status

- **Frontend**: deployed to GitHub Pages via branch publishing. **[CODE]**
  (`_config.yml`, `.nojekyll`, redirect `index.html`) — configuration lives in
  the GitHub repo settings, not in-repo as a workflow file.
- **Backend**: deployed to Render at `alphaquant-api-yfae.onrender.com`,
  hardcoded in `frontend/config.js`'s production branch and in the backend's
  CORS allowlist. **[CODE]** No `render.yaml` or other IaC exists — deployment
  configuration lives entirely in the Render dashboard, outside version
  control. **[CODE]** (absence confirmed by search)
- **Databases**: both already remote (developer-provisioned Postgres for
  `DATABASE_URL`, shared Supabase project for `stock_prices`). **[CODE]**
- **Secrets**: `.env` is gitignored; only `.env.example` (blank) is tracked.
  AI/DB credentials are read server-side only — not shipped to the browser.
  **[CODE]**
- **Custom domain**: not found anywhere in the repository. **[UNKNOWN]** — may
  or may not exist in the Render/GitHub Pages dashboards.
- **HTTPS**: provided by GitHub Pages and Render's default subdomains.
  **[ASSUMPTION]** based on standard platform behavior, not independently
  verified against the live URLs in this audit.
- **No Docker, no CI/CD pipeline for deployment** — every push to the active
  branch ships without an automated test or build gate. **[CODE]**

Net: the *production goal* of "not dependent on a personal computer" is
functionally met (both services are hosted remotely), but reproducibility is
not — nothing in the repo can stand up an equivalent environment from scratch
without manually reading dashboard configuration.

## 7. Important business context

- The team is in **Round 3** of a startup/AI product competition, currently
  preparing a detailed business plan (VI/EN), an English summary deck, and an
  MVP description of improvements since the previous round. **[DOC]**
- The AI Tutor is intended to become a **premium feature**; AI Risk Assessment
  is intended to become a key **product differentiator**. Both must stay
  strictly educational — no market prediction, no buy/sell recommendations.
  **[DOC]**
- **No monetization code exists.** Premium status (`users.is_premium`) is
  enforced server-side but nothing in the product can currently grant it
  except manual SQL — no Stripe/VNPay/MoMo/ZaloPay integration.
  `frontend/pricing.html` is a static page, not wired to any payment flow.
  **[CODE]**
- No RAG grounding for the AI Tutor, no expert-curated or adaptive curriculum
  (the Learn module is a fixed 7-lesson array), no leaderboard, no admin/CMS
  for content review. These map to unstarted roadmap items (M16–M18) plus
  larger work not yet scoped in the roadmap at all. **[DOC]**, spot-checked
  against **[CODE]**

## 8. Current priorities (as of this audit)

1. Minimal infrastructure-as-code for the production deploy (e.g. a
   Dockerfile or Render blueprint) before treating "production deployment" as
   done — the current setup is not reproducible from the repo alone.
2. M14 (automated tests) before further backend changes, given zero coverage
   on auth and premium-gating logic.
3. Decide and scope real monetization — `docs/gap-analysis.md` suggests a
   Vietnamese payment provider (VNPay/MoMo/ZaloPay) is more market-appropriate
   than Stripe for this audience; this is a product decision to make explicit,
   not only a technical one.
4. Refresh `docs/architecture.md` and `docs/gap-analysis.md` — both are stale
   enough now to mislead if used directly in Round 3 "improvements since last
   round" materials.
5. Fix the stale email-verification section in `docs/setup.md` and the
   "React" claim in `README.md`.

*(This list reflects the state at the time of the audit, not a standing
commitment — re-derive priorities from the user/task at hand rather than
treating this as permanent.)*

## 9. Important technical constraints

- Frontend has no build step and no package manager — do not introduce one
  without discussing it first; it changes how every page is served and
  deployed. **[CODE]**
- The frontend resolves its backend URL via `frontend/config.js`'s
  `API_BASE_URL`, which switches on `window.location.hostname`
  (`localhost`/`127.0.0.1` vs. production). Always load the frontend through
  the backend it should talk to — opening HTML files via `file://` or a
  separate static server (e.g. Live Server) breaks auth, stock data, and the
  AI features, because `auth.js`/`app.js` will resolve the wrong backend.
  **[CODE]**
- Two separate Postgres databases exist for two separate purposes — do not
  assume `DATABASE_URL` holds stock prices or that Supabase holds users. See
  §2. **[CODE]**
- All backend routes that need `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`,
  or Supabase credentials fail closed with `503` when the variable is unset,
  rather than crashing — this is intentional. **[CODE]**
- `bcrypt` requires native compilation; if `npm install` fails on it, build
  tools (Python + C++ compiler) are needed. **[DOC]**
- Python 3.11/3.12 required for `update_stock.py`/`sync_stock_list.py` (not
  needed to run the web app itself) — `numpy`/`vnstock` fail to build on
  Python 3.14 without a C compiler. **[DOC]**

## 10. Commands to run the project

```bash
# Clone and install
git clone https://github.com/AlphaQuantMarkets/DemoDashboard.git
cd DemoDashboard/backend
npm install

# Configure environment
cp .env.example .env
# then edit .env: set DATABASE_URL, JWT_SECRET, GEMINI_API_KEY at minimum
# (see backend/.env.example for the full list and what each var gates)

# Create the users/watchlist/progress schema
npm run migrate

# Run the backend (also serves the frontend as static files)
npm run dev      # nodemon, auto-restart on change
# or
npm start        # plain node, no auto-restart
```

Then open **http://localhost:3000/frontend/index.html** — do not open the
HTML files directly or serve them from a different port (see §9).

```bash
# Health checks
curl http://localhost:3000/api/health      # env-vars-present check
curl http://localhost:3000/api/db-health   # real Postgres query

# Grant a local test account premium access (no payment flow exists yet)
# run against DATABASE_URL via psql:
UPDATE users SET is_premium = true WHERE username = 'your-test-username';
```

```bash
# Optional: only needed to run the stock-sync scripts yourself
pip install -r requirements.txt   # Python 3.11/3.12 only
cd backend
python update_stock.py            # syncs price history into Supabase
python sync_stock_list.py         # refreshes frontend/stocks.json's ticker list
```

No automated test command exists yet — `npm test` in `backend/` is a
placeholder that exits with an error by design, not a broken setup. **[CODE]**

## 11. Git branch and development workflow

- Current branch: `minh-deploy`, tracking `origin/minh-deploy`, working tree
  clean at the time of this audit. `origin/HEAD` points to `minh-deploy`,
  making it the de facto default/active branch. **[CODE]**
- Other remote branches exist (`origin/main`, `origin/master`,
  `origin/kk`, `origin/khang's-version-nodejs`) but are behind
  `minh-deploy`'s most recent commits as of this audit. **[CODE]**
- **No `CONTRIBUTING.md` or documented branching strategy exists in the
  repository.** Whether `minh-deploy` is meant to be merged back into `main`,
  or is itself the long-term main line, could not be determined from the
  repo. **[UNKNOWN]**
- Recent history is a mix of feature commits (e.g. `f24136e` M12, `c4da086`
  M13, `9073c57` M19) and unreviewed-looking direct commits with terse
  messages ("ui", "css", "navbar", "fix dir") directly on `minh-deploy` —
  there is no visible PR/review process enforced in-repo (no CI required
  checks, no branch protection visible from the repo contents).
  **[ASSUMPTION]** based on commit pattern; actual GitHub branch-protection
  settings were not inspected (outside repo contents).

---

*Generated via a read-only repository audit. Update this file as the project
changes — it is meant to be re-read, not re-derived, by future sessions.*
