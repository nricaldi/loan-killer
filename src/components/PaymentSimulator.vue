<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { today } from '../domain/dates'
import { parseMoney } from '../domain/loanForm'
import { oneTimePaymentAvailability } from '../domain/oneTimePayment'
import { comparePaymentScenarios, selectPaymentStrategy, type ExtraScenarioId, type PaymentScenarios } from '../domain/paymentScenarios'
import type { LoanRecord, PortfolioProjection } from '../domain/portfolio'
import { recurringStartDate, strategyNames, type RepaymentStrategy } from '../domain/recurringPayments'
import { formatDate, money } from '../format'
import ScenarioComparison from './ScenarioComparison.vue'
import PaymentStrategyPicker from './PaymentStrategyPicker.vue'
import PaymentPlanSummary from './PaymentPlanSummary.vue'

const props = defineProps<{ loans: readonly LoanRecord[]; embedded?: boolean }>()
const emit = defineEmits<{ preview: [portfolio: PortfolioProjection | null, label: string] }>()
let resetting = false
const targetId = ref(props.loans[0]?.id ?? '')
const amount = ref('0')
const monthlyAmount = ref('0')
const strategy = ref<RepaymentStrategy>('highest-rate')
const paymentDate = ref(today())
const errors = ref<{ target?: string; amount?: string; monthly?: string; strategy?: string; general?: string }>({})
const form = ref<HTMLFormElement | null>(null)
const result = ref<PaymentScenarios | null>(null)
const selected = ref<ExtraScenarioId>('one-time')
const unavailable = computed(() => oneTimePaymentAvailability(props.loans, paymentDate.value))
const startDate = computed(() => recurringStartDate(props.loans))
const minimumCents = computed(() => props.loans.reduce((sum, loan) => sum + loan.monthlyPaymentCents, 0))
const enteredMonthlyCents = computed(() => parseMoney(monthlyAmount.value))
const budgetCents = computed(() => enteredMonthlyCents.value === null ? null : minimumCents.value + enteredMonthlyCents.value)
const sliderMaximum = computed(() => Math.max(1_000, Math.ceil((enteredMonthlyCents.value ?? 0) / 25_000) * 250))
const hasChanges = computed(() => result.value !== null && (
  targetId.value !== result.value.request.loanId
  || parseMoney(amount.value) !== result.value.request.oneTimeCents
  || enteredMonthlyCents.value !== result.value.request.extraMonthlyCents
  || strategy.value !== result.value.request.strategy
))
const selectedPlan = computed(() => result.value?.scenarios.find(({ id }) => id === selected.value))
const firstMonthlyAllocation = computed(() => {
  if (!result.value || result.value.request.extraMonthlyCents === 0) return []
  const plan = result.value.strategies.find(({ strategy }) => strategy === result.value?.request.strategy)
  const portfolio = result.value.request.oneTimeCents > 0 ? plan?.combined.portfolio : plan?.monthly.portfolio
  return portfolio?.loans.flatMap(({ loan, projection }) => projection.schedule
    .filter((payment) => payment.kind === 'monthly-extra' && payment.date === result.value?.recurringStartDate)
    .map((payment) => ({ id: loan.id, name: loan.name, amountCents: payment.paymentCents }))) ?? []
})
const chartLabel = computed(() => {
  if (selected.value === 'one-time') return 'With one-time payment'
  const label = selected.value === 'monthly' ? 'With extra monthly payments' : 'With one-time + monthly payments'
  return `${label} · ${strategyNames[result.value?.request.strategy ?? strategy.value]}`
})

watch(() => props.loans, (loans) => {
  result.value = null
  if (!loans.some((loan) => loan.id === targetId.value)) targetId.value = loans[0]?.id ?? ''
})
watch([() => props.loans, targetId, amount, monthlyAmount, strategy], ([loans], [previousLoans]) => {
  if (resetting) return
  if (loans !== previousLoans && parseMoney(amount.value) === 0 && enteredMonthlyCents.value === 0) return
  void compare(false)
})
watch([result, selected], () => emit('preview', selectedPlan.value?.portfolio ?? null, chartLabel.value))
onBeforeUnmount(() => emit('preview', null, ''))

function updateSlider(event: Event) {
  if (event.target instanceof HTMLInputElement) monthlyAmount.value = event.target.value
}

