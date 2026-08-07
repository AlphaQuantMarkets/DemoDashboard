// Server-side wrapper around the stock_prices table. In production this is a
// Supabase project separate from DATABASE_URL (see
// backend/migrations/0003-create-stock-prices-table.sql) reached with the
// service-role key so the browser never needs Supabase credentials.
//
// Local dev fallback: if SUPABASE_URL/SUPABASE_SERVICE_KEY aren't set but
// DATABASE_URL is, read stock_prices from that same local Postgres instead
// (create the table there with the migration file above, then seed it with
// `npm run seed:stocks`). This is a convenience for developers without
// Supabase access — production should keep using the real Supabase project.
const { createClient } = require("@supabase/supabase-js");
const pool = require("../db");

const PAGE_SIZE = 1000;
const MAX_ROWS_PER_SYMBOL = 500;

let client;
let warnedAboutLocalFallback = false;

function getSupabaseDiagnostics() {
    let host = null;

    try {
        host = process.env.SUPABASE_URL
            ? new URL(process.env.SUPABASE_URL).host
            : null;
    } catch {
        host = "invalid-url";
    }

    return {
        hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
        hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_KEY),
        supabaseHost: host
    };
}

function getErrorDiagnostics(error) {
    return {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        status: error?.status,
        details: error?.details,
        hint: error?.hint,
        cause: error?.cause?.message
    };
}

function getSupabaseClient() {
    if (client) {
        return client;
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        return null;
    }

    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    return client;
}

function formatDate(value) {
    return value instanceof Date
        ? value.toISOString().slice(0, 10)
        : String(value).slice(0, 10);
}

async function getStockHistoryFromSupabase(supabase, symbol) {
    const rows = [];

    for (let from = 0; ; from += PAGE_SIZE) {
        let data;
        let error;

        try {
            ({ data, error } = await supabase
                .from("stock_prices")
                .select("trading_date, open, high, low, close, volume")
                .eq("symbol", symbol)
                .order("trading_date", { ascending: true })
                .range(from, from + PAGE_SIZE - 1));
        } catch (cause) {
            console.error("Stock API provider request threw before a response", {
                source: "supabase",
                symbol,
                from,
                to: from + PAGE_SIZE - 1,
                ...getSupabaseDiagnostics(),
                error: getErrorDiagnostics(cause)
            });

            const wrapped = new Error("Stock data provider request failed");
            wrapped.status = 502;
            wrapped.source = "supabase";
            wrapped.cause = cause;
            throw wrapped;
        }

        if (error) {
            console.error("Stock API provider returned an error", {
                source: "supabase",
                symbol,
                from,
                to: from + PAGE_SIZE - 1,
                ...getSupabaseDiagnostics(),
                error: getErrorDiagnostics(error)
            });

            const wrapped = new Error(error.message);
            wrapped.status = 502;
            wrapped.source = "supabase";
            wrapped.cause = error;
            throw wrapped;
        }

        if (!data || data.length === 0) {
            break;
        }

        rows.push(...data);

        if (data.length < PAGE_SIZE) {
            break;
        }
    }

    return rows.map((row) => ({
        date: formatDate(row.trading_date),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume)
    }));
}

async function getStockHistoryFromLocalPostgres(symbol) {
    if (!warnedAboutLocalFallback) {
        console.warn(
            "SUPABASE_URL/SUPABASE_SERVICE_KEY not set — reading stock_prices from " +
            "DATABASE_URL instead (local dev fallback, see backend/services/stockService.js)."
        );
        warnedAboutLocalFallback = true;
    }

    let result;
    try {
        result = await pool.query(
            `SELECT trading_date, open, high, low, close, volume
             FROM stock_prices
             WHERE symbol = $1
             ORDER BY trading_date ASC`,
            [symbol]
        );
    } catch (err) {
        console.error("Stock API local database query failed", {
            source: "database-fallback",
            symbol,
            ...getSupabaseDiagnostics(),
            error: getErrorDiagnostics(err)
        });

        const wrapped = new Error(
            `Local stock_prices lookup failed: ${err.message}. Run the SQL in ` +
            "backend/migrations/0003-create-stock-prices-table.sql against DATABASE_URL, " +
            "then `npm run seed:stocks`."
        );
        wrapped.status = 502;
        wrapped.source = "database-fallback";
        wrapped.cause = err;
        throw wrapped;
    }

    return result.rows.map((row) => ({
        date: formatDate(row.trading_date),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume)
    }));
}

async function getStockHistory(symbol) {
    const supabase = getSupabaseClient();

    let rows;
    if (supabase) {
        rows = await getStockHistoryFromSupabase(supabase, symbol);
    } else if (process.env.DATABASE_URL) {
        rows = await getStockHistoryFromLocalPostgres(symbol);
    } else {
        const error = new Error(
            "Neither SUPABASE_URL/SUPABASE_SERVICE_KEY nor DATABASE_URL is configured"
        );
        error.status = 503;
        throw error;
    }

    return rows.length > MAX_ROWS_PER_SYMBOL
        ? rows.slice(-MAX_ROWS_PER_SYMBOL)
        : rows;
}

module.exports = { getStockHistory };
