import { describe, expect, it } from 'vitest'
import { suggestMonthlyPayment } from './paymentSuggestion'
import { projectLoan, type Loan } from './loan'
import { addMonths } from './dates'
const loan: Loan = { name: 'Loan 1', type: 'unsubsidized', principalCents: 761500, accruedInterestCents: 0, annualRatePercent: 6.3, monthlyPaymentCents: 500, balanceDate: '2026-11-13', nextPaymentDate: '2026-12-11' }

describe('actionable payment suggestion', () => {
  it('suggests a whole-dollar amount verified to pay off the screenshot loan within ten calendar years', () => {
    const suggestion = suggestMonthlyPayment(loan)!
    expect(suggestion.tenYear).toBe(true)
    expect(suggestion.amountCents % 100).toBe(0)
    const result = projectLoan({ ...loan, monthlyPaymentCents: suggestion.amountCents })
    expect(result.status).toBe('paid-off')
    if (result.status === 'paid-off') expect(result.payoffDate <= addMonths(loan.balanceDate, 120)).toBe(true)
    const lower = projectLoan({ ...loan, monthlyPaymentCents: suggestion.amountCents - 100 })
    expect(lower.status !== 'paid-off' || lower.payoffDate > addMonths(loan.balanceDate, 120)).toBe(true)
  })
  it('accounts for unpaid interest, rate, dates, and per-payment rounding', () => {
    for (const record of [
      { ...loan, accruedInterestCents: 100000 },
      { ...loan, annualRatePercent: 0 },
      { ...loan, balanceDate: '2024-02-29', nextPaymentDate: '2024-03-31' },
      { ...loan, principalCents: 0, accruedInterestCents: 50000 },
    ]) {
      const suggestion = suggestMonthlyPayment(record)!
      const result = projectLoan({ ...record, monthlyPaymentCents: suggestion.amountCents })
      expect(result.status).toBe('paid-off')
      if (result.status === 'paid-off') expect(result.payoffDate <= addMonths(record.balanceDate, 120)).toBe(true)
    }
  })
  it('does not call a payment a ten-year plan when the first due date is later than that', () => {
    const suggestion = suggestMonthlyPayment({ ...loan, nextPaymentDate: '2040-01-01' })!
    expect(suggestion.tenYear).toBe(false)
    expect(projectLoan({ ...loan, nextPaymentDate: '2040-01-01', monthlyPaymentCents: suggestion.amountCents }).status).toBe('paid-off')
  })
  it('keeps the goal independent of the current minimum and never changes the input loan', () => {
    const before = { ...loan }
    expect(suggestMonthlyPayment({ ...loan, monthlyPaymentCents: 2500 })).toEqual(suggestMonthlyPayment(loan))
    expect(loan).toEqual(before)
  })
})
