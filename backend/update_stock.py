"""Download daily Vietnamese stock prices and upsert them into Supabase."""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client
from vnstock import Market


SYMBOLS = ("VNM", "VIC", "HPG", "FPT", "MWG", "VHM", "TCB", "MBB")
HISTORY_START = "2023-01-01"
UPSERT_BATCH_SIZE = 500


def get_supabase_client() -> Client:
    # Load .env từ cùng thư mục với script (backend/)
    load_dotenv(Path(__file__).parent / ".env")

    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.")

    return create_client(url, service_key)

def fetch_prices(market: Market, symbol: str) -> list[dict]:
    history = market.equity(symbol).ohlcv(
        start=HISTORY_START,
        end=date.today().isoformat(),
        interval="1D",
    )
    if history.empty:
        print(f"⚠️ No historical data for {symbol} — skipping")
        return []

    required_columns = {"time", "open", "high", "low", "close", "volume"}
    missing_columns = required_columns.difference(history.columns)
    if missing_columns:
        print(f"⚠️ Missing columns for {symbol}: {sorted(missing_columns)} — skipping")
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
            on_conflict="symbol,trading_date",
        ).execute()


def main() -> None:
    client = get_supabase_client()
    market = Market()

    for symbol in SYMBOLS:
        print(f"📥 Fetching {symbol}...")
        records = fetch_prices(market, symbol)
        
        if records:
            print(f"✅ {symbol}: upserted {len(records)} daily rows")
            upsert_prices(client, records)
        else:
            print(f"⚠️ {symbol}: no data available")


if __name__ == "__main__":
    main()