const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set. Database-backed routes will return a configuration error.");
}

const pool = new Pool(
    process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        }
        : undefined
);

module.exports = pool;
