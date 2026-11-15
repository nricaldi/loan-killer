import { describe, expect, it } from 'vitest'
import { payoffToday } from './payoffToday'
import type { LoanRecord } from './portfolio'

const loan: LoanRecord = { id: 'a', name: 'A', type: 'unsubsidized', fromExample: false, principalCents: 100000, accruedInterestCents: 2500, annualRatePercent: 6, monthlyPaymentCents: 1000, balanceDate: '2025-01-01', nextPaymentDate: '2025-02-01' }

describe('full payoff today', () => {
  it('allocates the exact sum across all loans and clears every balance on the payment date', () => {
    const loans = [loan, { ...loan, id: 'b', name: 'B', principalCents: 50000, annualRatePercent: 12, nextPaymentDate: '2025-02-20' }]
    const saved = structuredClone(loans)
    const quote = payoffToday(loans, '2025-01-15')
    expect(quote.allocations.map(item => item.amountCents)).toEqual([102730, 52730])
    expect(quote.totalCents).toBe(155460)
    expect(quote.portfolio.projection.status).toBe('paid-off')
    expect(quote.portfolio.projection.schedule.at(-1)?.balanceCents).toBe(0)
    expect(quote.portfolio.projection.schedule).toHaveLength(1)
    expect(quote.portfolio.projection.schedule[0]?.paymentCents).toBe(quote.totalCents)
    expect(loans).toEqual(saved)
  })

  it('handles interest-only and zero-rate balances without double counting', () => {
    const quote = payoffToday([{ ...loan, principalCents: 0 }, { ...loan, id: 'b', annualRatePercent: 0 }], '2025-01-15')
    expect(quote.totalCents).toBe(105000)
  })
  it('accepts independently dated balance snapshots', () => {
    expect(payoffToday([loan, { ...loan, id: 'b', balanceDate: '2025-01-02' }], '2025-01-15').portfolio.projection.status).toBe('paid-off')
  })

})
