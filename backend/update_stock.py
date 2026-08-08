"""Download daily Vietnamese stock prices and upsert them into Supabase."""

from __future__ import annotations

import os
import time
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client
from vnstock import Listing, Market


# Used only if the live VN30 lookup below fails — a snapshot of VN30
# membership so a sync can still run without vnstock's Listing API.
FALLBACK_SYMBOLS = (
    "ACB", "BID", "BSR", "CTG", "FPT", "GAS", "GVR", "HDB", "HPG", "LPB",
    "MBB", "MSN", "MWG", "PLX", "SAB", "SHB", "SSB", "SSI", "STB", "TCB",
    "TPB", "VCB", "VHM", "VIB", "VIC", "VJC", "VNM", "VPB", "VPL", "VRE",
)
BENCHMARK_INDEX = "VNINDEX"
HISTORY_START = "2023-01-01"
UPSERT_BATCH_SIZE = 500

# vnstock's free ("Guest") tier silently caps a single ohlcv() call to
# roughly the most recent 100 rows *within the requested range* — it does
# NOT error, it just quietly drops everything older, regardless of how far
# back `start` is. Confirmed directly: requesting 2023-01-01..today returns
# only ~100 recent trading days, but requesting a narrow window entirely
# inside 2023 returns real 2023 data. So actually reaching back to
# HISTORY_START requires splitting the range into windows comfortably under
# that per-call cap — see CHUNK_DAYS below.
CHUNK_DAYS = 90  # ~60 trading days per window; safely under the ~100-row cap

# vnstock's free ("Guest") tier allows 20 requests/minute, and each ohlcv()
# call issues ~2 requests — so a fixed delay between requests (used both
# between chunks within a symbol and between symbols) keeps us under that
# limit proactively instead of just reacting to being throttled. Chunking
# (above) multiplies how many ohlcv() calls a full sync makes, so this needs
# to hold to ≤20/min on its own: 2 requests every 6s ≈ 20/min.
REQUEST_DELAY_SECONDS = 6
# vnstock signals "you're rate-limited" by calling sys.exit(), which raises
# SystemExit — not a normal Exception — so it must be caught explicitly.
# Confirmed live: syncing all 30 VN30 symbols without any delay hit this
# after exactly 10 symbols (20 requests).
RATE_LIMIT_BACKOFF_SECONDS = 35
MAX_RATE_LIMIT_RETRIES = 3


def get_symbols() -> tuple[str, ...]:
    """VN30 (the 30 largest/most-liquid HOSE stocks), fetched live so index
    rebalances are picked up automatically. Falls back to a static snapshot
    if the listing lookup itself fails — this must never block the price
    sync for the symbols we already know about."""
    try:
        symbols = tuple(Listing().symbols_by_group("VN30"))
        if not symbols:
            raise ValueError("VN30 group listing returned no symbols")
        return symbols
    except Exception as error:  # noqa: BLE001 - any failure should fall back, not crash the sync
        print(f"⚠️ Could not fetch VN30 listing ({error}); using fallback symbol list")
        return FALLBACK_SYMBOLS


def get_supabase_client() -> Client:
    # Load .env từ cùng thư mục với script (backend/)
    load_dotenv(Path(__file__).parent / ".env")

    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.")

    return create_client(url, service_key)

def _date_chunks(start: str, end: str, chunk_days: int) -> list[tuple[str, str]]:
    """Split [start, end] into consecutive (chunk_start, chunk_end) windows of
    at most chunk_days each, so each window stays under vnstock's per-call
    row cap regardless of how far apart start and end are."""
    chunks: list[tuple[str, str]] = []
    chunk_start = date.fromisoformat(start)
    final_end = date.fromisoformat(end)

    while chunk_start <= final_end:
        chunk_end = min(chunk_start + timedelta(days=chunk_days - 1), final_end)
        chunks.append((chunk_start.isoformat(), chunk_end.isoformat()))
        chunk_start = chunk_end + timedelta(days=1)

    return chunks


