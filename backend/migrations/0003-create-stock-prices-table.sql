-- Schema for the stock_prices table, used by backend/update_stock.py and read
-- directly by the frontend (frontend/supabase.js, frontend/app.js).
--
-- This table lives on a DIFFERENT Postgres database than the users table
-- above (a separate Supabase project, not the one DATABASE_URL points at —
-- see docs/setup.md section D). It is NOT managed by node-pg-migrate /
-- `npm run migrate`, since that's wired to DATABASE_URL specifically.
--
-- Only relevant if you're provisioning a brand-new Supabase project from
-- scratch (e.g. a separate staging environment) — normally you don't need
-- this at all, since the whole team shares one already-live Supabase project
-- with this table already in place. Run this manually, once, against that
-- project's own Postgres connection string (Supabase dashboard → Settings →
-- Database → Connection string) via the Supabase SQL editor or psql.
--
-- The UNIQUE(symbol, trading_date) constraint is required by
-- backend/update_stock.py's upsert(..., on_conflict="symbol,trading_date").
CREATE TABLE IF NOT EXISTS stock_prices (
    id serial PRIMARY KEY,
    symbol text NOT NULL,
    trading_date date NOT NULL,
    open numeric NOT NULL,
    high numeric NOT NULL,
    low numeric NOT NULL,
    close numeric NOT NULL,
    volume bigint NOT NULL,
    UNIQUE (symbol, trading_date)
);
