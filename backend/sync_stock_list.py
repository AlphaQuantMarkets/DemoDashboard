"""Refresh frontend/stocks.json's ticker list from vnstock's VN30 listing.

Separate from update_stock.py on purpose: this touches a checked-in repo
file (ticker metadata), while update_stock.py only writes to Supabase
(price history) and runs on a schedule. Run this by hand whenever the
symbol universe changes (see docs/setup.md).

Existing entries are preserved as-is (their curated display names aren't
overwritten); only newly-added VN30 symbols get a name, taken from
vnstock's own company listing — never guessed.
"""

from __future__ import annotations

import json
from pathlib import Path

from vnstock import Listing

STOCKS_JSON_PATH = Path(__file__).parent.parent / "frontend" / "stocks.json"


def fetch_vn30_names() -> dict[str, str]:
    listing = Listing()
    vn30_symbols = set(listing.symbols_by_group("VN30"))

    exchange_listing = listing.symbols_by_exchange()
    names_by_symbol = dict(zip(exchange_listing["symbol"], exchange_listing["organ_name"]))

    return {symbol: names_by_symbol[symbol] for symbol in vn30_symbols if symbol in names_by_symbol}


def main() -> None:
    data = json.loads(STOCKS_JSON_PATH.read_text(encoding="utf-8"))
    existing_stocks = data.get("stocks", {})

    vn30_names = fetch_vn30_names()
    added = 0

    for symbol, name in sorted(vn30_names.items()):
        if symbol not in existing_stocks:
            existing_stocks[symbol] = {"name": name}
            added += 1

    data["stocks"] = dict(sorted(existing_stocks.items()))
    STOCKS_JSON_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"✅ {STOCKS_JSON_PATH}: {len(existing_stocks)} tickers total ({added} newly added)")


if __name__ == "__main__":
    main()
