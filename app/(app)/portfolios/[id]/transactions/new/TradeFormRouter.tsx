'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'

interface FormProps { portfolioId: string }

const EquityTradeForm      = dynamic<FormProps>(() => import('@/components/trade-forms/EquityTradeForm'))
const MutualFundTradeForm  = dynamic<FormProps>(() => import('@/components/trade-forms/MutualFundTradeForm'))
const CommodityTradeForm   = dynamic<FormProps>(() => import('@/components/trade-forms/CommodityTradeForm'))
const FixedIncomeTradeForm = dynamic<FormProps>(() => import('@/components/trade-forms/FixedIncomeTradeForm'))
const RealEstateTradeForm  = dynamic<FormProps>(() => import('@/components/trade-forms/RealEstateTradeForm'))

// Suppress unused import warning
type _Unused = ComponentType

export default function TradeFormRouter({
  portfolioId,
  assetClass,
}: {
  portfolioId: string
  assetClass: string
}) {
  if (assetClass === 'MUTUAL_FUND')  return <MutualFundTradeForm  portfolioId={portfolioId} />
  if (assetClass === 'COMMODITY')    return <CommodityTradeForm   portfolioId={portfolioId} />
  if (assetClass === 'FIXED_INCOME') return <FixedIncomeTradeForm portfolioId={portfolioId} />
  if (assetClass === 'REAL_ESTATE')  return <RealEstateTradeForm  portfolioId={portfolioId} />
  return <EquityTradeForm portfolioId={portfolioId} />
}
