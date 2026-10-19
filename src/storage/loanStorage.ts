import { validateLoan } from '../domain/loan'
import { validatePortfolio, type LoanRecord } from '../domain/portfolio'

export const LOAN_STORAGE_KEY = 'loan-killer.loans'
const STORAGE_VERSION = 1

export type LoanStorageIssue = 'load-error' | 'save-error' | 'conflict'
export type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>

export interface LoadedLoans {
  loans: LoanRecord[]
  raw: string | null
  issue: LoanStorageIssue | null
}

type SaveResult = { ok: true; raw: string } | { ok: false; issue: LoanStorageIssue }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readLoan(value: unknown): LoanRecord {
  if (!isObject(value)
    || typeof value.id !== 'string' || !value.id.trim() || value.id.length > 128
    || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80
    || (value.type !== 'subsidized' && value.type !== 'unsubsidized')
    || typeof value.fromExample !== 'boolean'
    || typeof value.principalCents !== 'number'
    || typeof value.accruedInterestCents !== 'number'
    || typeof value.annualRatePercent !== 'number'
    || typeof value.monthlyPaymentCents !== 'number'
    || typeof value.balanceDate !== 'string'
    || typeof value.nextPaymentDate !== 'string') {
    throw new Error('Invalid saved loan.')
  }
  const loan: LoanRecord = {
    id: value.id,
    name: value.name,
    type: value.type,
    fromExample: value.fromExample,
    principalCents: value.principalCents,
    accruedInterestCents: value.accruedInterestCents,
    annualRatePercent: value.annualRatePercent,
    monthlyPaymentCents: value.monthlyPaymentCents,
    balanceDate: value.balanceDate,
    nextPaymentDate: value.nextPaymentDate,
  }
  validateLoan(loan)
  if (Number(loan.annualRatePercent.toFixed(4)) !== loan.annualRatePercent) throw new Error('Invalid saved interest rate precision.')
  return loan
}

function readLoanList(value: unknown): LoanRecord[] {
  if (!Array.isArray(value)) throw new Error('Invalid saved loan list.')
  const loans = value.map(readLoan)
  validatePortfolio(loans)
  return loans
}

export function decodeLoans(raw: string): LoanRecord[] {
  const data: unknown = JSON.parse(raw)
  if (!isObject(data) || data.version !== STORAGE_VERSION) throw new Error('Unsupported saved loan format.')
  return readLoanList(data.loans)
}

export function encodeLoans(loans: readonly LoanRecord[]): string {
  return JSON.stringify({ version: STORAGE_VERSION, loans: readLoanList(loans) })
}

const browserStorage: StorageAccess = () => window.localStorage

export function loadLoans(access: StorageAccess = browserStorage): LoadedLoans {
  let raw: string | null = null
  try {
    raw = access().getItem(LOAN_STORAGE_KEY)
    return { loans: raw === null ? [] : decodeLoans(raw), raw, issue: null }
  } catch {
    return { loans: [], raw, issue: 'load-error' }
  }
}

export function saveLoans(
  loans: readonly LoanRecord[],
  expectedRaw: string | null,
  replaceSavedCopy = false,
  access: StorageAccess = browserStorage,
): SaveResult {
  try {
    const raw = encodeLoans(loans)
    const storage = access()
    // Another tab may have saved a newer list since this tab last loaded or saved.
    if (!replaceSavedCopy && storage.getItem(LOAN_STORAGE_KEY) !== expectedRaw) return { ok: false, issue: 'conflict' }
    storage.setItem(LOAN_STORAGE_KEY, raw)
    return { ok: true, raw }
  } catch {
    return { ok: false, issue: 'save-error' }
  }
}