async function compare(focusErrors = true) {
  paymentDate.value = today()
  const oneTimeCents = parseMoney(amount.value)
  const extraMonthlyCents = enteredMonthlyCents.value
  errors.value = {}
  if (!props.loans.some((loan) => loan.id === targetId.value)) errors.value.target = 'Choose a loan for the one-time payment.'
  if (oneTimeCents === null) errors.value.amount = 'Enter $0–$10,000,000 with up to two decimal places, without commas.'
  if (extraMonthlyCents === null) errors.value.monthly = 'Enter $0–$10,000,000 with up to two decimal places, without commas.'
  if (strategy.value !== 'highest-rate' && strategy.value !== 'smallest-balance') errors.value.strategy = 'Choose a monthly payoff strategy.'
  if (unavailable.value) errors.value.general = unavailable.value
  if (Object.keys(errors.value).length || oneTimeCents === null || extraMonthlyCents === null) {
    if (!focusErrors) return
    await nextTick()
    const firstError = form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?? form.value?.querySelector<HTMLElement>('[role="alert"]')
    let details = firstError?.closest('details') ?? null
    while (details) {
      details.open = true
      details = details.parentElement?.closest('details') ?? null
    }
    firstError?.focus()
    return
  }
  result.value = comparePaymentScenarios(props.loans, { loanId: targetId.value, oneTimeCents, extraMonthlyCents, date: paymentDate.value, strategy: strategy.value })
  selected.value = extraMonthlyCents > 0 ? oneTimeCents > 0 ? 'combined' : 'monthly' : 'one-time'
}

function chooseStrategy(choice: RepaymentStrategy) {
  if (!result.value) return
  result.value = selectPaymentStrategy(result.value, choice)
  strategy.value = choice
}

async function clear() {
  resetting = true
  result.value = null
  amount.value = '0'
  monthlyAmount.value = '0'
  strategy.value = 'highest-rate'
  errors.value = {}
  await nextTick()
  resetting = false
  form.value?.querySelector<HTMLInputElement>('#extra-payment-amount')?.focus()
}
</script>

