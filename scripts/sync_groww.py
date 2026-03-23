#!/usr/bin/env python3
"""
Groww Portfolio Sync
====================
Fetches current equity holdings and recent trades from Groww Trading API
and syncs them to Supabase:

  1.  Ensures a "Groww" portfolio exists (creating it if needed).
  2.  For every holding:
        - Finds or creates the security (matched by ISIN, then ticker).
        - Updates security_latest_prices with LTP from Groww.
        - Records a DELIVERY_INBOUND transaction (idempotent via note field).
  3.  For every trade in the trade-book not yet in Supabase:
        - Records a BUY or SELL portfolio_transaction (idempotent via Groww order ID).

Env vars required (set as GitHub Secrets):
  GROWW_API_KEY            -- TOTP token from Groww Cloud API Keys page
  GROWW_API_SECRET         -- TOTP secret (used to generate time-based OTP)
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
import time
from datetime import date, datetime, timezone

import pyotp
from growwapi import GrowwAPI
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────
GROWW_API_KEY    = os.environ.get("GROWW_API_KEY", "")
GROWW_API_SECRET = os.environ.get("GROWW_API_SECRET", "")
SUPABASE_URL     = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY     = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

PORTFOLIO_NAME   = "Groww"
CURRENCY         = "INR"

# Scaling factors matching the DB schema
PRICE_SCALE      = 100           # amounts stored as paise  (×100)
SHARE_SCALE      = 100_000_000   # shares  stored as ×10^8


# ── Helpers ───────────────────────────────────────────────────────────────────

def to_paise(rupees) -> int:
    """Convert rupees (float) to paise (int) for DB storage."""
    return int(round(float(rupees or 0) * PRICE_SCALE))

def to_share_units(qty) -> int:
    """Convert human share count to DB units (×10^8)."""
    return int(round(float(qty or 0) * SHARE_SCALE))

def iso_date(dt) -> str:
    """Return ISO-8601 date string from a date, datetime, or string."""
    if isinstance(dt, (date, datetime)):
        return dt.isoformat()
    if dt:
        return str(dt)[:10]
    return date.today().isoformat()

def extract_holdings(resp) -> list:
    """Normalise the Groww holdings response to a flat list."""
    if isinstance(resp, list):
        return resp
    if isinstance(resp, dict):
        for key in ("holdingList", "holdings", "data"):
            val = resp.get(key)
            if isinstance(val, list):
                return val
            if isinstance(val, dict):
                for k2 in ("holdingList", "holdings"):
                    v2 = val.get(k2)
                    if isinstance(v2, list):
                        return v2
    return []

def extract_trades(resp) -> list:
    """Normalise the Groww trade-book response to a flat list."""
    if isinstance(resp, list):
        return resp
    if isinstance(resp, dict):
        for key in ("tradeList", "trades", "data"):
            val = resp.get(key)
            if isinstance(val, list):
                return val
            if isinstance(val, dict):
                for k2 in ("tradeList", "trades"):
                    v2 = val.get(k2)
                    if isinstance(v2, list):
                        return v2
    return []


# ── Groww auth ────────────────────────────────────────────────────────────────

def connect_groww() -> GrowwAPI:
    """Authenticate using TOTP flow (no daily approval needed)."""
    totp = pyotp.TOTP(GROWW_API_SECRET).now()
    token = GrowwAPI.get_access_token(api_key=GROWW_API_KEY, totp=totp)
    return GrowwAPI(token)


# ── Supabase helpers ──────────────────────────────────────────────────────────

def get_user_id(supabase) -> str:
    """Return the first authenticated user's ID (single-tenant app)."""
    result = supabase.auth.admin.list_users()
    users = result.users if hasattr(result, "users") else result
    if not users:
        raise RuntimeError("No users found in Supabase — has someone signed up yet?")
    return users[0].id


def find_or_create_portfolio(supabase, user_id: str) -> str:
    res = supabase.table("portfolios") \
        .select("id") \
        .eq("user_id", user_id) \
        .eq("name", PORTFOLIO_NAME) \
        .execute()
    if res.data:
        return res.data[0]["id"]
    ins = supabase.table("portfolios").insert({
        "user_id":    user_id,
        "name":       PORTFOLIO_NAME,
        "is_retired": False,
        "note":       "Auto-created by Groww sync workflow",
    }).execute()
    pid = ins.data[0]["id"]
    print(f"  → Created Groww portfolio (id={pid})")
    return pid


