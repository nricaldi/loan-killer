<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue'
import LoanForm from './components/LoanForm.vue'
import LoanList from './components/LoanList.vue'
import LoanModal from './components/LoanModal.vue'
import LoanOverview from './components/LoanOverview.vue'
import LoanStorageNotice from './components/LoanStorageNotice.vue'
import PaymentSimulator from './components/PaymentSimulator.vue'
import { useLoanStorage } from './composables/useLoanStorage'
import type { Loan } from './domain/loan'
import { projectPortfolio, summarizePortfolio, type LoanRecord, type PortfolioProjection } from './domain/portfolio'
import { formatDate, money } from './format'

const { loans, issue: storageIssue, requiresReplacement, setLoans, retrySaving, replaceSavedCopy } = useLoanStorage()
const editingId = ref<string | null>(null)
const visibleLoanId = ref<string | null>(null)
const editorOpen = ref(false)
const addButton = ref<HTMLButtonElement | null>(null)
let editorTrigger: HTMLElement | null = null
const lastAction = ref('')
const portfolioRevision = ref(0)
const sortedLoans = computed(() => [...loans.value].sort((left, right) => left.name.localeCompare(right.name, 'en', { numeric: true, sensitivity: 'base' })))
const portfolio = computed(() => projectPortfolio(sortedLoans.value))
const preview = shallowRef<{ portfolio: PortfolioProjection; label: string } | null>(null)
const visiblePreview = computed(() => {
  if (!preview.value) return null
  if (!visibleLoanId.value) return preview.value
  const portfolio = summarizePortfolio(preview.value.portfolio.loans.filter(({ loan }) => loan.id === visibleLoanId.value))
  return portfolio ? { portfolio, label: preview.value.label } : null
})
const editingLoan = computed(() => loans.value.find((loan) => loan.id === editingId.value) ?? null)
const sharedBalanceDate = computed(() => loans.value.find((loan) => loan.id !== editingId.value)?.balanceDate)
const visiblePortfolio = computed(() => {
  const loan = loans.value.find((loan) => loan.id === visibleLoanId.value)
  if (loan) return projectPortfolio([loan])
  return portfolio.value
})
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
  if (isNew) visibleLoanId.value = null
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
  visibleLoanId.value = id
  editorOpen.value = true
}

function toggleLoan(id: string) {
  visibleLoanId.value = visibleLoanId.value === id ? null : id
}

function updateMinimum(id: string, cents: number) {
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 1_000_000_000) return
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

