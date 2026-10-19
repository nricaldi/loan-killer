<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { daysBetween, today } from '../domain/dates'
import type { Projection } from '../domain/loan'
import { parseMoney } from '../domain/loanForm'
import { compareOneTimePayment, oneTimePaymentAvailability, type OneTimePaymentComparison } from '../domain/oneTimePayment'
import type { LoanRecord } from '../domain/portfolio'
import { dateDistance, formatDate, money } from '../format'
import BalanceChart from './BalanceChart.vue'
import PaymentSchedule from './PaymentSchedule.vue'

const props = defineProps<{ loans: readonly LoanRecord[] }>()
const targetId = ref(props.loans[0]?.id ?? '')
const amount = ref('')
const paymentDate = ref(today())
const errors = ref<{ target?: string; amount?: string; general?: string }>({})
const form = ref<HTMLFormElement | null>(null)
const result = ref<OneTimePaymentComparison | null>(null)
const unavailable = computed(() => oneTimePaymentAvailability(props.loans, paymentDate.value))
const hasChanges = computed(() => result.value !== null && (
  targetId.value !== result.value.payment.loanId || parseMoney(amount.value) !== result.value.payment.amountCents
))
const baselinePaid = computed(() => result.value?.baseline.projection.status === 'paid-off' ? result.value.baseline.projection : null)
const scenarioPaid = computed(() => result.value?.scenario.projection.status === 'paid-off' ? result.value.scenario.projection : null)
const chartProjection = computed(() => baselinePaid.value ?? scenarioPaid.value)
const chartComparison = computed(() => baselinePaid.value && scenarioPaid.value
  ? { projection: scenarioPaid.value, label: 'With one-time payment' }
  : undefined)
const additionalInterest = computed(() => (result.value?.savings?.interestCents ?? 0) < 0)
const announcement = computed(() => {
  if (!result.value) return ''
  const { payment, appliedCents, targetScenario, savings } = result.value
  const savingsText = savings
    ? `${money(Math.abs(savings.interestCents))} ${savings.interestCents >= 0 ? 'interest saved' : 'additional interest'}. ${payoffChange(result.value.baseline.projection, result.value.scenario.projection)} overall.`
    : 'Complete savings are not available because at least one plan does not pay off within the limit.'
  return `Comparison updated. ${money(appliedCents)} applied to ${targetScenario.loan.name} on ${formatDate(payment.date)}. ${savingsText}`
})

function payoffChange(before: Projection, after: Projection): string {
  if (before.status !== 'paid-off' || after.status !== 'paid-off') return 'Not available'
  const days = daysBetween(after.payoffDate, before.payoffDate)
  if (!days) return 'Same payoff date'
  return `${dateDistance(after.payoffDate, before.payoffDate)} ${days > 0 ? 'sooner' : 'later'}`
}

function payoffDate(projection: Projection): string {
  return projection.status === 'paid-off' ? formatDate(projection.payoffDate) : 'Beyond projection limit'
}

async function compare() {
  paymentDate.value = today()
  const amountCents = parseMoney(amount.value)
  errors.value = {}
  if (!props.loans.some((loan) => loan.id === targetId.value)) errors.value.target = 'Choose a loan for the extra payment.'
  if (amountCents === null) errors.value.amount = 'Enter $0–$10,000,000 with up to two decimal places, without commas.'
  if (unavailable.value) errors.value.general = unavailable.value
  if (Object.keys(errors.value).length || amountCents === null) {
    await nextTick()
    const firstError = form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?? form.value?.querySelector<HTMLElement>('[role="alert"]')
    firstError?.focus()
    return
  }
  result.value = compareOneTimePayment(props.loans, { loanId: targetId.value, amountCents, date: paymentDate.value })
}

async function clear() {
  result.value = null
  amount.value = ''
  errors.value = {}
  await nextTick()
  form.value?.querySelector<HTMLInputElement>('#extra-payment-amount')?.focus()
}
</script>

