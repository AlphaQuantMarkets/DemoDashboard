require("dotenv").config();

const path = require("path");
const { runner } = require("node-pg-migrate");

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not configured.");
    process.exit(1);
}

runner({
    databaseUrl: process.env.DATABASE_URL,
    dir: path.join(__dirname, "db-migrations"),
    direction: "up",
    migrationsTable: "pgmigrations",
    log: console.log
}).catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
