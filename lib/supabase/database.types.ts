export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─── Enum types ───────────────────────────────────────────
export type AccountTransactionType =
  | 'DEPOSIT' | 'REMOVAL'
  | 'INTEREST' | 'INTEREST_CHARGE'
  | 'DIVIDENDS'
  | 'FEES' | 'FEES_REFUND'
  | 'TAXES' | 'TAX_REFUND'
  | 'BUY' | 'SELL'
  | 'TRANSFER_IN' | 'TRANSFER_OUT'

export type PortfolioTransactionType =
  | 'BUY' | 'SELL'
  | 'TRANSFER_IN' | 'TRANSFER_OUT'
  | 'DELIVERY_INBOUND' | 'DELIVERY_OUTBOUND'

export type UnitType = 'GROSS_VALUE' | 'TAX' | 'FEE'

// ─── Row types ────────────────────────────────────────────
export type Security = {
  id: string; user_id: string; name: string; currency_code: string
  target_currency_code: string | null; isin: string | null; ticker_symbol: string | null
  wkn: string | null; note: string | null; feed: string | null; feed_url: string | null
  latest_feed: string | null; latest_feed_url: string | null; is_retired: boolean
  calendar: string | null; updated_at: string; created_at: string
}
export type Account = {
  id: string; user_id: string; name: string; currency_code: string
  note: string | null; is_retired: boolean; updated_at: string; created_at: string
}
export type Portfolio = {
  id: string; user_id: string; name: string; note: string | null
  is_retired: boolean; reference_account_id: string | null; updated_at: string; created_at: string
}
export type AccountTransaction = {
  id: string; account_id: string; type: AccountTransactionType; date: string
  currency_code: string; amount: number; shares: number; security_id: string | null
  note: string | null; source: string | null; ex_date: string | null
  cross_portfolio_transaction_id: string | null; updated_at: string; created_at: string
}
export type PortfolioTransaction = {
  id: string; portfolio_id: string; type: PortfolioTransactionType; date: string
  currency_code: string; amount: number; shares: number; security_id: string
  note: string | null; source: string | null; cross_account_transaction_id: string | null
  updated_at: string; created_at: string
}
export type SecurityPrice = { id: number; security_id: string; date: string; value: number }
export type SecurityLatestPrice = {
  security_id: string; date: string; value: number
  high: number | null; low: number | null; volume: number | null; previous_close: number | null
}
export type SecurityEvent = {
  id: string; security_id: string; date: string; type: string; details: Json; created_at: string
}
export type Watchlist = { id: string; user_id: string; name: string; sort_order: number; created_at: string }
export type InvestmentPlan = {
  id: string; user_id: string; name: string; security_id: string | null
  portfolio_id: string | null; account_id: string | null; currency_code: string
  amount: number; fees: number; auto_generate: boolean; plan_type: string; interval: string
  start_date: string; end_date: string | null; note: string | null; updated_at: string; created_at: string
}
export type Taxonomy = { id: string; user_id: string; name: string; sort_order: number; created_at: string }
export type Classification = {
  id: string; taxonomy_id: string; parent_id: string | null; name: string
  color: string; sort_order: number; note: string | null; created_at: string
}
export type TransactionUnit = {
  id: string; transaction_id: string; type: UnitType; amount: number; currency_code: string
  forex_amount: number | null; forex_currency_code: string | null; exchange_rate: number | null
}
export type UserSettings = { user_id: string; base_currency: string; created_at: string; updated_at: string }
export type WatchlistSecurity = { watchlist_id: string; security_id: string; sort_order: number }
export type ClassificationAssignment = {
  id: string; classification_id: string; investment_vehicle_type: string; investment_vehicle_id: string; weight: number
}