<template>
  <section id="extra-payment" class="panel simulator" aria-labelledby="extra-payment-heading" tabindex="-1">
    <div class="simulator-heading">
      <div>
        <p class="eyebrow">A SMALL MOVE. A DIFFERENT FINISH LINE.</p>
        <h2 id="extra-payment-heading">What could one payment change?</h2>
        <p class="section-intro">Try an extra payment today, without changing your actual loan details.</p>
      </div>
      <span class="hypothetical-badge">WHAT-IF · NOT A REAL PAYMENT</span>
    </div>

    <form ref="form" class="scenario-form" novalidate @submit.prevent="compare">
      <div class="scenario-fields">
        <div class="scenario-field">
          <label for="extra-payment-target">Apply extra payment to</label>
          <select id="extra-payment-target" v-model="targetId" :aria-invalid="!!errors.target" :aria-describedby="errors.target ? 'extra-target-error' : undefined">
            <option v-for="(loan, index) in loans" :key="loan.id" :value="loan.id">{{ index + 1 }}. {{ loan.name }} · {{ loan.annualRatePercent }}%</option>
          </select>
          <p v-if="errors.target" id="extra-target-error" class="field-error">{{ errors.target }}</p>
        </div>
        <div class="scenario-field amount-field">
          <label for="extra-payment-amount">One-time extra payment</label>
          <div class="amount-input">
            <span aria-hidden="true">$</span>
            <input
              id="extra-payment-amount"
              v-model="amount"
              type="text"
              inputmode="decimal"
              placeholder="1000.00"
              required
              :aria-invalid="!!errors.amount"
              :aria-describedby="errors.amount ? 'extra-amount-error extra-date-help' : 'extra-date-help'"
            />
          </div>
          <p v-if="errors.amount" id="extra-amount-error" class="field-error">{{ errors.amount }}</p>
        </div>
        <button class="primary-button" type="submit">{{ result ? 'Update comparison' : 'Compare payment' }} <span aria-hidden="true">→</span></button>
      </div>
      <p id="extra-date-help" class="form-note">Modeled for today, {{ formatDate(paymentDate) }}. Applied to unpaid interest first, then principal. Scheduled minimums continue unless the loan is paid off.</p>
      <p v-if="unavailable && !errors.general" class="date-warning">{{ unavailable }}</p>
      <p v-if="Object.keys(errors).length" class="field-error" role="alert" tabindex="-1">{{ errors.general ?? 'Check the highlighted fields before comparing.' }}</p>
      <p v-else-if="hasChanges" class="draft-notice" role="status">Inputs changed. Update the comparison to use these figures; the results below still show your last comparison.</p>
    </form>

    <div v-if="result" class="comparison-results" data-testid="extra-payment-results">
      <div class="result-heading">
        <div>
          <p class="eyebrow">{{ result.baseline.loans.length === 1 ? 'THE IMPACT ON YOUR LOAN' : `THE IMPACT ACROSS ALL ${result.baseline.loans.length} LOANS` }}</p>
          <h3>{{ money(result.appliedCents) }} toward {{ result.targetScenario.loan.name }}</h3>
        </div>
        <button class="text-button" type="button" @click="clear">Clear scenario</button>
      </div>

      <div class="savings-grid">
        <div class="savings-card">
          <p class="eyebrow">{{ additionalInterest ? 'ADDITIONAL INTEREST' : 'INTEREST SAVED' }}</p>
          <p class="savings-value" data-testid="extra-interest-saved">{{ result.savings ? money(Math.abs(result.savings.interestCents)) : 'Not available' }}</p>
          <p>{{ result.savings ? 'Compared with minimum payments only.' : 'A complete payoff estimate is needed for both plans.' }}</p>
        </div>
        <div class="savings-card">
          <p class="eyebrow">OVERALL PAYOFF CHANGE</p>
          <p class="savings-value time-value" data-testid="extra-time-saved">{{ payoffChange(result.baseline.projection, result.scenario.projection) }}</p>
          <p>The date when every loan reaches zero.</p>
        </div>
      </div>

      <div class="allocation">
        <div>
          <h3>Where today’s payment goes</h3>
          <p>On {{ formatDate(result.payment.date) }}, before any scheduled payment that day.</p>
        </div>
        <dl>
          <div><dt>To unpaid interest</dt><dd data-testid="extra-to-interest">{{ money(result.interestPaidCents) }}</dd></div>
          <div><dt>To principal</dt><dd data-testid="extra-to-principal">{{ money(result.principalPaidCents) }}</dd></div>
          <div><dt>This loan’s balance after extra</dt><dd data-testid="extra-balance-after">{{ money(result.balanceAfterExtraCents) }}</dd></div>
        </dl>
        <p v-if="result.unusedCents > 0" class="unused-notice" data-testid="extra-unused">You entered {{ money(result.payment.amountCents) }}, but this loan only needs {{ money(result.appliedCents) }}. The remaining {{ money(result.unusedCents) }} is unused; it isn’t moved to another loan or included in projected payments.</p>
      </div>

      <div class="comparison-table-scroll" role="region" aria-label="Minimum payments versus one-time payment, scroll horizontally if needed" tabindex="0">
        <table class="comparison-table">
          <caption>All loans · same monthly minimums · total payments include the applied one-time payment.</caption>
          <thead><tr><th scope="col">Your whole plan</th><th scope="col">Minimum only</th><th scope="col">With one-time payment</th></tr></thead>
          <tbody>
            <tr><th scope="row">Debt-free date</th><td>{{ payoffDate(result.baseline.projection) }}</td><td data-testid="extra-payoff-date">{{ payoffDate(result.scenario.projection) }}</td></tr>
            <tr><th scope="row">Remaining interest</th><td>{{ baselinePaid ? money(baselinePaid.remainingInterestCents) : 'Not available' }}</td><td>{{ scenarioPaid ? money(scenarioPaid.remainingInterestCents) : 'Not available' }}</td></tr>
            <tr><th scope="row">Total payments</th><td>{{ baselinePaid ? money(baselinePaid.totalPaymentsCents) : 'Not available' }}</td><td data-testid="extra-total-payments">{{ scenarioPaid ? money(scenarioPaid.totalPaymentsCents) : 'Not available' }}</td></tr>
          </tbody>
        </table>
      </div>

      <p class="target-impact"><strong>{{ result.targetScenario.loan.name }}:</strong> {{ payoffDate(result.targetBaseline.projection) }} → {{ payoffDate(result.targetScenario.projection) }}. {{ payoffChange(result.targetBaseline.projection, result.targetScenario.projection) }} for this loan. Paying it off earlier may not change your overall date if another loan takes longer.</p>
      <p v-if="!result.savings" class="date-warning">At least one plan doesn’t pay off within the 1,200-monthly-payment limit. We don’t invent a complete interest saving or time reduction. Any available dates and totals above belong only to a plan that fully pays off.</p>
      <p v-if="additionalInterest" class="form-note">Interest rounds at each payment. Splitting a period with a very small extra payment can change the estimate by a few cents.</p>

      <template v-if="chartProjection">
        <BalanceChart
          :balance-date="result.baseline.balanceDate"
          :initial-balance-cents="result.baseline.principalCents + result.baseline.accruedInterestCents"
          :projection="chartProjection"
          :label="baselinePaid ? 'Minimum payments only' : 'With one-time payment'"
          :comparison="chartComparison"
        />
        <p class="form-note">{{ baselinePaid && scenarioPaid ? 'Dashed: your baseline. Solid: with the extra payment. Both are estimates, not actual history.' : 'Only the plan with a complete payoff estimate is charted.' }}</p>
      </template>
      <PaymentSchedule v-if="scenarioPaid" :payments="scenarioPaid.schedule" :combined="result.scenario.loans.length > 1" />
      <p class="sr-only" role="status" aria-atomic="true">{{ announcement }}</p>
    </div>

    <p class="simulator-footnote">This is a hypothetical payment, not a transaction. Your baseline and entered balances stay unchanged. Loan edits clear this scenario. We don’t model paid-ahead status; check your servicer’s overpayment instructions.</p>
  </section>