<template>
  <div class="payment-workspace" :class="{ 'has-chart': embedded && $slots.default }">
    <slot />
    <section id="extra-payment" class="simulator" :class="{ panel: !embedded, embedded }" aria-labelledby="extra-payment-heading" tabindex="-1">
      <h2 id="extra-payment-heading">One-time extra payment</h2>
      <p class="preview-scope sr-only">Payment previews apply to {{ loans.length === 1 ? loans[0]?.name : `the ${loans.length} selected loans` }}.</p>

      <form ref="form" class="scenario-form" novalidate @submit.prevent="compare()">
        <div class="one-time-controls">
          <label class="sr-only" for="extra-payment-amount">One-time extra payment</label>
          <div class="scenario-fields">
            <div class="scenario-field">
              <div class="amount-input"><span aria-hidden="true">$</span><input id="extra-payment-amount" v-model="amount" type="text" inputmode="decimal" required :aria-invalid="!!errors.amount" :aria-describedby="errors.amount ? 'extra-amount-error extra-date-help' : 'extra-date-help'" /></div>
              <p v-if="errors.amount" id="extra-amount-error" class="field-error">{{ errors.amount }}</p>
            </div>
            <div class="scenario-field">
              <label class="sr-only" for="extra-payment-target">Send it to</label>
              <select id="extra-payment-target" v-model="targetId" :aria-invalid="!!errors.target" :aria-describedby="errors.target ? 'extra-target-error' : 'extra-target-help'">
                <option v-for="loan in loans" :key="loan.id" :value="loan.id">{{ loan.name }} · {{ loan.annualRatePercent }}%</option>
              </select>
              <p v-if="errors.target" id="extra-target-error" class="field-error">{{ errors.target }}</p>
            </div>
          </div>
          <p id="extra-target-help" class="form-note">Preview only · updates the chart instantly.</p>
        </div>

        <div class="impact-area">
          <PaymentPlanSummary v-if="result" :result="result" :selected="selected" @clear="clear" />
          <div v-else class="summary-placeholder">
            <h3>Payment impact</h3>
            <div class="placeholder-metrics" aria-hidden="true"><span>Interest saved<strong>—</strong></span><span>Payoff change<strong>—</strong></span><span>Debt-free by<strong>—</strong></span></div>
            <p>Enter an amount to see how much interest and time you could save.</p>
            <details class="placeholder-details">
              <summary>Payment details</summary>
              <p data-testid="monthly-budget">{{ budgetCents === null ? 'Enter a valid monthly amount to see your budget.' : `${money(minimumCents)} minimums + ${money(enteredMonthlyCents ?? 0)} extra = ${money(budgetCents)} starting monthly budget` }}</p>
            </details>
          </div>
        </div>

        <details class="monthly-options">
          <summary>Extra monthly payments <span v-if="enteredMonthlyCents && enteredMonthlyCents > 0">· {{ money(enteredMonthlyCents) }}/mo</span></summary>
          <div class="monthly-controls">
            <label for="extra-monthly-amount">Extra monthly budget</label>
            <div class="amount-input monthly-input"><span aria-hidden="true">$</span><input id="extra-monthly-amount" v-model="monthlyAmount" type="text" inputmode="decimal" required :aria-invalid="!!errors.monthly" :aria-describedby="errors.monthly ? 'extra-monthly-error monthly-help' : 'monthly-help'" /></div>
            <p v-if="errors.monthly" id="extra-monthly-error" class="field-error">{{ errors.monthly }}</p>
            <label class="sr-only" for="extra-monthly-slider">Adjust extra monthly payment</label>
            <input id="extra-monthly-slider" type="range" min="0" :max="sliderMaximum" step="0.01" :value="(enteredMonthlyCents ?? 0) / 100" :aria-valuetext="`${money(enteredMonthlyCents ?? 0)} extra per month`" aria-describedby="monthly-help" @input="updateSlider" />
            <p class="form-note">Added on top of your selected loans’ minimums, not per loan.</p>
          </div>
          <div class="strategy-field">
            <PaymentStrategyPicker v-model="strategy" />
            <p v-if="errors.strategy" id="strategy-error" class="field-error">{{ errors.strategy }}</p>
            <div class="strategy-target" aria-live="polite" aria-atomic="true">
              <template v-if="result && result.request.extraMonthlyCents > 0">
                <p>First allocation · {{ formatDate(result.recurringStartDate) }}</p>
                <ul v-if="firstMonthlyAllocation.length">
                  <li v-for="target in firstMonthlyAllocation" :key="target.id"><strong>{{ target.name }}</strong><span>{{ money(target.amountCents) }}</span></li>
                </ul>
                <p v-else>No active balance remains for the extra budget on this date.</p>
              </template>
              <p v-else>Add an extra monthly budget to see which loans it targets first.</p>
            </div>
          </div>
        </details>
        <details class="payment-rules" :open="!embedded">
          <summary>How extra payments are allocated</summary>
          <p id="monthly-help" class="form-note">{{ startDate ? `Starts ${formatDate(startDate)}, then monthly on that date’s day, adjusted for shorter months.` : '' }} This is one extra amount for the plan, not per loan. {{ strategyNames[strategy] }}; all minimums keep their own due dates. A positive monthly increase also rolls freed minimums forward on their original due dates.</p>
          <p id="strategy-help" class="form-note">Choose how extra monthly money and freed minimums are allocated. Both strategies pay every minimum first. Smallest balance includes unpaid interest. Strategy does not change your one-time target or enable rollover when extra monthly is $0.</p>
          <p id="extra-date-help" class="form-note">Modeled for today, {{ formatDate(paymentDate) }}. Applied to unpaid interest first, then principal. Scheduled minimums continue unless the loan is paid off.</p>
        </details>
        <p v-if="unavailable && !errors.general" class="date-warning">{{ unavailable }}</p>
        <p v-if="Object.keys(errors).length" class="field-error" role="alert" tabindex="-1">{{ errors.general ?? 'Check the highlighted fields before comparing.' }}</p>
        <p v-if="hasChanges" class="date-warning" role="status">Invalid inputs aren’t applied; the chart and results still show your last valid comparison.</p>
      </form>

      <p v-if="!embedded" class="simulator-footnote">These are hypothetical payments, not transactions. Your baseline and entered balances stay unchanged. Loan edits clear this scenario. We don’t model paid-ahead status; check your servicer’s overpayment instructions.</p>
    </section>
  </div>
  <section v-if="result" class="panel plan-comparison" aria-labelledby="plan-comparison-heading">
    <h2 id="plan-comparison-heading">Compare all plans</h2>
    <details v-if="embedded" class="comparison-details">
      <summary>View plans and schedules</summary>
      <ScenarioComparison :result="result" :selected="selected" :show-chart="false" @select="selected = $event" @strategy="chooseStrategy" @clear="clear" />
    </details>
    <ScenarioComparison v-else :result="result" :selected="selected" @select="selected = $event" @strategy="chooseStrategy" @clear="clear" />
  </section>
