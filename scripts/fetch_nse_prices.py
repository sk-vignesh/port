#!/usr/bin/env python3
"""
NSE EOD Price Fetcher
=====================
1. Downloads the full NSE EQ bhav copy (~2400 stocks) for the last trading day.
2. Bulk-upserts ALL rows into nse_market_data (market reference table).
3. Also updates security_prices + security_latest_prices for the user's
   own securities (matched by ticker_symbol).

Runs at 00:30 UTC Mon-Fri via GitHub Actions.
Manual run: python scripts/fetch_nse_prices.py

Env vars required:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
import time
from datetime import date, timedelta

from nselib import capital_market
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

PRICE_SCALE    = 100   # security_prices/security_latest_prices store price × 100
BATCH_SIZE     = 500   # rows per Supabase upsert call
MAX_LOOKBACK   = 7     # calendar days to look back for a valid bhav copy

# Verified NSE bhav copy column names (from live data, Mar 2026)
COL_SYMBOL = "TCKRSYMB"
COL_SERIES = "SCTYSRS"
COL_CLOSE  = "CLSPRIC"
COL_PREV   = "PRVSCLSGPRIC"
COL_OPEN   = "OPNPRIC"
COL_HIGH   = "HGHPRIC"
COL_LOW    = "LWPRIC"
COL_VOL    = "TTLTRADGVOL"
COL_ISIN   = "ISIN"
COL_NAME   = "FININSTRMNM"

# ── NSE Index constituents (as of Mar 2026) ───────────────────────────────────
# Used to set index_priority on each market row
# Priority 1 = Nifty 50 shown first, 2 = Bank Nifty, 3 = Nifty IT, None = all others
NIFTY50 = {
    "ADANIENT","ADANIPORTS","APOLLOHOSP","ASIANPAINT","AXISBANK",
    "BAJAJ-AUTO","BAJAJFINSV","BAJFINANCE","BPCL","BHARTIARTL",
    "BRITANNIA","CIPLA","COALINDIA","DIVISLAB","DRREDDY",
    "EICHERMOT","GRASIM","HCLTECH","HDFCBANK","HDFCLIFE",
    "HEROMOTOCO","HINDALCO","HINDUNILVR","ICICIBANK","INDUSINDBK",
    "INFY","ITC","JSWSTEEL","KOTAKBANK","LT",
    "M&M","MARUTI","NESTLEIND","NTPC","ONGC",
    "POWERGRID","RELIANCE","SBILIFE","SBIN","SHRIRAMFIN",
    "SUNPHARMA","TATACONSUM","TATAMOTORS","TATASTEEL","TCS",
    "TECHM","TITAN","ULTRACEMCO","WIPRO","LTIM",
}

BANK_NIFTY = {
    "AUBANK","AXISBANK","BANKBARODA","FEDERALBNK","HDFCBANK",
    "ICICIBANK","IDFCFIRSTB","INDUSINDBK","KOTAKBANK","PNB","SBIN","YESBANK",
}

NIFTY_IT = {
    "COFORGE","HCLTECH","INFY","LTIM","MPHASIS",
    "PERSISTENT","TATAELXSI","TCS","TECHM","WIPRO",
}

def index_priority(symbol: str) -> int | None:
    if symbol in NIFTY50:    return 1
    if symbol in BANK_NIFTY: return 2
    if symbol in NIFTY_IT:   return 3
    return None

# ── Helpers ───────────────────────────────────────────────────────────────────

def to_float(val):
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def get_bhav(max_lookback=MAX_LOOKBACK):
    """Walk backwards from yesterday to find the last valid trading day bhav."""
    for days_back in range(1, max_lookback + 1):
        candidate = date.today() - timedelta(days=days_back)
        if candidate.weekday() == 6:   # skip Sundays
            continue
        trade_date_str = candidate.strftime("%d-%m-%Y")
        try:
            print(f"  Trying {trade_date_str}...", end=" ", flush=True)
            df = capital_market.bhav_copy_equities(trade_date=trade_date_str)
            if df is not None and len(df) > 0:
                print(f"✓  ({len(df)} rows)")
                return candidate, df
            print("empty")
        except Exception as exc:
            print(f"unavailable ({exc})")
        time.sleep(1)
    raise RuntimeError(f"No bhav copy found in last {max_lookback} days.")


def batch_upsert(supabase, table: str, rows: list, conflict: str):
    """Upsert rows in batches.
    If PostgREST returns PGRST204 (column not in schema cache — happens right
    after ALTER TABLE ADD COLUMN before the cache refreshes), the offending
    column is stripped from every row and the batch is retried automatically.
    This way the workflow never crashes just because a new column was added.
    """
    import re as _re
    stripped_cols: set = set()

    def _upsert_chunk(chunk):
        attempt = 0
        local_chunk = chunk
        while attempt < 5:
            try:
                supabase.table(table).upsert(local_chunk, on_conflict=conflict).execute()
                return
            except Exception as exc:
                msg = str(exc)
                # PGRST204: column not found in schema cache
                m = _re.search(r"Could not find the '(\w+)' column", msg)
                if m:
                    col = m.group(1)
                    stripped_cols.add(col)
                    print(f"\n  ⚠  Schema cache missing '{col}' — stripping and retrying…")
                    local_chunk = [{k: v for k, v in r.items() if k not in stripped_cols}
                                   for r in local_chunk]
                    attempt += 1
                else:
                    raise

    total = len(rows)
    for i in range(0, total, BATCH_SIZE):
        chunk = rows[i : i + BATCH_SIZE]
        if stripped_cols:
            chunk = [{k: v for k, v in r.items() if k not in stripped_cols} for r in chunk]
        _upsert_chunk(chunk)
        print(f"    — upserted {min(i + BATCH_SIZE, total)}/{total}", end="\r")
    print()
    if stripped_cols:
        print(f"  ⚠  Columns omitted due to schema cache lag: {', '.join(stripped_cols)}")
        print(f"     Reload PostgREST schema cache in Supabase Dashboard → Settings → API")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
        sys.exit(1)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ── 1. Fetch bhav copy ────────────────────────────────────────────────────
    print("Fetching NSE bhav copy...")
    price_date_obj, df = get_bhav()
    price_date = price_date_obj.isoformat()

    # Normalize column names
    df.columns = [c.strip().upper() for c in df.columns]

    # Filter to EQ series
    if COL_SERIES in df.columns:
        df = df[df[COL_SERIES] == "EQ"].copy()
    print(f"  EQ securities: {len(df)}\n")

    # Verify required columns exist
    for col in [COL_SYMBOL, COL_CLOSE]:
        if col not in df.columns:
            print(f"ERROR: expected column '{col}' not found. Got: {list(df.columns)}")
            sys.exit(1)

    # ── 2. Bulk-save ALL rows to nse_market_data ──────────────────────────────
    print("Saving full bhav copy to nse_market_data...")
    market_rows = []
    for _, row in df.iterrows():
        sym = str(row.get(COL_SYMBOL, "")).strip().upper()
        close = to_float(row.get(COL_CLOSE))
        if not sym or not close or close <= 0:
            continue
        market_rows.append({
            "symbol":         sym,
            "date":           price_date,
            "name":           str(row.get(COL_NAME, "") or "").strip() or None,
            "close_price":    close,
            "prev_close":     to_float(row.get(COL_PREV)),
            "open_price":     to_float(row.get(COL_OPEN)),
            "high_price":     to_float(row.get(COL_HIGH)),
            "low_price":      to_float(row.get(COL_LOW)),
            "volume":         int(to_float(row.get(COL_VOL)) or 0) or None,
            "isin":           str(row.get(COL_ISIN, "") or "").strip() or None,
            "index_priority": index_priority(sym),
        })

    batch_upsert(supabase, "nse_market_data", market_rows, "symbol,date")
    print(f"  ✓ {len(market_rows)} NSE EQ records saved for {price_date}\n")

    # Build fast symbol lookup for step 3
    nse_lookup = {r["symbol"]: r for r in market_rows}

    # ── 3. Update security_prices + security_latest_prices for user's stocks ──
    print("Updating user portfolio prices...")
    result = supabase.table("securities").select("id, name, ticker_symbol").eq("is_retired", False).execute()
    securities = result.data or []

    updated = skipped = 0
    for sec in securities:
        raw = (sec.get("ticker_symbol") or "").strip()
        nse_sym = raw.replace(".NS", "").replace(".BO", "").replace(".BSE", "").upper()
        if not nse_sym:
            skipped += 1; continue

        mkt = nse_lookup.get(nse_sym)
        if not mkt:
            print(f"  ⚠  {nse_sym} ({sec['name']}): not in NSE EQ data — skipped")
            skipped += 1; continue

        close_int     = round(mkt["close_price"] * PRICE_SCALE)
        prev_close_int = round(mkt["prev_close"] * PRICE_SCALE) if mkt["prev_close"] else None

        supabase.table("security_prices").upsert(
            {"security_id": sec["id"], "date": price_date, "value": close_int},
            on_conflict="security_id,date",
        ).execute()

        latest = {"security_id": sec["id"], "date": price_date, "value": close_int}
        if prev_close_int:
            latest["previous_close"] = prev_close_int
        supabase.table("security_latest_prices").upsert(latest, on_conflict="security_id").execute()

        print(f"  ✓  {nse_sym}: ₹{mkt['close_price']:,.2f}" +
              (f"  (prev ₹{mkt['prev_close']:,.2f})" if mkt["prev_close"] else ""))
        updated += 1

    print(f"\n{'─'*50}")
    print(f"Done.  NSE records: {len(market_rows)}   Portfolio updated: {updated}   Skipped: {skipped}")


if __name__ == "__main__":
    main()
