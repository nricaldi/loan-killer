<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue'
import LoanForm from './components/LoanForm.vue'
import LoanList from './components/LoanList.vue'
import LoanModal from './components/LoanModal.vue'
import LoanOverview from './components/LoanOverview.vue'
import LoanTrajectory from './components/LoanTrajectory.vue'
import LoanStorageNotice from './components/LoanStorageNotice.vue'
import PaymentSimulator from './components/PaymentSimulator.vue'
import { useLoanStorage } from './composables/useLoanStorage'
import type { Loan } from './domain/loan'
import { projectPortfolio, type LoanRecord, type PortfolioProjection } from './domain/portfolio'
import { formatDate, money } from './format'

const { loans, issue: storageIssue, requiresReplacement, setLoans, retrySaving, replaceSavedCopy } = useLoanStorage()
const editingId = ref<string | null>(null)
const hiddenLoanIds = ref<string[]>([])
const allocations = ref<{ loanId: string; monthlyCents: number; oneTimeCents: number }[]>([])
const editorOpen = ref(false)
const addButton = ref<HTMLButtonElement | null>(null)
let editorTrigger: HTMLElement | null = null
const lastAction = ref('')
const portfolioRevision = ref(0)
const sortedLoans = computed(() => [...loans.value].sort((left, right) => left.name.localeCompare(right.name, 'en', { numeric: true, sensitivity: 'base' })))
const selectedLoans = computed(() => sortedLoans.value.filter(loan => !hiddenLoanIds.value.includes(loan.id)))
const portfolio = computed(() => projectPortfolio(sortedLoans.value))
const preview = shallowRef<{ portfolio: PortfolioProjection; label: string } | null>(null)
const editingLoan = computed(() => loans.value.find((loan) => loan.id === editingId.value) ?? null)
const sharedBalanceDate = computed(() => loans.value.find((loan) => loan.id !== editingId.value)?.balanceDate)
const visiblePortfolio = computed(() => projectPortfolio(selectedLoans.value))
const announcement = computed(() => {
  if (!portfolio.value) return `${lastAction.value} Enter a loan to see your estimate.`.trim()
  const { projection } = portfolio.value
  const count = `${loans.value.length} ${loans.value.length === 1 ? 'loan' : 'loans'}`
  if (projection.status !== 'paid-off') {
    return `${lastAction.value} ${count}. At least one loan does not pay off within 1,200 monthly payments.`
  }
  return [
    lastAction.value,
    `${count}.`,
    `${money(projection.totalPaymentsCents)} estimated total to repay.`,
    `${money(portfolio.value.principalCents)} principal and ${money(projection.remainingInterestCents)} interest.`,
    `${projection.paymentCount} ${projection.paymentCount === 1 ? 'payment' : 'payments'} remaining.`,
    `Estimated debt-free date ${formatDate(projection.payoffDate)}.`,
  ].join(' ')
})

async function closeEditor() {
  editorOpen.value = false
  editingId.value = null
  await nextTick()
  if (editorTrigger?.isConnected) editorTrigger.focus()
  else addButton.value?.focus()
}

async function saveLoan(loan: Loan, fromExample: boolean) {
  const isNew = !editingLoan.value
  const record: LoanRecord = { ...loan, id: editingId.value ?? crypto.randomUUID(), fromExample }
  setLoans(isNew ? [...loans.value, record] : loans.value.map((item) => item.id === record.id ? record : item))
  portfolioRevision.value++
  preview.value = null
  lastAction.value = `${isNew ? 'Added' : 'Updated'} ${record.name}.`

  await closeEditor()
}

function addLoan(event: MouseEvent) {
  editorTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  editingId.value = null
  editorOpen.value = true
}

function editLoan(id: string, event: MouseEvent) {
  editorTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  editingId.value = id
  editorOpen.value = true
}

function toggleLoan(id: string) {
  preview.value = null
  allocations.value = []
  hiddenLoanIds.value = hiddenLoanIds.value.includes(id)
    ? hiddenLoanIds.value.filter(item => item !== id) : [...hiddenLoanIds.value, id]
}

function updateMinimum(id: string, cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 1_000_000_000) return
  const loan = loans.value.find((loan) => loan.id === id)
  if (!loan || loan.monthlyPaymentCents === cents) return
  setLoans(loans.value.map((loan) => loan.id === id ? { ...loan, monthlyPaymentCents: cents } : loan))
  portfolioRevision.value++
  preview.value = null
  lastAction.value = `Updated the monthly minimum for ${loan.name}.`
}

function updatePreview(portfolio: PortfolioProjection | null, label: string) {
  preview.value = portfolio ? { portfolio, label } : null
}

async function recoverStorage(replace: boolean) {
  if (replace) replaceSavedCopy()
  else retrySaving()
  if (!storageIssue.value) {
    lastAction.value = 'Saved in this browser.'
    await nextTick()
    addButton.value?.focus()
  }
}

function removeLoan(id: string) {
  const removed = loans.value.find((loan) => loan.id === id)
  setLoans(loans.value.filter((loan) => loan.id !== id))
  portfolioRevision.value++
  preview.value = null
  if (editingId.value === id) editingId.value = null
  hiddenLoanIds.value = hiddenLoanIds.value.filter(item => item !== id)
  lastAction.value = `Removed ${removed?.name ?? 'loan'} from the plan.`
  void nextTick(() => addButton.value?.focus())
}
</script>

