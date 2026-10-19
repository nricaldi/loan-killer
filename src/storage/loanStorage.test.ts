import { describe, expect, it, vi } from 'vitest'
import type { LoanRecord } from '../domain/portfolio'
import { decodeLoans, encodeLoans, loadLoans, LOAN_STORAGE_KEY, saveLoans, type StorageAccess } from './loanStorage'

const loan: LoanRecord = {
  id: 'loan-a', name: 'Direct Loan A', type: 'unsubsidized', fromExample: false,
  principalCents: 1_800_001, accruedInterestCents: 7_501, annualRatePercent: 5.1234,
  monthlyPaymentCents: 20_001, balanceDate: '2025-01-01', nextPaymentDate: '2025-02-01',
}

function memoryStorage(initial: string | null = null) {
  let raw = initial
  const storage = {
    getItem: vi.fn(() => raw),
    setItem: vi.fn((_key: string, value: string) => { raw = value }),
  }
  return { storage, access: () => storage, value: () => raw }
}

describe('versioned local loan records', () => {
  it('round-trips every loan field, integer cent, exact rate, ID and example flag', () => {
    const records = [loan, { ...loan, id: 'loan-b', type: 'subsidized' as const, fromExample: true }]
    expect(decodeLoans(encodeLoans(records))).toEqual(records)
    expect(JSON.parse(encodeLoans(records)).version).toBe(1)
  })

  it('saves and restores an explicit zero minimum without treating it as missing data', () => {
    const records = [{ ...loan, monthlyPaymentCents: 0 }]
    expect(decodeLoans(encodeLoans(records))).toEqual(records)
    const store = memoryStorage()
    expect(saveLoans(records, null, false, store.access).ok).toBe(true)
    expect(loadLoans(store.access)).toMatchObject({ loans: records, issue: null })
  })

  it('preserves an empty saved plan and interest-only balances', () => {
    expect(decodeLoans(encodeLoans([]))).toEqual([])
    const interestOnly = { ...loan, principalCents: 0 }
    expect(decodeLoans(encodeLoans([interestOnly]))).toEqual([interestOnly])
  })

  it('does not save arbitrary fields, drafts or projection data', () => {
    const extended = { ...loan, accountNumber: 'not-a-field', scenario: { extra: 100 }, payments: [] }
    expect(JSON.parse(encodeLoans([extended])).loans).toEqual([loan])
    expect(decodeLoans(JSON.stringify({ version: 1, loans: [extended] }))).toEqual([loan])
  })

  it.each(['not json', 'null', '[]', '{}', '{"version":2,"loans":[]}', '{"version":"1","loans":[]}', '{"version":1,"loans":{}}'])('rejects unreadable or unsupported saved formats: %s', (raw) => {
    expect(() => decodeLoans(raw)).toThrow()
  })

  it.each([
    { id: '' }, { id: 123 }, { id: 'a'.repeat(129) }, { name: '' }, { name: 'a'.repeat(81) },
    { type: 'private' }, { fromExample: 'false' }, { principalCents: '1800001' }, { principalCents: -1 },
    { principalCents: 1.5 }, { principalCents: 1_000_000_001 }, { accruedInterestCents: -1 },
    { monthlyPaymentCents: -1 }, { monthlyPaymentCents: null }, { monthlyPaymentCents: '' }, { annualRatePercent: 101 }, { annualRatePercent: 5.12345 },
    { balanceDate: '2025-02-29' }, { nextPaymentDate: '2024-12-31' }, { balanceDate: '1899-01-01' },
  ])('validates stored fields without coercing them: %j', (changes) => {
    expect(() => decodeLoans(JSON.stringify({ version: 1, loans: [{ ...loan, ...changes }] }))).toThrow()
  })

  it('rejects the whole saved plan rather than silently dropping a bad loan', () => {
    expect(() => decodeLoans(JSON.stringify({ version: 1, loans: [loan, { ...loan, id: 'loan-b', monthlyPaymentCents: -1 }] }))).toThrow()
    expect(() => encodeLoans([loan, { ...loan, id: loan.id }])).toThrow('unique ID')
    expect(() => encodeLoans([loan, { ...loan, id: 'loan-b', balanceDate: '2025-01-02' }])).toThrow('same balance date')
  })

  it('allows duplicate names with distinct IDs and does not change historical dates', () => {
    const records = [loan, { ...loan, id: 'loan-b' }]
    const decoded = decodeLoans(encodeLoans(records))
    expect(decoded).toEqual(records)
    expect(decoded[0]?.balanceDate).toBe('2025-01-01')
  })
})