def find_or_create_security(supabase, user_id: str, symbol: str, isin: str, name: str) -> str:
    # 1. Match by ISIN
    if isin:
        res = supabase.table("securities") \
            .select("id") \
            .eq("user_id", user_id) \
            .eq("isin", isin) \
            .execute()
        if res.data:
            return res.data[0]["id"]
    # 2. Match by ticker
    if symbol:
        res = supabase.table("securities") \
            .select("id") \
            .eq("user_id", user_id) \
            .eq("ticker_symbol", symbol) \
            .execute()
        if res.data:
            return res.data[0]["id"]
    # 3. Create new
    ins = supabase.table("securities").insert({
        "user_id":       user_id,
        "name":          name or symbol,
        "ticker_symbol": symbol,
        "isin":          isin or None,
        "currency_code": CURRENCY,
        "is_retired":    False,
    }).execute()
    sec_id = ins.data[0]["id"]
    print(f"      → Created security: {name or symbol} ({symbol})")
    return sec_id


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not all([GROWW_API_KEY, GROWW_API_SECRET, SUPABASE_URL, SUPABASE_KEY]):
        print("ERROR: Set GROWW_API_KEY, GROWW_API_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.")
        sys.exit(1)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("Authenticating with Groww...")
    try:
        groww = connect_groww()
        print("  ✓ Connected")
    except Exception as exc:
        print(f"  ERROR: Groww auth failed — {exc}")
        sys.exit(1)

    user_id      = get_user_id(supabase)
    portfolio_id = find_or_create_portfolio(supabase, user_id)
    print(f"  Portfolio: {PORTFOLIO_NAME}  (user={user_id[:8]}…)\n")

    # ── Step 1: Holdings ──────────────────────────────────────────────────────
    print("Fetching holdings from Groww...")
    holdings_raw = groww.get_holdings_for_user()
    holdings     = extract_holdings(holdings_raw)
    print(f"  {len(holdings)} holding(s) found\n")

    synced_holdings = 0
    for h in holdings:
        symbol  = (h.get("tradingSymbol") or h.get("trading_symbol") or "").strip().upper()
        isin    = (h.get("isin") or "").strip().upper()
        qty     = float(h.get("quantity") or h.get("availableQuantity") or 0)
        avg_px  = float(h.get("averagePrice") or h.get("average_price") or 0)
        ltp     = float(h.get("ltp") or h.get("lastTradedPrice") or 0)
        name    = (h.get("companyName") or h.get("company_name") or symbol)

        if not symbol or qty <= 0:
            continue

        print(f"  {symbol:<15} {qty:>8.2f} shares  avg ₹{avg_px:,.2f}  ltp ₹{ltp:,.2f}")

        sec_id = find_or_create_security(supabase, user_id, symbol, isin, name)

        # Update latest market price
        if ltp > 0:
            supabase.table("security_latest_prices").upsert(
                {"security_id": sec_id, "value": to_paise(ltp)},
                on_conflict="security_id"
            ).execute()

        # Idempotent holding record — one per (portfolio, security) from Groww
        idem = f"groww:holding:{isin or symbol}"
        existing = supabase.table("portfolio_transactions") \
            .select("id") \
            .eq("portfolio_id", portfolio_id) \
            .eq("security_id", sec_id) \
            .eq("note", idem) \
            .execute()

        if not existing.data:
            supabase.table("portfolio_transactions").insert({
                "portfolio_id": portfolio_id,
                "security_id":  sec_id,
                "type":         "DELIVERY_INBOUND",
                "date":         date.today().isoformat(),
                "currency_code":CURRENCY,
                "shares":       to_share_units(qty),
                "amount":       to_paise(qty * avg_px),
                "note":         idem,
                "source":       "groww",
            }).execute()
            synced_holdings += 1
            print(f"      → Recorded holding ({qty:.0f} shares @ ₹{avg_px:.2f})")

    print(f"\n  Holdings processed: {len(holdings)}  new transactions: {synced_holdings}\n")

    # ── Step 2: Trade book ────────────────────────────────────────────────────
    print("Fetching trade book from Groww...")
    try:
        trades_raw = groww.get_trade_book()
        trades     = extract_trades(trades_raw)
    except Exception as exc:
        print(f"  ⚠  Trade book unavailable ({exc}) — skipping")
        trades = []

    print(f"  {len(trades)} trade(s) found\n")

    synced_trades = 0
    for t in trades:
        order_id  = (t.get("orderId") or t.get("order_id") or "").strip()
        symbol    = (t.get("tradingSymbol") or t.get("trading_symbol") or "").strip().upper()
        isin      = (t.get("isin") or "").strip().upper()
        qty       = float(t.get("tradedQuantity") or t.get("quantity") or 0)
        price     = float(t.get("tradedPrice") or t.get("price") or 0)
        tx_type   = (t.get("transactionType") or t.get("transaction_type") or "BUY").upper()
        trade_dt  = t.get("updateTime") or t.get("orderTime") or date.today().isoformat()

        if not symbol or qty <= 0 or not order_id:
            continue

        # Map Groww tx type to our schema
        mapped = "BUY" if tx_type in ("BUY", "B") else "SELL"

        # Idempotency key
        idem = f"groww:trade:{order_id}"
        existing = supabase.table("portfolio_transactions") \
            .select("id") \
            .eq("portfolio_id", portfolio_id) \
            .eq("note", idem) \
            .execute()

        if existing.data:
            continue

        sec_id = find_or_create_security(supabase, user_id, symbol, isin, symbol)

        supabase.table("portfolio_transactions").insert({
            "portfolio_id": portfolio_id,
            "security_id":  sec_id,
            "type":         mapped,
            "date":         iso_date(trade_dt),
            "currency_code":CURRENCY,
            "shares":       to_share_units(qty),
            "amount":       to_paise(qty * price),
            "note":         idem,
            "source":       "groww",
        }).execute()
        synced_trades += 1
        print(f"  {mapped:<4} {symbol:<12} {qty:>8.2f} shares @ ₹{price:,.2f}  (order {order_id[:12]}…)")

    print(f"\n  Trades synced: {synced_trades}\n")
    print("✅ Groww sync complete.")


if __name__ == "__main__":
    main()
