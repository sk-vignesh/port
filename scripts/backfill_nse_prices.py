#!/usr/bin/env python3
"""
NSE Historical Bhav Copy Backfiller
=====================================
Fills gaps in price_history by fetching NSE EQ bhav copies for all market
working days between START_DATE and END_DATE (env vars or defaults).

Usage:
  python scripts/backfill_nse_prices.py

Env vars:
  SUPABASE_URL               (required)
  SUPABASE_SERVICE_ROLE_KEY  (required)
  BACKFILL_START             YYYY-MM-DD  (default: 2026-02-01)
  BACKFILL_END               YYYY-MM-DD  (default: yesterday)
  SKIP_EXISTING              true/false  (default: true — skip dates that
                                          already have ≥ 100 rows in DB)
"""

import os
import sys
import time
from datetime import date, timedelta

from nselib import capital_market
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

START_DATE   = os.environ.get("BACKFILL_START", "2026-02-01")
END_DATE     = os.environ.get("BACKFILL_END",   (date.today() - timedelta(days=1)).isoformat())
SKIP_EXISTING = os.environ.get("SKIP_EXISTING", "true").lower() != "false"

BATCH_SIZE   = 500
RETRY_DELAY  = 5    # seconds between retries on transient errors
MAX_RETRIES  = 3

# Column names from NSE bhav copy (verified Mar 2026)
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

def index_priority(sym):
    if sym in NIFTY50:    return 1
    if sym in BANK_NIFTY: return 2
    if sym in NIFTY_IT:   return 3
    return None

def to_float(val):
    try:    return float(val)
    except: return None

def batch_upsert(supabase, table, rows, conflict_cols):
    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i:i+BATCH_SIZE]
        supabase.table(table).upsert(chunk, on_conflict=conflict_cols).execute()
        print(f"    — upserted {min(i+BATCH_SIZE, len(rows))}/{len(rows)}")

def market_days_between(start: date, end: date):
    """Yield all Mon-Fri dates between start and end inclusive."""
    cur = start
    while cur <= end:
        if cur.weekday() < 5:  # 0=Mon, 4=Fri
            yield cur
        cur += timedelta(days=1)

def fetch_bhav_for_date(target: date):
    """
    Try fetching bhavcopy for target date.
    nselib uses DD-MM-YYYY format.
    Returns (df, actual_date) or (None, None) if not available.
    """
    date_str = target.strftime("%d-%m-%Y")
    for attempt in range(MAX_RETRIES):
        try:
            df = capital_market.bhav_copy_with_delivery(date_str)
            return df, target
        except Exception as e:
            msg = str(e).lower()
            # Common holidays / no-data signals
            if any(x in msg for x in ("no data", "404", "holiday", "no record")):
                return None, None
            if attempt < MAX_RETRIES - 1:
                print(f"    retrying ({attempt+1}/{MAX_RETRIES}) — {e}")
                time.sleep(RETRY_DELAY)
            else:
                print(f"    failed after {MAX_RETRIES} retries — {e}")
                return None, None

def dates_already_in_db(supabase, dates):
    """Return set of date strings that already have ≥ 100 rows in price_history."""
    if not dates:
        return set()
    iso_dates = [d.isoformat() for d in dates]
    # Query counts grouped by date
    # Supabase doesn't support GROUP BY directly in the client; use a
    # range approach: for each date, check if at least one row exists.
    # Efficient: single query with .in_() filter, then deduplicate.
    result = supabase.table("price_history") \
        .select("date") \
        .in_("date", iso_dates) \
        .limit(len(iso_dates) * 100) \
        .execute()
    counts = {}
    for row in (result.data or []):
        d = row["date"]
        counts[d] = counts.get(d, 0) + 1
    return {d for d, cnt in counts.items() if cnt >= 100}

def main():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    start = date.fromisoformat(START_DATE)
    end   = date.fromisoformat(END_DATE)
    all_days = list(market_days_between(start, end))

    print(f"Backfill range : {start} → {end}")
    print(f"Working days   : {len(all_days)}")
    print(f"Skip existing  : {SKIP_EXISTING}\n")

    # Find which dates already have data (batch check)
    existing_dates = set()
    if SKIP_EXISTING:
        print("Checking DB for existing dates…")
        existing_dates = dates_already_in_db(supabase, all_days)
        print(f"  {len(existing_dates)} dates already populated — will skip\n")

    # Process each missing day
    filled = skipped_existing = skipped_holiday = errors = 0

    for day in all_days:
        iso = day.isoformat()

        if iso in existing_dates:
            skipped_existing += 1
            continue

        print(f"Fetching {iso}…")
        df, actual = fetch_bhav_for_date(day)

        if df is None:
            print(f"  ⚠  No data (public holiday or NSE archive gap) — skipping")
            skipped_holiday += 1
            time.sleep(1)
            continue

        # Normalise columns
        df.columns = [c.strip().upper() for c in df.columns]
        if COL_SERIES in df.columns:
            df = df[df[COL_SERIES] == "EQ"].copy()

        if df.empty:
            print(f"  ⚠  0 EQ rows — skipping")
            skipped_holiday += 1
            continue

        rows = []
        for _, row in df.iterrows():
            sym   = str(row.get(COL_SYMBOL, "") or "").strip().upper()
            close = to_float(row.get(COL_CLOSE))
            if not sym or not close or close <= 0:
                continue
            rows.append({
                "symbol":         sym,
                "date":           iso,
                "name":           str(row.get(COL_NAME, "") or "").strip() or None,
                "close":          close,
                "prev_close":     to_float(row.get(COL_PREV)),
                "open":           to_float(row.get(COL_OPEN)),
                "high":           to_float(row.get(COL_HIGH)),
                "low":            to_float(row.get(COL_LOW)),
                "volume":         int(to_float(row.get(COL_VOL)) or 0) or None,
                "isin":           str(row.get(COL_ISIN, "") or "").strip() or None,
                "index_priority": index_priority(sym),
            })

        if not rows:
            print(f"  ⚠  No valid EQ rows after filter — skipping")
            skipped_holiday += 1
            continue

        try:
            batch_upsert(supabase, "price_history", rows, "symbol,date")
            print(f"  ✓  {len(rows)} EQ rows upserted for {iso}")
            filled += 1
        except Exception as e:
            print(f"  ✗  DB error: {e}")
            errors += 1

        # Polite delay between requests to avoid hammering NSE
        time.sleep(2)

    print(f"\n{'─'*55}")
    print(f"Backfill complete.")
    print(f"  Filled     : {filled} days")
    print(f"  Skipped (already in DB)  : {skipped_existing}")
    print(f"  Skipped (holiday/no data): {skipped_holiday}")
    print(f"  Errors     : {errors}")

    if errors > 0:
        sys.exit(1)

if __name__ == "__main__":
    main()
