import { parseDate, daysBetween } from './dates'
import type { Loan, LoanType } from './loan'

export interface LoanFormValues {
  name: string
  type: LoanType
  principal: string
  accruedInterest: string
  annualRate: string
  monthlyPayment: string
  balanceDate: string
  nextPaymentDate: string
}

export type FormErrors = Partial<Record<keyof LoanFormValues, string>>

export function parseMoney(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null
  const [whole = '0', fraction = ''] = value.trim().split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= 1_000_000_000 ? cents : null
}

export function validateLoanForm(values: LoanFormValues): { errors: FormErrors; loan: Loan | null } {
  const errors: FormErrors = {}
  const principalCents = parseMoney(values.principal)
  const accruedInterestCents = parseMoney(values.accruedInterest)
  const monthlyPaymentCents = parseMoney(values.monthlyPayment)
  const annualRatePercent = Number(values.annualRate.trim())

  if (!values.name.trim()) errors.name = 'Give this loan a name.'
  if (values.name.trim().length > 80) errors.name = 'Keep the name to 80 characters or fewer.'
  if (values.type !== 'subsidized' && values.type !== 'unsubsidized') errors.type = 'Choose a loan type.'
  if (principalCents === null) errors.principal = 'Enter $0–$10,000,000 with up to two decimal places.'
  if (accruedInterestCents === null) errors.accruedInterest = 'Enter $0–$10,000,000 with up to two decimal places.'
  if (principalCents === 0 && accruedInterestCents === 0) errors.principal = 'Enter a remaining loan balance.'
  if (monthlyPaymentCents === null || monthlyPaymentCents === 0) errors.monthlyPayment = 'Enter $0.01–$10,000,000 with up to two decimal places.'
  if (!/^\d+(?:\.\d{1,4})?$/.test(values.annualRate.trim()) || !Number.isFinite(annualRatePercent) || annualRatePercent > 100) {
    errors.annualRate = 'Enter a rate from 0 to 100, with up to four decimal places.'
  }
  for (const field of ['balanceDate', 'nextPaymentDate'] as const) {
    const date = parseDate(values[field])
    if (!date || date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2100) {
      errors[field] = 'Enter a valid date between 1900 and 2100.'
    }
  }
  if (!errors.balanceDate && !errors.nextPaymentDate && daysBetween(values.balanceDate, values.nextPaymentDate) < 0) {
    errors.nextPaymentDate = 'Use a date on or after the balance date.'
  }
  if (Object.keys(errors).length || principalCents === null || accruedInterestCents === null || monthlyPaymentCents === null) {
    return { errors, loan: null }
  }
  return {
    errors,
    loan: {
      name: values.name.trim(),
      type: values.type,
      principalCents,
      accruedInterestCents,
      annualRatePercent,
      monthlyPaymentCents,
      balanceDate: values.balanceDate,
      nextPaymentDate: values.nextPaymentDate,
    },
  }
}