function removeLoan(id: string) {
  const removed = loans.value.find((loan) => loan.id === id)
  setLoans(loans.value.filter((loan) => loan.id !== id))
  portfolioRevision.value++
  preview.value = null
  if (editingId.value === id) editingId.value = null
  if (visibleLoanId.value === id) visibleLoanId.value = null
  lastAction.value = `Removed ${removed?.name ?? 'loan'} from the plan.`
  if (!loans.value.length) void nextTick(() => addButton.value?.focus())
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
      <button ref="addButton" class="primary-button header-add" type="button" @click="addLoan">+ Add loan</button>
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
        <div v-if="visiblePortfolio" class="results-area">
          <LoanOverview :portfolio="visiblePortfolio" :comparison="visiblePreview">
            <template #loans>
              <div class="loan-controls">
                <div class="loan-controls-heading">
                  <p class="loan-view-label">{{ visibleLoanId ? 'Focused on one loan' : 'Showing all loans' }}</p>
                  <a class="scenario-link" href="#extra-payment">Try extra payments ↓</a>
                </div>
                <LoanList
                  v-if="portfolio"
                  :loans="portfolio.loans"
                  :editing-id="editingId"
                  :visible-loan-id="visibleLoanId"
                  @add="addLoan"
                  @edit="editLoan"
                  @view="toggleLoan"
                  @payment="updateMinimum"
                  @remove="removeLoan"
                />
                <p id="loan-payment-help" class="loan-controls-note">Select a loan to focus the chart; select it again to show all loans. Minimum edits save automatically. Extra payments below are hypothetical.</p>
              </div>
            </template>
            <template #simulator>
              <PaymentSimulator :key="portfolioRevision" :loans="sortedLoans" embedded @preview="updatePreview" />
            </template>
          </LoanOverview>
        </div>
        <section v-else class="panel empty-state" aria-labelledby="empty-heading">
          <p class="eyebrow">YOUR PATH TO ZERO</p>
          <h2 id="empty-heading">There’s a finish line. Let’s find yours.</h2>
          <p>See your total repayment cost, how much goes to interest, and when you could be debt-free.</p>
          <button class="primary-button" type="button" @click="addLoan">Add your first loan</button>
          <button class="text-button" type="button" @click="addLoan">Just exploring? Try an example in the loan form</button>
        </section>
      </div>

      <LoanStorageNotice
        class="storage-status"
        :class="{ 'needs-attention': storageIssue }"
        :issue="storageIssue"
        :requires-replacement="requiresReplacement"
        :loan-count="loans.length"
        @retry="retrySaving"
        @replace="replaceSavedCopy"
      />

      <details class="assumptions">
        <summary>Estimate assumptions and loan details</summary>
        <div>
          <h2>A useful estimate, not a servicer statement.</h2>
          <p>
            We model fixed-rate U.S. federal loans already in repayment, with daily simple interest
            (annual rate ÷ 365), rounded to cents at each payment. Payments go to unpaid interest,
            then principal. Your monthly minimum stays fixed; dates follow the next payment’s day
            of the month, adjusted for shorter months. No fees, capitalization, deferment,
            income-driven plans, or forgiveness are modeled. Servicer calculations may differ.
            All starting balances must use the same date. Each loan keeps its own payment schedule;
            freed payments aren’t rolled over to other loans in this baseline.
            A hypothetical extra payment goes to unpaid interest, then principal, and does not
            replace a scheduled minimum or change the next due date. Paid-ahead status isn’t modeled.
            Monthly-increase scenarios follow your chosen strategy and roll freed minimums forward
            on their original due dates, keeping the original monthly budget plus the extra amount.
          </p>
          <details>
            <summary>What’s the difference between subsidized and unsubsidized?</summary>
            <p>
              For subsidized loans, the government generally covers interest while you’re enrolled
              at least half-time and during certain other eligible periods. Unsubsidized loans
              generally accrue interest from disbursement. During normal repayment, you’re
              generally responsible for interest on both, so this baseline models them the same way.
            </p>
            <a href="https://studentaid.gov/understand-aid/types/loans/subsidized-unsubsidized" target="_blank" rel="noopener noreferrer">
              Read the federal student aid explanation <span aria-hidden="true">↗</span>
              <span class="sr-only"> (opens in a new tab)</span>
            </a>
          </details>
        </div>
      </details>
      <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
    </main>

    <footer class="site-footer">
      <span>loan<span class="brand-light">killer</span>.</span>
      <p>Small steps. A smaller balance. You’ve got this.</p>
      <span class="footer-version">LOCAL PLANNER · V0.6</span>
    </footer>
  </div>
</template>

<style scoped>
.app-shell { max-width: 78rem; margin: 0 auto; padding: 0 var(--space-8); }
.site-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); padding: var(--space-4) 0; border-bottom: 1px solid var(--border); }
.brand { display: flex; align-items: center; gap: var(--space-3); color: var(--text); text-decoration: none; font-size: 1.5rem; letter-spacing: -0.055em; font-weight: 700; }
.brand-icon { width: 2.5rem; height: 2.5rem; display: grid; place-items: center; background: var(--blue-primary); border: 1px solid var(--blue-border); border-radius: var(--radius-md); }
.brand-icon svg { width: 1.75rem; height: 1.75rem; }
.brand-light { font-weight: 400; }
.brand-period { color: var(--chart-line); }
main { display: flex; flex-direction: column; gap: var(--space-5); padding-block: var(--space-5); }
.workspace, .results-area { display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; }
.storage-status.needs-attention { order: -1; }
.loan-controls { margin-bottom: var(--space-5); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border); }
.loan-controls-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2); }
.loan-view-label { margin: 0; font-size: var(--font-xs); color: var(--text-secondary); }
.scenario-link { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); min-height: 2.75rem; margin-left: auto; padding: var(--space-2) var(--space-3); color: var(--text-link); font-size: var(--font-xs); text-underline-offset: 0.2em; }
.loan-controls-note { margin: var(--space-2) 0 0; font-size: var(--font-xs); color: var(--text-muted); line-height: 1.6; }
.empty-state { padding: var(--space-9) var(--space-6); display: flex; flex-direction: column; align-items: center; text-align: center; }
.empty-state h2 { font-size: clamp(1.5rem, 3vw, 2rem); }
.empty-state > p:not(.eyebrow) { max-width: 30rem; color: var(--text-muted); font-size: var(--font-sm); line-height: 1.8; margin: var(--space-3) 0 var(--space-5); }
.empty-state .text-button { margin-top: var(--space-3); }
.assumptions { color: var(--text-muted); font-size: var(--font-xs); }
.assumptions > div { padding-block: var(--space-3); max-width: 60rem; }
.assumptions h2 { font-size: var(--font-xs); font-weight: 600; }
.assumptions p { color: var(--text-muted); font-size: var(--font-xs); line-height: 1.8; margin: var(--space-2) 0 0; }
.assumptions details { margin-top: var(--space-3); font-size: var(--font-xs); line-height: 1.8; }
.assumptions summary { cursor: pointer; color: var(--text-secondary); }
.assumptions a { display: inline-block; margin-top: var(--space-2); color: var(--text-link); }
.site-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-4); border-top: 1px solid var(--border); padding: var(--space-6) 0; color: var(--text-muted); }
.site-footer > span:first-child { font-weight: 600; font-size: var(--font-md); letter-spacing: -0.04em; }
.site-footer p { font-size: var(--font-xs); margin: 0; }
.footer-version { font-size: 0.6rem; letter-spacing: 0.1em; }
@media (max-width: 65rem) { .app-shell { padding-inline: var(--space-6); } }
@media (max-width: 35rem) { .app-shell { padding-inline: var(--space-4); } .brand { font-size: 1.25rem; gap: var(--space-2); } .brand-icon { width: 2rem; height: 2rem; } .empty-state { padding: var(--space-7) var(--space-4); } .footer-version { display: none; } .site-footer { justify-content: center; } .scenario-link { margin-left: 0; } }
</style>
