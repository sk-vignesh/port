#!/usr/bin/env python3
"""
Groww Portfolio Sync — Multi-User
===================================
Reads ALL users' Groww credentials from the `user_integrations` table
(service-role access) and syncs each user's portfolio independently.

No Groww credentials are stored in GitHub Secrets.
Only SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.

For each user with a Groww integration:
  1. Authenticates with Groww via TOTP flow.
  2. Fetches holdings → creates/updates securities → updates latest prices.
  3. Inserts DELIVERY_INBOUND transactions for holdings (idempotent).
  4. Fetches trade book → inserts BUY/SELL transactions (idempotent via order ID).
"""

import os
import sys
from datetime import date, datetime

import pyotp
from growwapi import GrowwAPI
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL  = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

PORTFOLIO_NAME = "Groww"
CURRENCY       = "INR"
PRICE_SCALE    = 100
SHARE_SCALE    = 100_000_000


# ── Helpers ───────────────────────────────────────────────────────────────────

def to_paise(rupees) -> int:
    return int(round(float(rupees or 0) * PRICE_SCALE))

def to_share_units(qty) -> int:
    return int(round(float(qty or 0) * SHARE_SCALE))

def iso_date(dt) -> str:
    if isinstance(dt, (date, datetime)):
        return dt.isoformat()
    return str(dt)[:10] if dt else date.today().isoformat()

def extract_list(resp, *keys) -> list:
    """Walk a nested dict/list response looking for the first list value."""
    if isinstance(resp, list):
        return resp
    if isinstance(resp, dict):
        for k in keys:
            v = resp.get(k)
            if isinstance(v, list):
                return v
            if isinstance(v, dict):
                for k2 in keys:
                    v2 = v.get(k2)
                    if isinstance(v2, list):
                        return v2
    return []


def connect_groww(api_key: str, api_secret: str) -> GrowwAPI:
    totp = pyotp.TOTP(api_secret).now()
    token = GrowwAPI.get_access_token(api_key=api_key, totp=totp)
    return GrowwAPI(token)


# ── Supabase per-user helpers ─────────────────────────────────────────────────

def find_or_create_portfolio(supabase, user_id: str) -> str:
    res = supabase.table("portfolios") \
        .select("id").eq("user_id", user_id).eq("name", PORTFOLIO_NAME).execute()
    if res.data:
        return res.data[0]["id"]
    ins = supabase.table("portfolios").insert({
        "user_id": user_id, "name": PORTFOLIO_NAME,
        "is_retired": False, "note": "Auto-created by Groww sync",
    }).execute()
    return ins.data[0]["id"]


def find_or_create_security(supabase, user_id: str, symbol: str, isin: str, name: str) -> str:
    if isin:
        r = supabase.table("securities").select("id").eq("user_id", user_id).eq("isin", isin).execute()
        if r.data: return r.data[0]["id"]
    if symbol:
        r = supabase.table("securities").select("id").eq("user_id", user_id).eq("ticker_symbol", symbol).execute()
        if r.data: return r.data[0]["id"]
    ins = supabase.table("securities").insert({
        "user_id": user_id, "name": name or symbol,
        "ticker_symbol": symbol, "isin": isin or None,
        "currency_code": CURRENCY, "is_retired": False,
    }).execute()
    print(f"      + Security created: {name or symbol}")
    return ins.data[0]["id"]


# ── Per-user sync ─────────────────────────────────────────────────────────────