describe('browser storage access', () => {
  it('loads missing data as an empty plan without writing anything', () => {
    const store = memoryStorage()
    expect(loadLoans(store.access)).toEqual({ loans: [], raw: null, issue: null })
    expect(store.storage.getItem).toHaveBeenCalledWith(LOAN_STORAGE_KEY)
    expect(store.storage.setItem).not.toHaveBeenCalled()
  })

  it('restores validated records without rewriting the saved copy on startup', () => {
    const raw = encodeLoans([loan])
    const store = memoryStorage(raw)
    expect(loadLoans(store.access)).toEqual({ loans: [loan], raw, issue: null })
    expect(store.storage.setItem).not.toHaveBeenCalled()
  })

  it('leaves unreadable and future-version data untouched', () => {
    for (const raw of ['bad data', '{"version":2,"loans":[]}']) {
      const store = memoryStorage(raw)
      expect(loadLoans(store.access)).toEqual({ loans: [], raw, issue: 'load-error' })
      expect(store.value()).toBe(raw)
      expect(store.storage.setItem).not.toHaveBeenCalled()
    }
  })

  it('handles blocked storage getters and read failures without crashing', () => {
    const blocked: StorageAccess = () => { throw new DOMException('Blocked', 'SecurityError') }
    expect(loadLoans(blocked).issue).toBe('load-error')
    const store = memoryStorage()
    store.storage.getItem.mockImplementation(() => { throw new Error('Read failed') })
    expect(loadLoans(store.access).issue).toBe('load-error')
    expect(store.storage.setItem).not.toHaveBeenCalled()
  })

  it('writes only the owned key and can persist removal of the final loan', () => {
    const store = memoryStorage()
    const saved = saveLoans([loan], null, false, store.access)
    expect(saved.ok).toBe(true)
    expect(store.storage.setItem).toHaveBeenCalledWith(LOAN_STORAGE_KEY, encodeLoans([loan]))
    if (!saved.ok) throw new Error('Expected save')
    expect(saveLoans([], saved.raw, false, store.access).ok).toBe(true)
    expect(decodeLoans(store.value() ?? '')).toEqual([])
  })

  it('retains the previous saved copy when writing fails', () => {
    const raw = encodeLoans([loan])
    const store = memoryStorage(raw)
    store.storage.setItem.mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    expect(saveLoans([], raw, false, store.access)).toEqual({ ok: false, issue: 'save-error' })
    expect(store.value()).toBe(raw)
  })

  it('does not overwrite a newer or cleared copy from another tab without explicit replacement', () => {
    const original = encodeLoans([loan])
    const newer = encodeLoans([{ ...loan, name: 'Updated elsewhere' }])
    for (const current of [newer, null]) {
      const store = memoryStorage(current)
      expect(saveLoans([loan], original, false, store.access)).toEqual({ ok: false, issue: 'conflict' })
      expect(store.value()).toBe(current)
      expect(store.storage.setItem).not.toHaveBeenCalled()
      expect(saveLoans([loan], original, true, store.access).ok).toBe(true)
      expect(store.value()).toBe(original)
    }
  })

  it('does not write invalid records, even during explicit replacement', () => {
    const store = memoryStorage('saved copy')
    expect(saveLoans([{ ...loan, monthlyPaymentCents: -1 }], 'saved copy', true, store.access).ok).toBe(false)
    expect(store.value()).toBe('saved copy')
    expect(store.storage.setItem).not.toHaveBeenCalled()
  })
})
