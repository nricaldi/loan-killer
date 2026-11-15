import { describe, expect, it } from 'vitest'
import { currentLoan } from './currentLoan'

describe('current loan forecast', () => {
  it('uses today without inventing transactions and preserves monthly payment day', () => {
    const loan = { balanceDate: '2025-01-01', nextPaymentDate: '2025-01-31', principalCents: 100_000, accruedInterestCents: 2500 }
    expect(currentLoan(loan, '2025-03-15')).toEqual({ ...loan, balanceDate: '2025-03-15', nextPaymentDate: '2025-03-31' })
    expect(loan.balanceDate).toBe('2025-01-01')
  })
  it('clamps month ends without losing the original payment day', () => {
    expect(currentLoan({ nextPaymentDate: '2024-01-31' }, '2024-02-15').nextPaymentDate).toBe('2024-02-29')
    expect(currentLoan({ nextPaymentDate: '2024-01-31' }, '2024-03-01').nextPaymentDate).toBe('2024-03-31')
  })
  it('keeps payments due today and future payment dates', () => {
    expect(currentLoan({ nextPaymentDate: '2025-03-15' }, '2025-03-15').nextPaymentDate).toBe('2025-03-15')
    expect(currentLoan({ nextPaymentDate: '2026-01-01' }, '2025-03-15').nextPaymentDate).toBe('2026-01-01')
  })
})
