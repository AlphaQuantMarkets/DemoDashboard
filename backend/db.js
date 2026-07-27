// Schema source of truth for this database (the users table) lives in
// backend/db-migrations/, run via `npm run migrate` (see run-migrations.js).
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set. Database-backed routes will return a configuration error.");
}

function shouldUseSsl(connectionString) {
    if (process.env.DATABASE_SSL === "true") {
        return true;
    }

    if (process.env.DATABASE_SSL === "false") {
        return false;
    }

    return !/localhost|127\.0\.0\.1/.test(connectionString || "");
}

const pool = new Pool(
    process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: shouldUseSsl(process.env.DATABASE_URL)
                ? { rejectUnauthorized: false }
                : false
        }
        : undefined
);

module.exports = pool;
