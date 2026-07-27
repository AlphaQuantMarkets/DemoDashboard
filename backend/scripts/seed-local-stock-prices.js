// Dev-only fixture: populates a LOCAL stock_prices table (on DATABASE_URL)
// with synthetic OHLCV rows, so `GET /api/stocks/:symbol/history` has
// something to return when you don't have Supabase credentials.
//
// Not used in production — the real stock_prices table lives in Supabase
// and is synced by backend/update_stock.py. Run with: npm run seed:stocks
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pool = require("../db");

const SYMBOLS = ["FPT", "HPG", "VNM", "VNINDEX"];
const DAYS = 150;

function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function generateRows(symbol) {
    const seed = [...symbol].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const rand = seededRandom(seed + 1);

    const rows = [];
    let price = 20 + rand() * 80;
    const end = new Date();

    for (let i = DAYS - 1; i >= 0; i--) {
        const date = new Date(end);
        date.setDate(date.getDate() - i);

        const dailyReturn = (rand() - 0.5) * 0.04;
        price = Math.max(1, price * (1 + dailyReturn));

        const open = price * (1 + (rand() - 0.5) * 0.01);
        const high = Math.max(open, price) * (1 + rand() * 0.015);
        const low = Math.min(open, price) * (1 - rand() * 0.015);
        const volume = Math.floor(500_000 + rand() * 4_500_000);

        rows.push({
            symbol,
            tradingDate: date.toISOString().slice(0, 10),
            open: open.toFixed(2),
            high: high.toFixed(2),
            low: low.toFixed(2),
            close: price.toFixed(2),
            volume
        });
    }

    return rows;
}

async function ensureTableExists() {
    const sqlPath = path.join(__dirname, "..", "migrations", "0003-create-stock-prices-table.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    await pool.query(sql);
}

async function upsertRows(rows) {
    for (const row of rows) {
        await pool.query(
            `INSERT INTO stock_prices (symbol, trading_date, open, high, low, close, volume)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (symbol, trading_date)
             DO UPDATE SET open = EXCLUDED.open, high = EXCLUDED.high,
                           low = EXCLUDED.low, close = EXCLUDED.close,
                           volume = EXCLUDED.volume`,
            [row.symbol, row.tradingDate, row.open, row.high, row.low, row.close, row.volume]
        );
    }
}

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL is not set — cannot seed a local stock_prices table.");
        process.exitCode = 1;
        return;
    }

    console.log("Ensuring stock_prices table exists on DATABASE_URL...");
    await ensureTableExists();

    for (const symbol of SYMBOLS) {
        const rows = generateRows(symbol);
        await upsertRows(rows);
        console.log(`Seeded ${rows.length} synthetic rows for ${symbol}`);
    }

    console.log("Done. This is synthetic test data — not real market history.");
    await pool.end();
}

main().catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
});
