"""Download daily Vietnamese stock prices and upsert them into Supabase."""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client
from vnstock import Market


SYMBOLS = ("FPT", "HPG", "VNM")
HISTORY_START = "2023-01-01"
UPSERT_BATCH_SIZE = 500


def get_supabase_client() -> Client:
    load_dotenv(Path(__file__).with_name(".env"))

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
        raise RuntimeError(f"No historical data returned for {symbol}.")

    required_columns = {"time", "open", "high", "low", "close", "volume"}
    missing_columns = required_columns.difference(history.columns)
    if missing_columns:
        raise RuntimeError(
            f"Unexpected vnstock response for {symbol}; missing {sorted(missing_columns)}."
        )

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


def upsert_prices(client: Client, records: list[dict]) -> None:
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
        records = fetch_prices(market, symbol)
        upsert_prices(client, records)
        print(f"{symbol}: upserted {len(records)} daily rows")


if __name__ == "__main__":
    main()