</template>

<style scoped>
.payment-workspace { min-width: 0; }
.payment-workspace.has-chart { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; align-items: start; gap: var(--space-5); }
.simulator { min-width: 0; padding: var(--space-4); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); }
.comparison-details { margin-top: var(--space-3); }
.one-time-controls .form-note { margin: var(--space-2) 0 0; }
summary { cursor: pointer; color: var(--text-link); font-size: var(--font-xs); line-height: 1.7; }
.impact-area, .summary-placeholder { min-block-size: var(--size-payment-impact); }
.summary-placeholder { padding: var(--space-3); border-radius: var(--radius-sm); background: var(--surface-muted); color: var(--text-secondary); font-size: var(--font-xs); line-height: 1.6; }
.summary-placeholder h3 { min-block-size: 2.4rem; margin: 0 0 var(--space-3); font-size: var(--font-xs); color: var(--text); }
.summary-placeholder p { margin: 0; }
.placeholder-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); min-block-size: 4rem; }
.placeholder-metrics strong { display: block; margin-top: var(--space-2); font-size: var(--font-md); }
.placeholder-details { margin-top: var(--space-2); }
.plan-comparison { padding: var(--space-5); min-width: 0; }
.strategy-target { padding: var(--space-3); background: var(--surface-muted); border-radius: var(--radius-sm); font-size: var(--font-xs); color: var(--text-secondary); line-height: 1.6; }
.strategy-target p { margin: 0; }
.strategy-target p:last-child:not(:first-child) { margin-top: var(--space-2); }
.strategy-target ul { padding: 0; margin: var(--space-2) 0; list-style: none; }
.strategy-target li { display: flex; justify-content: space-between; gap: var(--space-3); }
.strategy-target strong { color: var(--text); overflow-wrap: anywhere; }
.strategy-target span { white-space: nowrap; font-variant-numeric: tabular-nums; }
h2 { font-size: var(--font-md); }
.form-note, .simulator-footnote { color: var(--text-muted); font-size: var(--font-xs); line-height: 1.6; }
.scenario-form { display: grid; gap: var(--space-3); margin-top: var(--space-3); }
.scenario-form > * { min-width: 0; }
.scenario-fields { display: grid; grid-template-columns: 6rem minmax(0, 1fr); gap: var(--space-2); align-items: start; }
.scenario-field { min-width: 0; }
label { display: block; font-size: var(--font-xs); font-weight: 600; line-height: 1.6; margin-bottom: var(--space-2); }
input:not([type='range']), select { min-width: 0; width: 100%; height: var(--size-touch-target); padding: var(--space-3); background: var(--surface); color: var(--text); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); font-size: var(--font-sm); }
input[aria-invalid='true'], select[aria-invalid='true'] { border-color: var(--danger); }
.amount-input { position: relative; }
.amount-input > span { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: var(--font-sm); pointer-events: none; }
.amount-input input { padding-left: 1.7rem; }
.monthly-controls { min-width: 0; margin-top: var(--space-3); }
.monthly-input { width: 7rem; }
input[type='range'] { display: block; width: 100%; min-height: 2.5rem; margin: var(--space-3) 0 0; accent-color: var(--chart-line); cursor: pointer; }
.strategy-field { display: grid; gap: var(--space-3); border-top: 1px solid var(--border); margin-top: var(--space-3); padding-top: var(--space-3); }
.field-error { color: var(--danger); font-size: var(--font-xs); line-height: 1.7; margin: var(--space-2) 0 0; }
.date-warning { background: var(--blue-light); border: 1px solid var(--blue-border); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); color: var(--text-secondary); font-size: var(--font-xs); line-height: 1.8; }
.simulator-footnote { margin: var(--space-5) 0 0; padding-top: var(--space-4); border-top: 1px solid var(--border); }
@media (max-width: 60rem) { .payment-workspace.has-chart { grid-template-columns: 1fr; } }
</style>