</template>

<style scoped>
.simulator {
  padding: var(--space-7);
  margin-top: var(--space-7);
}

.simulator-heading, .result-heading {
  display: flex;
  justify-content: space-between;
  align-items: start;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.simulator h2 {
  font-size: clamp(1.4rem, 3vw, 1.85rem);
  letter-spacing: -0.04em;
}

.section-intro, .form-note, .simulator-footnote, .target-impact, .allocation p {
  color: var(--text-muted);
  font-size: var(--font-xs);
  line-height: 1.8;
}

.section-intro {
  font-size: var(--font-sm);
  margin: var(--space-3) 0 0;
}

.hypothetical-badge {
  border: 1px solid var(--blue-border);
  border-radius: var(--radius-full);
  background: var(--blue-light);
  color: var(--text-link);
  padding: var(--space-2) var(--space-3);
  font-size: 0.6rem;
  font-weight: 600;
  letter-spacing: 0.07em;
}

.scenario-form {
  margin-top: var(--space-6);
}

.scenario-fields {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(10rem, 1fr) auto;
  gap: var(--space-4);
  align-items: start;
}

.scenario-field {
  min-width: 0;
}

label {
  display: block;
  font-size: var(--font-xs);
  font-weight: 600;
  margin-bottom: var(--space-2);
}

input, select {
  min-width: 0;
  width: 100%;
  min-height: 2.9rem;
  padding: var(--space-3);
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
}

input[aria-invalid='true'], select[aria-invalid='true'] {
  border-color: var(--danger);
}

input::placeholder {
  color: var(--text-placeholder);
  opacity: 1;
}

.amount-input {
  position: relative;
}

.amount-input > span {
  position: absolute;
  left: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: var(--font-sm);
  pointer-events: none;
}

.amount-input input {
  padding-left: 1.7rem;
}

.scenario-fields > button {
  margin-top: 1.6rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
}

.field-error {
  color: var(--danger);
  font-size: var(--font-xs);
  line-height: 1.7;
  margin: var(--space-2) 0 0;
}

.date-warning, .draft-notice, .unused-notice {
  background: var(--blue-light);
  border: 1px solid var(--blue-border);
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  color: var(--text-secondary);
  font-size: var(--font-xs);
  line-height: 1.8;
}

.comparison-results {
  border-top: 1px solid var(--border);
  padding-top: var(--space-6);
  margin-top: var(--space-6);
}

h3 {
  margin: 0;
  font-size: var(--font-md);
  font-weight: 600;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.savings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-5);
}