def _history_to_records(symbol: str, history) -> list[dict]:
    """Convert one ohlcv() result (a pandas DataFrame) into upsert-ready dicts."""
    if history.empty:
        return []

    required_columns = {"time", "open", "high", "low", "close", "volume"}
    missing_columns = required_columns.difference(history.columns)
    if missing_columns:
        print(f"⚠️ Missing columns for {symbol}: {sorted(missing_columns)} — skipping chunk")
        return []

    records: list[dict] = []
    for row in history.loc[:, ["time", "open", "high", "low", "close", "volume"]].itertuples(index=False):
        trading_date, open_price, high_price, low_price, close_price, volume = row
        if any(value is None for value in (open_price, high_price, low_price, close_price, volume)):
            continue
        records.append(
            {
                "symbol": symbol,
                "trading_date": trading_date.date().isoformat(),
                "open": float(open_price),
                "high": float(high_price),
                "low": float(low_price),
                "close": float(close_price),
                "volume": int(volume),
            }
        )

    return records


def fetch_prices(market: Market, symbol: str) -> list[dict]:
    quote = market.index(symbol) if symbol == BENCHMARK_INDEX else market.equity(symbol)
    chunks = _date_chunks(HISTORY_START, date.today().isoformat(), CHUNK_DAYS)

    records: list[dict] = []
    for chunk_index, (chunk_start, chunk_end) in enumerate(chunks):
        history = quote.ohlcv(start=chunk_start, end=chunk_end, interval="1D")
        records.extend(_history_to_records(symbol, history))

        if chunk_index < len(chunks) - 1:
            time.sleep(REQUEST_DELAY_SECONDS)

    if not records:
        print(f"⚠️ No historical data for {symbol} — skipping")

    return records


def fetch_prices_with_rate_limit_retry(market: Market, symbol: str) -> list[dict]:
    """Wraps fetch_prices() with retry-and-backoff specifically for vnstock's
    rate limiter (SystemExit), so a burst of requests doesn't take down the
    whole sync run — see RATE_LIMIT_BACKOFF_SECONDS above for why this needs
    to be SystemExit rather than a normal try/except Exception."""
    for attempt in range(1, MAX_RATE_LIMIT_RETRIES + 1):
        try:
            return fetch_prices(market, symbol)
        except SystemExit as error:
            if attempt == MAX_RATE_LIMIT_RETRIES:
                raise
            print(
                f"⏳ {symbol}: rate limited ({error}) — waiting "
                f"{RATE_LIMIT_BACKOFF_SECONDS}s before retry {attempt}/{MAX_RATE_LIMIT_RETRIES}..."
            )
            time.sleep(RATE_LIMIT_BACKOFF_SECONDS)

    return []  # unreachable: the loop above always returns or raises


def deduplicate_records(records: list[dict]) -> list[dict]:
    """Remove duplicate entries, keeping the last occurrence of each (symbol, trading_date) pair."""
    seen = {}
    for record in records:
        key = (record["symbol"], record["trading_date"])
        seen[key] = record
    return list(seen.values())


def upsert_prices(client: Client, records: list[dict]) -> None:
    if not records:
        print("⚠️ No records to upsert")
        return
    
    # Deduplicate records
    records = deduplicate_records(records)
    
    for start in range(0, len(records), UPSERT_BATCH_SIZE):
        batch = records[start : start + UPSERT_BATCH_SIZE]
        client.table("stock_prices").upsert(
            batch,
            on_conflict="symbol,trading_date"
        ).execute()


def main() -> None:
    client = get_supabase_client()
    market = Market()
    symbols = get_symbols()
    print(f"📋 Syncing {len(symbols)} symbols: {', '.join(symbols)}")

    failed: list[str] = []
    all_symbols = (*symbols, BENCHMARK_INDEX)

    for index, symbol in enumerate(all_symbols):
        print(f"📥 Fetching {symbol}...")

        try:
            records = fetch_prices_with_rate_limit_retry(market, symbol)
        except SystemExit as error:
            print(f"❌ {symbol}: still rate-limited after {MAX_RATE_LIMIT_RETRIES} retries ({error}) — skipping")
            failed.append(symbol)
            continue
        except Exception as error:  # noqa: BLE001 - one bad symbol must not abort the rest of the sync
            print(f"❌ {symbol}: fetch failed ({error}) — skipping")
            failed.append(symbol)
            continue

        if records:
            print(f"✅ {symbol}: upserted {len(records)} daily rows")
            upsert_prices(client, records)
        else:
            print(f"⚠️ {symbol}: no data available")

        if index < len(all_symbols) - 1:
            time.sleep(REQUEST_DELAY_SECONDS)

    if failed:
        print(f"⚠️ {len(failed)} symbol(s) failed this run: {', '.join(failed)}")


if __name__ == "__main__":
    main()