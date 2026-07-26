# AlphaQuant — Developer & Tester Setup Guide

Detailed technical setup instructions. For a quick start, see the [README](../README.md#getting-started); this document covers the same ground in full depth, plus troubleshooting.

## Architecture at a glance

- **Backend**: Node.js + Express (`backend/`) — the only API server in this project. There is no FastAPI/Django/Flask backend anywhere in this repo.
- **Frontend**: static HTML/CSS/vanilla JavaScript (`frontend/`, `ai-tutor/`) — no build step, no bundler, no frontend `package.json`. It's served as static files by the same Express backend.
- **Two separate databases**, for two unrelated purposes (see [Database](#d-database) below):
  - A generic Postgres database (`DATABASE_URL`) holding the `users` table — you set this up yourself.
  - A shared Supabase Postgres project (hardcoded in `frontend/supabase.js`) holding the `stock_prices` table — already live, no setup needed.
- **A standalone Python script** (`backend/update_stock.py`) syncs stock price data into Supabase on a schedule (via GitHub Actions). It is not part of the API server and is not required to run or test the application.

## A. Prerequisites

| Software | Version | Notes |
|---|---|---|
| Node.js | >= 18 | Required by `express` and `bcrypt`'s own `engines` field. Verified working with Node 24.18.0. |
| npm | >= 9 | Ships with Node. Verified working with npm 11.16.0. |
| PostgreSQL | any recent version | For the local `users` table. Verified working with PostgreSQL 18. |
| Python | 3.11 (only if running the stock-sync script) | Matches `.github/workflows/update-stock.yml`. **Not needed** to run or test the web app itself. |
| git | any recent version | To clone the repo. |
| A modern browser | — | Frontend has no special requirements beyond `fetch`/ES2017+ support. |

**Python version warning**: this was actually hit during setup — installing `requirements.txt` under Python 3.14 fails, because `numpy` (a transitive dependency of `vnstock`) has no prebuilt wheel for 3.14 yet and tries to compile from source, which fails without a C compiler installed (`Unknown compiler(s)` from Meson). Stick to Python 3.11 or 3.12, which are confirmed working. This only matters if you plan to run `backend/update_stock.py` yourself — most developers/testers won't need to.

## B. Installation

Clone the repository:
```bash
git clone https://github.com/AlphaQuantMarkets/DemoDashboard.git
cd DemoDashboard
```

Install backend dependencies:
```bash
cd backend
npm install
```

Install frontend dependencies: **there are none to install.** The frontend has no `package.json` — it's plain HTML/CSS/JS, and its three external libraries (Tailwind CSS, Plotly.js, the Supabase JS SDK) load directly from public CDNs via `<script>` tags in `frontend/index.html` and `ai-tutor/index.html`. You need internet access when the page loads, but there's no install step.

Install Python dependencies — **only if** you intend to run the stock-price sync script yourself (most people won't need to):
```bash
pip install -r requirements.txt
```

## C. Environment variables

Copy the template and fill in real values:
```bash
cp backend/.env.example backend/.env
```

| Variable | Required for | Purpose |
|---|---|---|
| `PORT` | — | Port the Express server listens on. Optional, defaults to `3000`. |
| `DATABASE_URL` | `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/ai/tutor` | Postgres connection string for the `users` table. Without it, these routes return `503`. |
| `DATABASE_SSL` | — | Optional override, `true` or `false`. Auto-detected otherwise: SSL is disabled for `localhost`/`127.0.0.1` connection strings and enabled for everything else (e.g. a hosted/remote Postgres). |
| `JWT_SECRET` | same routes as `DATABASE_URL` | Secret used to sign and verify JWT session tokens. Without it, those routes return `503`. Generate one locally: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `GEMINI_API_KEY` | `POST /api/ai/tutor` | Google Gemini API key used to generate AI Tutor responses. |
| `ALLOWED_ORIGINS` | — | Comma-separated list of frontend origins allowed to call this API (CORS allowlist). Optional, defaults to `http://localhost:3000` and `http://127.0.0.1:3000`. |
| `SUPABASE_URL` | `backend/update_stock.py` only | Only needed if running the Python stock-sync script yourself. Not needed for the Node API server. |
| `SUPABASE_SERVICE_KEY` | `backend/update_stock.py` only | Same as above. |

Notes:
- `backend/.env` is gitignored — never commit it. Only `backend/.env.example` (blank placeholders) is tracked.
- No real API keys or secrets are included anywhere in this repository.
- The frontend needs **no** environment variables and has no build step to inject them into — `frontend/supabase.js` hardcodes a Supabase **publishable/anon** key, which is safe to expose client-side by design (read-only access to `stock_prices`).

## D. Database

This project uses **two separate Postgres databases**, for two unrelated purposes. Understanding this distinction is the single most important thing for a smooth setup.

### 1. `stock_prices` — real stock market data (Supabase, already live)

Hardcoded to a shared, already-running Supabase project in `frontend/supabase.js` (a publishable/anon key, safe to expose in client-side code). **You don't need to set anything up for this** — opening the dashboard just works, as long as that project is up and you have internet access. This is a shared resource across the whole team, not something each developer creates individually.

### 2. `users` — accounts, sessions, premium status (your own Postgres, via `DATABASE_URL`)

You need your own instance of this — a fresh local Postgres install, a Docker container, or your own hosted Postgres (a second Supabase project also works, since Supabase is just Postgres). There is currently **no migration runner** in this project (that's tracked as future work), so the schema is created by hand, once, per environment:

```sql
CREATE TABLE IF NOT EXISTS users (
    id serial PRIMARY KEY,
    username text UNIQUE NOT NULL,
    password text NOT NULL,
    is_premium boolean NOT NULL DEFAULT false
);
```

If you already created a `users` table before `is_premium` existed, add the column instead of recreating the table:
```bash
psql -d <your-database> -f backend/migrations/0001-add-users-is-premium.sql
```

There's also `backend/migrations/0000-rehash-existing-passwords.js`, a one-time script that hashes any leftover plaintext passwords from before bcrypt was introduced. Irrelevant for a brand-new database — only run it if you're migrating an older one:
```bash
cd backend && npm run migrate:passwords
```

### Seed / test data

There is no seed data and no automatic test-account creation. Testers create accounts themselves via the Sign Up form (or `POST /api/auth/signup` directly). To exercise the AI Tutor, grant a test account premium access manually:
```sql
UPDATE users SET is_premium = true WHERE username = 'your-test-username';
```

### Do testers need to manually create anything?

Yes — the `users` table (above), and their own `backend/.env` with a valid `DATABASE_URL`. Everything else (stock data) is already live and shared.

## E. Running the backend

From the `backend/` directory:
```bash
npm run dev
```
This uses `nodemon` to auto-restart on file changes. For a plain run without auto-restart:
```bash
npm start
```

- **Host/port**: `http://localhost:3000` by default (override with `PORT` in `backend/.env`)
- **API base URL**: `http://localhost:3000/api`
- **Verify it's running**:
  ```bash
  curl http://localhost:3000/api/health
  ```
  Expected: `{"status":"ok","databaseConfigured":true,"geminiConfigured":true}` (these two booleans just reflect whether the env vars are *set*, not whether they're valid — see below to check the DB connection itself).
  ```bash
  curl http://localhost:3000/api/db-health
  ```
  Expected: `{"status":"ok","time":"<current timestamp>"}` — a real query result from Postgres, confirming the connection actually works end to end.

## F. Running the frontend

There is no separate frontend server or build process — the same Express backend serves the static frontend files directly. Once the backend is running:

- Dashboard: `http://localhost:3000/frontend/index.html`
- AI Tutor: `http://localhost:3000/ai-tutor/index.html`

**This matters more than it sounds like it should:** always load the frontend through this backend-served URL. Don't open the HTML file directly from disk (`file://...`) and don't serve it with a separate static server on a different port (e.g. VS Code's Live Server). `frontend/auth.js` decides which backend to send login/signup requests to based on the page's own `window.location.hostname`/`host`:
- Loaded from `http://localhost:3000/...` → correctly targets `http://localhost:3000` (this same backend).
- Loaded from `file://...`, or from a *different* local port (e.g. `http://localhost:5500` via Live Server) → does not correctly reach your local backend; auth/AI Tutor requests will fail or silently hit the wrong server.

The dashboard's stock-price charts will still render even if the frontend is loaded incorrectly, since those go straight to the shared Supabase project — it's specifically login, signup, and the AI Tutor that require being served from the same origin as the backend.

## G. Running the full application — step by step

1. Clone the repository:
   ```bash
   git clone https://github.com/AlphaQuantMarkets/DemoDashboard.git
   cd DemoDashboard
   ```
2. Install backend dependencies:
   ```bash
   cd backend && npm install
   ```
3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and fill in `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY` (see [section C](#c-environment-variables)).
4. Initialize the database — create the `users` table (see [section D](#d-database)).
5. Start the backend:
   ```bash
   npm run dev
   ```
6. Start the frontend: nothing separate to do — it's already being served by the process you just started.
7. Open the application: `http://localhost:3000/frontend/index.html`

## H. Testing

### Automated tests

None exist yet. `npm test` (in `backend/`) is currently a placeholder that always exits with an error — that's the current state of the project, not a sign your setup is broken.

### Testing the API directly

There is no Swagger/OpenAPI documentation in this project. Here are the real endpoints, with working `curl` examples against a locally running server (Windows users: use `curl.exe`, not PowerShell's `curl` alias, to get raw JSON output without a script-execution prompt):

```bash
# Health checks
curl http://localhost:3000/api/health
curl http://localhost:3000/api/db-health

# Sign up
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"tester\",\"password\":\"test1234\"}"

# Log in (returns a JWT in the "token" field)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"tester\",\"password\":\"test1234\"}"

# Who am I (requires a token from signup/login)
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <paste token here>"

# Ask the AI Tutor a question (requires a token AND is_premium = true for that user)
curl -X POST http://localhost:3000/api/ai/tutor \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <paste token here>" \
  -d "{\"question\":\"What is Beta?\"}"
```

Expected auth/authorization behavior worth checking:
- No `Authorization` header on `/api/auth/me` or `/api/ai/tutor` → `401`.
- Valid token but `is_premium = false` on `/api/ai/tutor` → `403` with `"code":"PREMIUM_REQUIRED"`.
- More than 100 requests to any `/api/*` route within 15 minutes from the same client → `429`.

### Manual UI testing checklist

1. Sign up a new account → alert confirms success, navbar shows your username immediately (no reload needed).
2. Log out → navbar reverts to Login/Sign Up.
3. Log in with the wrong password → rejected, not logged in.
4. Sign up with a username that already exists → rejected with a clear error, not a duplicate row.
5. Open the AI Tutor as a non-premium account → locked screen, not the chat.
6. Flip that account premium in the database (see section D) → reload or click "Upgrade to Premium" on the lock screen → chat unlocks and answers real questions via Gemini.

## I. Troubleshooting

**Port already in use**
```
Error: listen EADDRINUSE: address already in use :::3000
```
Something is already listening on port 3000 — possibly a previous `node server.js` you forgot to stop. Find and stop it, or run on a different port: `PORT=3001 npm run dev`. On Windows, find the process with `netstat -ano | findstr :3000` and stop it with `taskkill /PID <pid> /F`.

**Missing environment variables**
`/api/auth/*` and `/api/ai/tutor` return `503` with `{"error":"DATABASE_URL is not configured"}` or `{"error":"JWT_SECRET is not configured"}` if those aren't set in `backend/.env`. This is an intentional fail-closed response, not a crash — check your `.env` file.

**Database connection errors**
```
{"status":"error","error":"The server does not support SSL connections"}
```
This happens against a fresh local Postgres install, which doesn't have SSL configured by default. It's auto-handled for `localhost`/`127.0.0.1` connection strings (SSL is disabled automatically) — if you still see this, double-check your `DATABASE_URL` actually uses `localhost` or `127.0.0.1`, or set `DATABASE_SSL=false` explicitly in `.env`.

Other common causes: wrong password in the connection string, Postgres service not running, or a database name in `DATABASE_URL` that doesn't exist yet (create it with `CREATE DATABASE alphaquant;`).

**CORS errors**
```
{"error":"Origin not allowed"}
```
The origin the frontend was loaded from isn't in the `ALLOWED_ORIGINS` allowlist (defaults to `http://localhost:3000` / `http://127.0.0.1:3000`). If you're serving the frontend from somewhere else, add that origin to `ALLOWED_ORIGINS` in `backend/.env` (comma-separated for multiple origins).

**Backend not running**
```
Failed to fetch / ERR_CONNECTION_REFUSED
```
Confirm the backend is actually running (`npm run dev` in `backend/`) and check for startup errors in that terminal. Test with `curl http://localhost:3000/api/health` before assuming the frontend is at fault.

**Frontend unable to connect to API**
Almost always caused by loading the frontend from the wrong place — see [section F](#f-running-the-frontend). Load it via `http://localhost:3000/frontend/index.html`, served by the Express backend itself, not via a separate static server or `file://`.

**Missing dependencies**
- Backend: re-run `npm install` in `backend/`. If `bcrypt` fails to build, it needs native compilation — this worked without extra setup on Windows/Node 24 during testing, but if it fails on your machine you may need build tools (Python + a C++ compiler; on Windows, the "Desktop development with C++" workload in Visual Studio Build Tools).
- Python script: re-run `pip install -r requirements.txt`, and confirm you're on Python 3.11/3.12 — see the prerequisites note above about `numpy` failing to build on very new Python versions.