.savings-card {
  background: var(--blue-light);
  border: 1px solid var(--blue-border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
}

.savings-value {
  margin: var(--space-3) 0;
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 600;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.savings-card > p:last-child {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--font-xs);
  line-height: 1.7;
}

.allocation {
  margin-top: var(--space-6);
  padding: var(--space-5);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.allocation p {
  margin: var(--space-2) 0 0;
}

dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
  margin: var(--space-4) 0 0;
}

dt {
  color: var(--text-muted);
  font-size: var(--font-xs);
  line-height: 1.7;
}

dd {
  margin: var(--space-2) 0 0;
  font-size: var(--font-lg);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.allocation .unused-notice {
  margin-top: var(--space-4);
}

.comparison-table-scroll {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  margin-top: var(--space-5);
}

.comparison-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: var(--font-sm);
  font-variant-numeric: tabular-nums;
}

caption {
  text-align: left;
  padding: var(--space-4);
  color: var(--text-muted);
  font-size: var(--font-xs);
  line-height: 1.7;
}

th, td {
  text-align: right;
  padding: var(--space-4);
  border-top: 1px solid var(--border);
  overflow-wrap: anywhere;
}

th:first-child {
  text-align: left;
}

thead {
  background: var(--surface-muted);
  font-size: var(--font-xs);
}

tbody th {
  font-weight: 500;
}

tbody td:last-child {
  background: var(--blue-light);
  font-weight: 600;
}

.target-impact {
  margin-top: var(--space-4);
}

.target-impact strong {
  color: var(--text);
}

.simulator-footnote {
  margin: var(--space-5) 0 0;
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}

@media (max-width: 52rem) {
  .scenario-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .scenario-fields > button {
    grid-column: 1 / -1;
    margin-top: 0;
  }
}

@media (max-width: 35rem) {
  .simulator {
    padding: var(--space-4);
  }

  .scenario-fields, .savings-grid, dl {
    grid-template-columns: 1fr;
  }

  th, td {
    padding: var(--space-3);
  }

  .comparison-table {
    font-size: var(--font-xs);
  }
}
</style>