// ─── Supabase Database type (v2.99+ format with PostgrestVersion) ─────────────
export type Database = {
  public: {
    PostgrestVersion: "12"
    Tables: {
      user_settings: {
        Row: UserSettings
        Insert: { user_id: string; base_currency?: string }
        Update: { base_currency?: string }
        Relationships: []
      }
      securities: {
        Row: Security
        Insert: { id?: string; user_id: string; name: string; currency_code: string; target_currency_code?: string | null; isin?: string | null; ticker_symbol?: string | null; wkn?: string | null; note?: string | null; feed?: string | null; feed_url?: string | null; latest_feed?: string | null; latest_feed_url?: string | null; is_retired?: boolean; calendar?: string | null }
        Update: { name?: string; currency_code?: string; target_currency_code?: string | null; isin?: string | null; ticker_symbol?: string | null; wkn?: string | null; note?: string | null; feed?: string | null; feed_url?: string | null; latest_feed?: string | null; latest_feed_url?: string | null; is_retired?: boolean; calendar?: string | null }
        Relationships: []
      }
      security_prices: {
        Row: SecurityPrice
        Insert: { id?: number; security_id: string; date: string; value: number }
        Update: { value?: number }
        Relationships: [{ foreignKeyName: 'security_prices_security_id_fkey'; columns: ['security_id']; isOneToOne: false; referencedRelation: 'securities'; referencedColumns: ['id'] }]
      }
      security_latest_prices: {
        Row: SecurityLatestPrice
        Insert: SecurityLatestPrice
        Update: Partial<SecurityLatestPrice>
        Relationships: []
      }
      security_events: {
        Row: SecurityEvent
        Insert: { id?: string; security_id: string; date: string; type: string; details?: Json }
        Update: { date?: string; type?: string; details?: Json }
        Relationships: []
      }
      accounts: {
        Row: Account
        Insert: { id?: string; user_id: string; name: string; currency_code: string; note?: string | null; is_retired?: boolean }
        Update: { name?: string; currency_code?: string; note?: string | null; is_retired?: boolean }
        Relationships: []
      }
      portfolios: {
        Row: Portfolio
        Insert: { id?: string; user_id: string; name: string; note?: string | null; is_retired?: boolean; reference_account_id?: string | null }
        Update: { name?: string; note?: string | null; is_retired?: boolean; reference_account_id?: string | null }
        Relationships: []
      }
      account_transactions: {
        Row: AccountTransaction
        Insert: { id?: string; account_id: string; type: AccountTransactionType; date: string; currency_code: string; amount: number; shares?: number; security_id?: string | null; note?: string | null; source?: string | null; ex_date?: string | null; cross_portfolio_transaction_id?: string | null }
        Update: { type?: AccountTransactionType; date?: string; currency_code?: string; amount?: number; shares?: number; security_id?: string | null; note?: string | null }
        Relationships: []
      }
      account_transaction_units: {
        Row: TransactionUnit
        Insert: { id?: string; transaction_id: string; type: UnitType; amount: number; currency_code: string; forex_amount?: number | null; forex_currency_code?: string | null; exchange_rate?: number | null }
        Update: { amount?: number; forex_amount?: number | null; exchange_rate?: number | null }
        Relationships: []
      }
      portfolio_transactions: {
        Row: PortfolioTransaction
        Insert: { id?: string; portfolio_id: string; type: PortfolioTransactionType; date: string; currency_code: string; amount: number; shares: number; security_id: string; note?: string | null; source?: string | null; cross_account_transaction_id?: string | null }
        Update: { type?: PortfolioTransactionType; date?: string; currency_code?: string; amount?: number; shares?: number; note?: string | null }
        Relationships: []
      }
      portfolio_transaction_units: {
        Row: TransactionUnit
        Insert: { id?: string; transaction_id: string; type: UnitType; amount: number; currency_code: string; forex_amount?: number | null; forex_currency_code?: string | null; exchange_rate?: number | null }
        Update: { amount?: number; forex_amount?: number | null; exchange_rate?: number | null }
        Relationships: []
      }
      watchlists: {
        Row: Watchlist
        Insert: { id?: string; user_id: string; name: string; sort_order?: number }
        Update: { name?: string; sort_order?: number }
        Relationships: []
      }
      watchlist_securities: {
        Row: WatchlistSecurity
        Insert: { watchlist_id: string; security_id: string; sort_order?: number }
        Update: { sort_order?: number }
        Relationships: []
      }
      investment_plans: {
        Row: InvestmentPlan
        Insert: { id?: string; user_id: string; name: string; security_id?: string | null; portfolio_id?: string | null; account_id?: string | null; currency_code: string; amount: number; fees?: number; auto_generate?: boolean; plan_type: string; interval: string; start_date: string; end_date?: string | null; note?: string | null }
        Update: { name?: string; amount?: number; fees?: number; auto_generate?: boolean; interval?: string; end_date?: string | null; note?: string | null }
        Relationships: []
      }
      taxonomies: {
        Row: Taxonomy
        Insert: { id?: string; user_id: string; name: string; sort_order?: number }
        Update: { name?: string; sort_order?: number }
        Relationships: []
      }
      classifications: {
        Row: Classification
        Insert: { id?: string; taxonomy_id: string; parent_id?: string | null; name: string; color?: string; sort_order?: number; note?: string | null }
        Update: { parent_id?: string | null; name?: string; color?: string; sort_order?: number; note?: string | null }
        Relationships: []
      }
      classification_assignments: {
        Row: ClassificationAssignment
        Insert: { id?: string; classification_id: string; investment_vehicle_type: string; investment_vehicle_id: string; weight?: number }
        Update: { weight?: number }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
