import { describe, expect, it, vi } from 'vitest'
import type { LoanRecord } from '../domain/portfolio'
import { encodeLoans } from '../storage/loanStorage'
import { useLoanStorage } from './useLoanStorage'

const loan: LoanRecord = {
  id: 'loan-a', name: 'Direct loan', type: 'unsubsidized', fromExample: false,
  principalCents: 100_000, accruedInterestCents: 2_500, annualRatePercent: 5.5,
  monthlyPaymentCents: 30_000, balanceDate: '2025-01-01', nextPaymentDate: '2025-02-01',
}

function memoryStorage(initial: string | null = null) {
  let raw = initial
  const storage = {
    getItem: vi.fn(() => raw),
    setItem: vi.fn((_key: string, next: string) => { raw = next }),
  }
  return { storage, access: () => storage, value: () => raw, externalSave: (next: string | null) => { raw = next } }
}

describe('local loan state', () => {
  it('restores immediately and does not write on initialization', () => {
    const store = memoryStorage(encodeLoans([loan]))
    const state = useLoanStorage(store.access)
    expect(state.loans.value).toEqual([loan])
    expect(state.issue.value).toBeNull()
    expect(store.storage.setItem).not.toHaveBeenCalled()
  })

  it('saves additions, updates and an empty plan after the last removal', () => {
    const store = memoryStorage()
    const state = useLoanStorage(store.access)
    state.setLoans([loan])
    expect(store.value()).toBe(encodeLoans([loan]))
    state.setLoans([{ ...loan, principalCents: 80_000 }])
    expect(useLoanStorage(store.access).loans.value[0]?.principalCents).toBe(80_000)
    state.setLoans([])
    expect(useLoanStorage(store.access).loans.value).toEqual([])
  })

  it('keeps edits in memory when saving fails, then retries the latest complete plan', () => {
    const original = encodeLoans([loan])
    const store = memoryStorage(original)
    const state = useLoanStorage(store.access)
    store.storage.setItem.mockImplementationOnce(() => { throw new Error('Full') })
    const updated = { ...loan, principalCents: 80_000 }
    state.setLoans([updated])
    expect(state.loans.value).toEqual([updated])
    expect(state.issue.value).toBe('save-error')
    expect(store.value()).toBe(original)
    state.retrySaving()
    expect(state.issue.value).toBeNull()
    expect(store.value()).toBe(encodeLoans([updated]))
  })

  it('never auto-overwrites unreadable data, including after entering new loans', () => {
    const store = memoryStorage('unreadable original')
    const state = useLoanStorage(store.access)
    state.setLoans([loan])
    state.retrySaving()
    expect(state.loans.value).toEqual([loan])
    expect(state.requiresReplacement.value).toBe(true)
    expect(store.value()).toBe('unreadable original')
    expect(store.storage.setItem).not.toHaveBeenCalled()
    state.replaceSavedCopy()
    expect(state.requiresReplacement.value).toBe(false)
    expect(state.issue.value).toBeNull()
    expect(store.value()).toBe(encodeLoans([loan]))
  })

  it('requires explicit replacement if another tab updates or clears the saved copy', () => {
    const original = encodeLoans([loan])
    const store = memoryStorage(original)
    const state = useLoanStorage(store.access)
    const elsewhere = encodeLoans([{ ...loan, name: 'Other tab' }])
    store.externalSave(elsewhere)
    state.setLoans([{ ...loan, principalCents: 50_000 }])
    expect(state.issue.value).toBe('conflict')
    expect(store.value()).toBe(elsewhere)
    state.setLoans([])
    expect(store.value()).toBe(elsewhere)
    state.replaceSavedCopy()
    expect(store.value()).toBe(encodeLoans([]))
  })

  it('retains replacement protection if storage is still blocked during explicit recovery', () => {
    const store = memoryStorage('original')
    const state = useLoanStorage(store.access)
    store.storage.setItem.mockImplementation(() => { throw new Error('Blocked') })
    state.setLoans([loan])
    state.replaceSavedCopy()
    expect(state.issue.value).toBe('save-error')
    expect(state.requiresReplacement.value).toBe(true)
    expect(store.value()).toBe('original')
  })
})
