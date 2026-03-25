/** Shared asset class metadata used across Dashboard, Asset Classes list, Holdings, and Onboarding. */

export const ASSET_CLASS_ICONS: Record<string, string> = {
  EQUITY:       '💹',   // Trending chart — stocks, ETFs, mutual funds
  COMMODITY:    '🪙',   // Coin — gold, silver, oil
  FIXED_INCOME: '📑',   // Document — bonds, FDs, debentures
  REAL_ESTATE:  '🏢',   // Building — property, REITs
}

export const ASSET_CLASS_LABELS: Record<string, string> = {
  EQUITY:       'Stocks & ETFs',
  COMMODITY:    'Commodities',
  FIXED_INCOME: 'Fixed Income',
  REAL_ESTATE:  'Real Estate',
}

export const ASSET_CLASS_LIST = [
  { id: 'EQUITY',       icon: ASSET_CLASS_ICONS.EQUITY,       label: ASSET_CLASS_LABELS.EQUITY,       desc: 'NSE / BSE listed shares, mutual funds, ETFs' },
  { id: 'COMMODITY',    icon: ASSET_CLASS_ICONS.COMMODITY,    label: ASSET_CLASS_LABELS.COMMODITY,    desc: 'Gold, Silver, Oil — physical or via ETF' },
  { id: 'FIXED_INCOME', icon: ASSET_CLASS_ICONS.FIXED_INCOME, label: ASSET_CLASS_LABELS.FIXED_INCOME, desc: 'Fixed Deposits, Bonds, PPF, NSC, Debentures' },
  { id: 'REAL_ESTATE',  icon: ASSET_CLASS_ICONS.REAL_ESTATE,  label: ASSET_CLASS_LABELS.REAL_ESTATE,  desc: 'Property: residential, commercial, REITs' },
]
