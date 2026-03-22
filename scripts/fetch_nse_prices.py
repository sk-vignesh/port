#!/usr/bin/env python3
"""
NSE EOD Price Fetcher
=====================
Fetches the official end-of-day bhav copy from NSE for every active security
in the app's Supabase database, then upserts prices into:
  - security_prices         (historical log, one row per security per date)
  - security_latest_prices  (current price used by the UI)

Run automatically at 00:30 UTC Mon-Fri via GitHub Actions.
Can also be triggered manually: python scripts/fetch_nse_prices.py

Environment variables required:
  SUPABASE_URL              - Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY - Service role key (bypasses RLS)

NSE ticker symbols:
  Store bare NSE symbols in the ticker_symbol column.
  Examples: RELIANCE, TCS, INFY, BAJFINANCE, HDFCBANK
  '.NS' and '.BO' suffixes are stripped automatically.
"""

import os
import sys
import time
from datetime import date, timedelta

from nselib import capital_market
from supabase import create_client

# ── Config ───────────────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# Prices stored as integer × 100  (₹1523.45  →  152345)
PRICE_SCALE = 100

# How many calendar days back to search for the last trading day
MAX_LOOKBACK_DAYS = 7


# ── Helpers ──────────────────────────────────────────────────────────────────

def to_float(val) -> float | None:
    """Safely convert a value (possibly a comma-formatted string) to float."""
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def get_last_trading_day_bhav(max_lookback: int = MAX_LOOKBACK_DAYS):
    """
    Walk backwards from yesterday until we find a date that has a bhav copy.
    NSE doesn't publish bhav copies on weekends or public holidays.

    Returns (trade_date_str: str, bhav_df: pd.DataFrame) or raises RuntimeError.
    """
    for days_back in range(1, max_lookback + 1):
        candidate = date.today() - timedelta(days=days_back)
        # Skip Sundays (NSE is closed)
        if candidate.weekday() == 6:
            continue
        trade_date_str = candidate.strftime("%d-%m-%Y")
        try:
            print(f"  Trying bhav copy for {trade_date_str}...", end=" ", flush=True)
            df = capital_market.bhav_copy_equities(trade_date=trade_date_str)
            if df is not None and len(df) > 0:
                print(f"✓  ({len(df)} rows)")
                return trade_date_str, candidate, df
            else:
                print("empty")
        except Exception as exc:
            print(f"not available ({exc})")
        # Brief pause to be polite to NSE
        time.sleep(1)

    raise RuntimeError(
        f"Could not find a valid NSE bhav copy in the last {max_lookback} days."
    )


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
        sys.exit(1)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. Load all active securities
    result = (
        supabase.table("securities")
        .select("id, name, ticker_symbol")
        .eq("is_retired", False)
        .execute()
    )
    securities = result.data or []

    if not securities:
        print("No active securities in the database. Nothing to do.")
        return

    print(f"Found {len(securities)} active securities.\n")

    # 2. Fetch NSE bhav copy (finds last trading day automatically)
    print("Fetching NSE bhav copy...")
    trade_date_str, trade_date_obj, df = get_last_trading_day_bhav()
    price_date = trade_date_obj.isoformat()   # YYYY-MM-DD for Supabase

    # Normalize column names to UPPER STRIP
    df.columns = [c.strip().upper() for c in df.columns]

    print(f"  Bhav copy columns: {list(df.columns)}")
    print(f"  Total rows: {len(df)}")

    # Filter to EQ (equity) series only — but only if the SERIES column exists.
    # Some nselib versions / dates return pre-filtered or differently structured data.
    if "SERIES" in df.columns:
        df = df[df["SERIES"] == "EQ"].copy()
        print(f"  EQ rows: {len(df)}")
    else:
        print("  ⚠  No SERIES column found — using all rows as-is")
        df = df.copy()

    # Possible alternate column names across nselib versions
    # Map each logical field to candidate column names in priority order
    COL_CLOSE = ["CLOSE", "CLOSE PRICE", "CLOSEPRICE", "LAST", "LASTPRICE"]
    COL_PREV  = ["PREVCLOSE", "PREV CLOSE", "PREVIOUSCLOSE", "PREVIOUS CLOSE"]

    def pick_col(df, candidates):
        for c in candidates:
            if c in df.columns:
                return c
        return None

    col_close = pick_col(df, COL_CLOSE)
    col_prev  = pick_col(df, COL_PREV)

    if not col_close:
        print(f"  ERROR: cannot find a close-price column. Available: {list(df.columns)}")
        sys.exit(1)

    print(f"  Using close col='{col_close}', prev_close col='{col_prev}'")

    for _, row in df.iterrows():
        sym = str(row.get("SYMBOL", "")).strip().upper()
        if sym:
            nse_lookup[sym] = row

    print(f"\nProcessing {len(securities)} securities against {len(nse_lookup)} NSE EQ symbols...\n")

    updated = 0
    skipped = 0

    for sec in securities:
        raw_ticker = (sec.get("ticker_symbol") or "").strip()
        # Strip exchange suffixes users might have typed
        nse_sym = (
            raw_ticker
            .replace(".NS", "")
            .replace(".BO", "")
            .replace(".BSE", "")
            .upper()
        )

        if not nse_sym:
            print(f"  ⚠  {sec['name']}: no ticker symbol — skipped")
            skipped += 1
            continue

        row = nse_lookup.get(nse_sym)
        if row is None:
            print(f"  ⚠  {nse_sym} ({sec['name']}): not found in NSE EQ bhav copy — skipped")
            skipped += 1
            continue

        # --- Extract prices ---------------------------------------------------
        close_price = to_float(row.get(col_close))
        prev_close  = to_float(row.get(col_prev)) if col_prev else None

        if close_price is None or close_price <= 0:
            print(f"  ⚠  {nse_sym}: invalid close price ({row.get('CLOSE')}) — skipped")
            skipped += 1
            continue

        price_int      = round(close_price * PRICE_SCALE)
        prev_close_int = round(prev_close  * PRICE_SCALE) if prev_close is not None else None

        sec_id = sec["id"]

        # --- Upsert security_prices (historical log) --------------------------
        supabase.table("security_prices").upsert(
            {"security_id": sec_id, "date": price_date, "value": price_int},
            on_conflict="security_id,date",
        ).execute()

        # --- Upsert security_latest_prices ------------------------------------
        latest_payload: dict = {"security_id": sec_id, "value": price_int}
        if prev_close_int is not None:
            latest_payload["previous_close"] = prev_close_int

        supabase.table("security_latest_prices").upsert(
            latest_payload,
            on_conflict="security_id",
        ).execute()

        print(f"  ✓  {nse_sym}: ₹{close_price:,.2f}"
              + (f"  (prev ₹{prev_close:,.2f})" if prev_close else ""))
        updated += 1

    print(f"\n{'─'*50}")
    print(f"Done.  Updated: {updated}   Skipped: {skipped}   Date: {price_date}")


if __name__ == "__main__":
    main()
