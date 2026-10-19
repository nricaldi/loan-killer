import { describe, expect, it } from 'vitest'
import { parseMoney, validateLoanForm, type LoanFormValues } from './loanForm'

const values: LoanFormValues = {
  name: 'Direct Loan 01',
  type: 'unsubsidized',
  principal: '18000.01',
  accruedInterest: '75',
  annualRate: '5.5',
  monthlyPayment: '200',
  balanceDate: '2025-01-01',
  nextPaymentDate: '2025-02-01',
}

describe('money parsing', () => {
  it.each([
    ['0', 0], ['0.01', 1], ['1.1', 110], ['18000.01', 1_800_001], [' 12.34 ', 1_234], ['10000000', 1_000_000_000],
  ])('converts %s to whole cents', (value, cents) => {
    expect(parseMoney(value)).toBe(cents)
  })

  it.each(['', '-1', '1.234', 'Infinity', 'NaN', '1e3', '$100', '1,000', '1.', '.5', '10000000.01'])('rejects ambiguous or invalid money: %s', (value) => {
    expect(parseMoney(value)).toBeNull()
  })
})

describe('loan form validation', () => {
  it('produces a typed loan with exact cents', () => {
    const result = validateLoanForm(values)
    expect(result.errors).toEqual({})
    expect(result.loan).toMatchObject({ principalCents: 1_800_001, accruedInterestCents: 7_500, monthlyPaymentCents: 20_000, annualRatePercent: 5.5 })
  })

  it.each([
    ['name', ''], ['name', 'a'.repeat(81)], ['type', 'private'], ['principal', '-100'], ['accruedInterest', ''],
    ['monthlyPayment', '0'], ['annualRate', ''], ['annualRate', '-1'], ['annualRate', '101'], ['annualRate', '1e2'],
    ['annualRate', '5.12345'], ['balanceDate', '2025-02-29'], ['nextPaymentDate', '2024-12-31'], ['balanceDate', '1899-01-01'],
  ])('rejects invalid %s: %s', (field, value) => {
    const result = validateLoanForm({ ...values, [field]: value })
    expect(result.loan).toBeNull()
    expect(result.errors).toHaveProperty(field)
  })

  it('rejects an already-paid loan', () => {
    expect(validateLoanForm({ ...values, principal: '0', accruedInterest: '0' }).errors.principal).toBeTruthy()
  })

  it('accepts a zero interest rate and same-day payment', () => {
    expect(validateLoanForm({ ...values, annualRate: '0', nextPaymentDate: values.balanceDate }).loan).not.toBeNull()
  })
})