def sync_user(supabase, user_id: str, api_key: str, api_secret: str):
    print(f"\n  User {user_id[:8]}…")

    try:
        groww = connect_groww(api_key, api_secret)
    except Exception as e:
        print(f"    ✗ Groww auth failed: {e}")
        return False

    portfolio_id = find_or_create_portfolio(supabase, user_id)

    # ── Holdings ──────────────────────────────────────────────────────────────
    try:
        raw = groww.get_holdings_for_user()
        holdings = extract_list(raw, "holdingList", "holdings", "data")
    except Exception as e:
        print(f"    ✗ Could not fetch holdings: {e}")
        holdings = []

    print(f"    Holdings: {len(holdings)}")
    new_h = 0
    for h in holdings:
        symbol = (h.get("tradingSymbol") or h.get("trading_symbol") or "").strip().upper()
        isin   = (h.get("isin") or "").strip().upper()
        qty    = float(h.get("quantity") or h.get("availableQuantity") or 0)
        avg_px = float(h.get("averagePrice") or h.get("average_price") or 0)
        ltp    = float(h.get("ltp") or h.get("lastTradedPrice") or 0)
        name   = h.get("companyName") or h.get("company_name") or symbol
        if not symbol or qty <= 0: continue

        sec_id = find_or_create_security(supabase, user_id, symbol, isin, name)

        if ltp > 0:
            supabase.table("security_latest_prices").upsert(
                {"security_id": sec_id, "value": to_paise(ltp)},
                on_conflict="security_id").execute()

        idem = f"groww:holding:{isin or symbol}"
        exists = supabase.table("portfolio_transactions") \
            .select("id").eq("portfolio_id", portfolio_id) \
            .eq("security_id", sec_id).eq("note", idem).execute()
        if not exists.data:
            supabase.table("portfolio_transactions").insert({
                "portfolio_id": portfolio_id, "security_id": sec_id,
                "type": "DELIVERY_INBOUND", "date": date.today().isoformat(),
                "currency_code": CURRENCY,
                "shares": to_share_units(qty), "amount": to_paise(qty * avg_px),
                "note": idem, "source": "groww",
            }).execute()
            new_h += 1

    # ── Trade book ────────────────────────────────────────────────────────────
    try:
        raw = groww.get_trade_book()
        trades = extract_list(raw, "tradeList", "trades", "data")
    except Exception as e:
        print(f"    ⚠  Trade book unavailable: {e}")
        trades = []

    print(f"    Trades: {len(trades)}")
    new_t = 0
    for t in trades:
        order_id = (t.get("orderId") or t.get("order_id") or "").strip()
        symbol   = (t.get("tradingSymbol") or t.get("trading_symbol") or "").strip().upper()
        isin     = (t.get("isin") or "").strip().upper()
        qty      = float(t.get("tradedQuantity") or t.get("quantity") or 0)
        price    = float(t.get("tradedPrice") or t.get("price") or 0)
        tx_type  = (t.get("transactionType") or t.get("transaction_type") or "BUY").upper()
        trade_dt = t.get("updateTime") or t.get("orderTime") or date.today().isoformat()
        if not symbol or qty <= 0 or not order_id: continue

        idem = f"groww:trade:{order_id}"
        exists = supabase.table("portfolio_transactions") \
            .select("id").eq("portfolio_id", portfolio_id).eq("note", idem).execute()
        if exists.data: continue

        sec_id = find_or_create_security(supabase, user_id, symbol, isin, symbol)
        supabase.table("portfolio_transactions").insert({
            "portfolio_id": portfolio_id, "security_id": sec_id,
            "type": "BUY" if tx_type in ("BUY", "B") else "SELL",
            "date": iso_date(trade_dt), "currency_code": CURRENCY,
            "shares": to_share_units(qty), "amount": to_paise(qty * price),
            "note": idem, "source": "groww",
        }).execute()
        new_t += 1

    # Mark last sync time
    supabase.table("user_integrations") \
        .update({"last_synced_at": datetime.utcnow().isoformat()}) \
        .eq("user_id", user_id).eq("integration_name", "groww").execute()

    print(f"    ✓ +{new_h} holding tx  +{new_t} trades")
    return True


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
        sys.exit(1)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Fetch all users who have connected Groww
    res = supabase.table("user_integrations") \
        .select("user_id, api_key, api_secret") \
        .eq("integration_name", "groww") \
        .execute()

    integrations = res.data or []
    print(f"Groww sync — {len(integrations)} user(s) connected")

    if not integrations:
        print("No users have connected Groww yet. Done.")
        return

    ok = fail = 0
    for row in integrations:
        try:
            success = sync_user(supabase, row["user_id"], row["api_key"], row["api_secret"])
            if success: ok += 1
            else: fail += 1
        except Exception as e:
            print(f"  ✗ Unexpected error for user {row['user_id'][:8]}…: {e}")
            fail += 1

    print(f"\n✅ Sync complete — {ok} succeeded  {fail} failed")


if __name__ == "__main__":
    main()
