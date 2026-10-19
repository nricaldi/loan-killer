import { readonly, ref } from 'vue'
import type { LoanRecord } from '../domain/portfolio'
import { loadLoans, saveLoans, type LoanStorageIssue, type StorageAccess } from '../storage/loanStorage'

export function useLoanStorage(access?: StorageAccess) {
  const loaded = loadLoans(access)
  const loans = ref<LoanRecord[]>(loaded.loans)
  const issue = ref<LoanStorageIssue | null>(loaded.issue)
  const requiresReplacement = ref(loaded.issue !== null)
  let lastSavedRaw = loaded.raw

  function persist(replaceSavedCopy = false) {
    // A failed restore is never replaced by an empty or newly entered plan without confirmation.
    if (requiresReplacement.value && !replaceSavedCopy) return
    const saved = saveLoans(loans.value, lastSavedRaw, replaceSavedCopy, access)
    if (saved.ok) {
      lastSavedRaw = saved.raw
      issue.value = null
      requiresReplacement.value = false
    } else {
      issue.value = saved.issue
      if (saved.issue === 'conflict') requiresReplacement.value = true
    }
  }

  function setLoans(nextLoans: LoanRecord[]) {
    loans.value = nextLoans
    persist()
  }

  return {
    loans: readonly(loans),
    issue: readonly(issue),
    requiresReplacement: readonly(requiresReplacement),
    setLoans,
    retrySaving: () => persist(),
    replaceSavedCopy: () => persist(true),
  }
}
