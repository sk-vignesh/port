#!/usr/bin/env python3
"""
Zerodha Kite Portfolio Sync — Multi-User
==========================================
Reads all users' Zerodha access_tokens from `user_integrations`
and syncs each user's holdings and trades to Supabase.

Access tokens expire daily at 06:00 IST — if a user's token is stale
the script warns and skips them. They need to reconnect via Settings.

Env vars (GitHub Secrets — app-level, not per-user):
  ZERODHA_API_KEY           — Kite Connect app API key
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""

import os
import sys
from datetime import date, datetime, timezone, timedelta

from kiteconnect import KiteConnect
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────
ZERODHA_API_KEY = os.environ.get("ZERODHA_API_KEY", "")
SUPABASE_URL    = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY    = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

PORTFOLIO_NAME = "Zerodha"
CURRENCY       = "INR"
PRICE_SCALE    = 100
SHARE_SCALE    = 100_000_000

# Kite tokens expire at 06:00 IST = 00:30 UTC
IST            = timezone(timedelta(hours=5, minutes=30))


# ── Helpers ───────────────────────────────────────────────────────────────────

def to_paise(rupees) -> int:
    return int(round(float(rupees or 0) * PRICE_SCALE))

def to_share_units(qty) -> int:
    return int(round(float(qty or 0) * SHARE_SCALE))

def is_token_fresh(token_date_iso: str | None) -> bool:
    """True if the token was generated after today's 06:00 IST."""
    if not token_date_iso:
        return False
    try:
        generated = datetime.fromisoformat(token_date_iso).astimezone(IST)
        cutoff = datetime.now(IST).replace(hour=6, minute=0, second=0, microsecond=0)
        if datetime.now(IST).hour < 6:
            cutoff -= timedelta(days=1)
        return generated >= cutoff
    except Exception:
        return False


# ── Supabase helpers ──────────────────────────────────────────────────────────

def find_or_create_portfolio(supabase, user_id: str) -> str:
    r = supabase.table("portfolios").select("id") \
        .eq("user_id", user_id).eq("name", PORTFOLIO_NAME).execute()
    if r.data: return r.data[0]["id"]
    ins = supabase.table("portfolios").insert({
        "user_id": user_id, "name": PORTFOLIO_NAME,
        "is_retired": False, "note": "Auto-created by Zerodha Kite sync",
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
    print(f"      + Created security: {name or symbol}")
    return ins.data[0]["id"]


# ── Per-user sync ─────────────────────────────────────────────────────────────

def sync_user(supabase, user_id: str, access_token: str, meta: dict):
    kite = KiteConnect(api_key=ZERODHA_API_KEY)
    kite.set_access_token(access_token)

    portfolio_id = find_or_create_portfolio(supabase, user_id)
    new_h = new_t = 0

    # ── Holdings ──────────────────────────────────────────────────────────────
    try:
        holdings = kite.holdings()
    except Exception as e:
        print(f"    ✗ Holdings fetch failed: {e}")
        holdings = []

    print(f"    Holdings: {len(holdings)}")
    for h in holdings:
        symbol = (h.get("tradingsymbol") or "").strip().upper()
        isin   = (h.get("isin") or "").strip().upper()
        qty    = float(h.get("quantity") or 0)
        avg_px = float(h.get("average_price") or 0)
        ltp    = float(h.get("last_price") or 0)
        name   = h.get("exchange_token") or symbol   # Kite doesn't expose company name directly
        if not symbol or qty <= 0: continue

        sec_id = find_or_create_security(supabase, user_id, symbol, isin, name)

        if ltp > 0:
            supabase.table("security_latest_prices").upsert(
                {"security_id": sec_id, "value": to_paise(ltp)},
                on_conflict="security_id"
            ).execute()

        idem = f"zerodha:holding:{isin or symbol}"
        exists = supabase.table("portfolio_transactions").select("id") \
            .eq("portfolio_id", portfolio_id).eq("security_id", sec_id).eq("note", idem).execute()
        if not exists.data:
            supabase.table("portfolio_transactions").insert({
                "portfolio_id": portfolio_id, "security_id": sec_id,
                "type": "DELIVERY_INBOUND", "date": date.today().isoformat(),
                "currency_code": CURRENCY,
                "shares": to_share_units(qty), "amount": to_paise(qty * avg_px),
                "note": idem, "source": "zerodha",
            }).execute()
            new_h += 1

    # ── Trades ────────────────────────────────────────────────────────────────
    try:
        trades = kite.trades()
    except Exception as e:
        print(f"    ⚠  Trades fetch failed: {e}")
        trades = []

    print(f"    Trades:   {len(trades)}")
    for t in trades:
        order_id = str(t.get("order_id") or "").strip()
        symbol   = (t.get("tradingsymbol") or "").strip().upper()
        isin     = (t.get("isin") or "").strip().upper()
        qty      = float(t.get("quantity") or 0)
        price    = float(t.get("average_price") or t.get("price") or 0)
        tx_type  = (t.get("transaction_type") or "BUY").upper()
        trade_dt = t.get("fill_timestamp") or t.get("order_timestamp") or date.today().isoformat()
        if not symbol or qty <= 0 or not order_id: continue

        idem = f"zerodha:trade:{order_id}"
        exists = supabase.table("portfolio_transactions").select("id") \
            .eq("portfolio_id", portfolio_id).eq("note", idem).execute()
        if exists.data: continue

        sec_id = find_or_create_security(supabase, user_id, symbol, isin, symbol)
        supabase.table("portfolio_transactions").insert({
            "portfolio_id": portfolio_id, "security_id": sec_id,
            "type": "BUY" if tx_type == "BUY" else "SELL",
            "date": str(trade_dt)[:10],
            "currency_code": CURRENCY,
            "shares": to_share_units(qty), "amount": to_paise(qty * price),
            "note": idem, "source": "zerodha",
        }).execute()
        new_t += 1

    # Update last_synced_at
    supabase.table("user_integrations") \
        .update({"last_synced_at": datetime.utcnow().isoformat()}) \
        .eq("user_id", user_id).eq("integration_name", "zerodha").execute()

    print(f"    ✓ +{new_h} holding tx  +{new_t} trade tx")
    return True


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not ZERODHA_API_KEY or not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: ZERODHA_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY must be set.")
        sys.exit(1)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    res = supabase.table("user_integrations") \
        .select("user_id, api_key, meta") \
        .eq("integration_name", "zerodha").execute()

    integrations = res.data or []
    print(f"Zerodha sync — {len(integrations)} user(s) connected\n")

    ok = stale = fail = 0
    for row in integrations:
        user_id      = row["user_id"]
        access_token = row.get("api_key", "")
        meta         = row.get("meta") or {}
        token_date   = meta.get("token_date")
        kite_name    = meta.get("kite_user_name", user_id[:8])

        print(f"  {kite_name}  (user {user_id[:8]}…)")

        if not access_token:
            print(f"    ⚠  No access token — user must reconnect via Settings")
            stale += 1
            continue

        if not is_token_fresh(token_date):
            print(f"    ⚠  Token expired (generated {token_date}) — user must reconnect via Settings")
            stale += 1
            continue

        try:
            sync_user(supabase, user_id, access_token, meta)
            ok += 1
        except Exception as e:
            print(f"    ✗ Error: {e}")
            fail += 1

    print(f"\n✅ Zerodha sync — {ok} synced  {stale} stale tokens  {fail} errors")
    if stale:
        print(f"   Users with stale tokens need to reconnect: Settings → Zerodha → Connect")


if __name__ == "__main__":
    main()