<template>
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="./" aria-label="loankiller. home">
        <span class="brand-icon" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M8 8v17h17M12 12l6 6 8-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <span>loan<span class="brand-light">killer</span><span class="brand-period">.</span></span>
      </a>
    </header>

    <LoanModal v-if="editorOpen" :editing="!!editingLoan" @close="closeEditor">
      <LoanForm
        :initial-loan="editingLoan"
        :shared-balance-date="sharedBalanceDate"
        :from-example="editingLoan?.fromExample"
        @submit="saveLoan"
        @cancel="closeEditor"
      />
    </LoanModal>

    <main id="main">
      <h1 class="sr-only">Loan payoff dashboard</h1>
      <div class="workspace">
        <div v-if="portfolio" class="results-area">
          <LoanOverview :portfolio="visiblePortfolio ?? portfolio" :comparison="preview">
            <template #loans>
              <div class="loan-controls">
                <LoanList
                  v-if="portfolio"
                  :loans="portfolio.loans"
                  :editing-id="editingId"
                  :hidden-loan-ids="hiddenLoanIds"
                  :allocations="allocations"
                  @edit="editLoan"
                  @toggle="toggleLoan"
                  @payment="updateMinimum"
                  @remove="removeLoan"
                >
                  <template #add><button ref="addButton" class="add-button small-add" type="button" @click="addLoan">+ Add loan</button></template>
                </LoanList>
                <p id="loan-payment-help" class="sr-only">Use each eye button to hide or include a loan in the estimate. Minimum edits save automatically. Extra payments are hypothetical.</p>
              </div>
            </template>
            <template #journey>
              <PaymentSimulator :key="portfolioRevision" :loans="selectedLoans" @preview="updatePreview" @allocations="allocations = $event">
                <LoanTrajectory v-if="visiblePortfolio" :portfolio="visiblePortfolio" :comparison="preview" />
                <p v-else class="hidden-empty" role="status">All loans are hidden. Open an eye above to include a loan.</p>
              </PaymentSimulator>
            </template>
          </LoanOverview>
        </div>
        <section v-else class="panel empty-state" aria-labelledby="empty-heading">
          <p class="eyebrow">YOUR PATH TO ZERO</p>
          <h2 id="empty-heading">There’s a finish line. Let’s find yours.</h2>
          <p>See your total repayment cost, how much goes to interest, and when you could be debt-free.</p>
          <button ref="addButton" class="primary-button add-button" type="button" @click="addLoan">Add your first loan</button>
          <button class="text-button" type="button" @click="addLoan">Just exploring? Try an example in the loan form</button>
        </section>
      </div>

      <LoanStorageNotice
        v-if="storageIssue"
        class="storage-status"
        :class="{ 'needs-attention': storageIssue }"
        :issue="storageIssue"
        :requires-replacement="requiresReplacement"
        :loan-count="loans.length"
        @retry="recoverStorage(false)"
        @replace="recoverStorage(true)"
      />

      <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
    </main>
  </div>
</template>

<style scoped>
.app-shell { max-width: 78rem; margin: 0 auto; padding: 0 var(--space-8); }
.site-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); padding: var(--space-2) 0; border-bottom: 1px solid var(--border); }
.brand { display: flex; align-items: center; gap: var(--space-3); color: var(--text); text-decoration: none; font-size: 1.5rem; letter-spacing: -0.055em; font-weight: 700; }
.brand-icon { width: 2.5rem; height: 2.5rem; display: grid; place-items: center; background: var(--blue-primary); border: 1px solid var(--blue-border); border-radius: var(--radius-md); }
.brand-icon svg { width: 1.75rem; height: 1.75rem; }
.brand-light { font-weight: 400; }
.brand-period { color: var(--chart-line); }
main { display: flex; flex-direction: column; gap: var(--space-5); padding-block: var(--space-5); }
.workspace, .results-area { display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; }
.storage-status.needs-attention { order: -1; }
.small-add { min-height: 36px; padding: 6px 10px; background: transparent; color: var(--text-link); border: 0; font: inherit; font-size: var(--font-sm); font-weight: 600; }
.hidden-empty { padding: 24px; color: var(--text-secondary); }
.loan-controls { min-width: 0; }
.empty-state { padding: var(--space-9) var(--space-6); display: flex; flex-direction: column; align-items: center; text-align: center; }
.empty-state h2 { font-size: clamp(1.5rem, 3vw, 2rem); }
.empty-state > p:not(.eyebrow) { max-width: 30rem; color: var(--text-muted); font-size: var(--font-sm); line-height: 1.8; margin: var(--space-3) 0 var(--space-5); }
.empty-state .text-button { margin-top: var(--space-3); }
@media (max-width: 65rem) { .app-shell { padding-inline: var(--space-6); } }
@media (max-width: 35rem) { .app-shell { padding-inline: var(--space-4); } .brand { font-size: 1.25rem; gap: var(--space-2); } .brand-icon { width: 2rem; height: 2rem; } .empty-state { padding: var(--space-7) var(--space-4); } }
</style>
