// Run this to figure out why local login/signup isn't working, instead of
// guessing back and forth. Checks the setup in the order things actually
// break: env file -> required vars -> DB connectivity -> migrations ->
// whether the server is even running -> whether auth actually responds.
//
// Usage: cd backend && node scripts/diagnose-local-setup.js
require("dotenv").config();

const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

let hasFailure = false;

function ok(message) {
    console.log(`  ✅ ${message}`);
}

function fail(message, fix) {
    hasFailure = true;
    console.log(`  ❌ ${message}`);
    if (fix) {
        console.log(`     → ${fix}`);
    }
}

function warn(message, fix) {
    console.log(`  ⚠️  ${message}`);
    if (fix) {
        console.log(`     → ${fix}`);
    }
}

function section(title) {
    console.log(`\n${title}`);
}

async function checkEnvFile() {
    section("1. backend/.env");

    const envPath = path.join(__dirname, "..", ".env");
    if (!fs.existsSync(envPath)) {
        fail(
            "backend/.env does not exist.",
            "It's gitignored on purpose, so a fresh clone never has one. " +
            "Run: cp backend/.env.example backend/.env, then fill in real values."
        );
        return false;
    }

    ok("backend/.env exists.");
    return true;
}

function checkRequiredVars() {
    section("2. Required environment variables (for login/signup specifically)");

    const required = ["DATABASE_URL", "JWT_SECRET"];
    let allPresent = true;

    for (const key of required) {
        if (process.env[key] && process.env[key].trim()) {
            ok(`${key} is set.`);
        } else {
            fail(`${key} is missing or empty.`, `Set ${key} in backend/.env — see backend/.env.example for what it needs.`);
            allPresent = false;
        }
    }

    // Not required for auth, but worth flagging since they silently break
    // other features (AI Tutor, stock charts) in a way that looks similar.
    for (const key of ["GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_KEY"]) {
        if (!process.env[key] || !process.env[key].trim()) {
            warn(`${key} is not set — unrelated to login, but AI Tutor / stock data won't work until it is.`);
        }
    }

    return allPresent;
}

async function checkDatabaseConnection() {
    section("3. Database connection (DATABASE_URL)");

    if (!process.env.DATABASE_URL) {
        warn("Skipped — DATABASE_URL isn't set (see above).");
        return false;
    }

    const pool = require("../db");

    try {
        await pool.query("SELECT 1");
        ok("Connected to the database successfully.");
    } catch (error) {
        fail(
            `Could not connect: ${error.message}`,
            "Confirm Postgres is actually running and DATABASE_URL points at it. " +
            "See docs/setup.md section D.2 — you need your own local/hosted Postgres, it's separate from the shared Supabase project."
        );
        await pool.end().catch(() => {});
        return false;
    }

    try {
        const result = await pool.query("SELECT to_regclass('public.users') AS users_table");
        if (result.rows[0].users_table) {
            ok("The 'users' table exists.");
        } else {
            fail(
                "Connected, but the 'users' table doesn't exist.",
                "Run: cd backend && npm run migrate"
            );
        }
    } finally {
        await pool.end().catch(() => {});
    }

    return true;
}

async function checkServerRunning() {
    section(`4. Is the backend actually running? (${BASE_URL})`);

    try {
        const response = await fetch(`${BASE_URL}/api/health`);
        const body = await response.json();
        ok(`Server is up. /api/health responded: ${JSON.stringify(body)}`);
        return true;
    } catch {
        fail(
            "Could not reach the server.",
            "Start it in another terminal: cd backend && npm start"
        );
        return false;
    }
}

async function checkAuthEndpoint() {
    section("5. Does the login endpoint actually respond?");

    try {
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "__diagnose__", password: "__diagnose__" })
        });

        if (response.status === 503) {
            const body = await response.json().catch(() => ({}));
            fail(`Server is running but returned 503: ${body.error || "(no message)"}`, "This confirms a missing env var above — fix that first.");
        } else if (response.status === 401 || response.status === 400) {
            ok(`Login endpoint responded correctly (${response.status} for a bogus login — this is expected and means auth is working).`);
        } else if (response.status === 429) {
            ok("Login endpoint is reachable, just rate-limited from repeated testing (429) — not a real problem, try again in a bit.");
        } else {
            warn(`Unexpected status ${response.status}. Not necessarily broken, but worth a look.`);
        }
    } catch (error) {
        fail(`Request failed: ${error.message}`, "Server may have crashed after starting — check its terminal output.");
    }
}

async function main() {
    console.log("AlphaQuant local setup diagnostic\n" + "=".repeat(40));

    const hasEnvFile = await checkEnvFile();
    if (hasEnvFile) {
        checkRequiredVars();
        await checkDatabaseConnection();
    }

    const serverUp = await checkServerRunning();
    if (serverUp) {
        await checkAuthEndpoint();
    }

    console.log("\n" + "=".repeat(40));
    console.log(
        hasFailure
            ? "Found at least one problem above — fix the first ❌ and re-run this script."
            : "No problems found via the API. If login still fails in the browser, the likely cause is\n" +
              "how the FRONTEND was opened, not the backend:\n" +
              "  - It must be loaded as http://localhost:3000/frontend/index.html\n" +
              "  - NOT opened directly from disk (file://...)\n" +
              "  - NOT served by a different tool/port (e.g. VS Code Live Server on :5500)\n" +
              "  Opening it any other way means it can't correctly reach this backend.\n" +
              "  See docs/setup.md section F for why this matters."
    );
}

main();
