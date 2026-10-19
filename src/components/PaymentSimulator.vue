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

watch([targetId, amount, monthlyAmount, strategy], () => {
  if (!resetting) void compare(false)
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
  form.value?.querySelector<HTMLInputElement>(props.embedded ? '#extra-monthly-amount' : '#extra-payment-amount')?.focus()
}
</script>

<template>
  <section id="extra-payment" class="simulator" :class="{ panel: !embedded, embedded }" aria-labelledby="extra-payment-heading" tabindex="-1">
    <div class="simulator-heading">
      <div>
        <p v-if="!embedded" class="eyebrow">TODAY’S EXTRA. TOMORROW’S HABIT.</p>
        <h2 id="extra-payment-heading">What could paying more change?</h2>
        <p class="section-intro">Adjust the amount to update the chart live. Your saved minimums stay unchanged.</p>
      </div>
    </div>

    <form ref="form" class="scenario-form" novalidate @submit.prevent="compare()">
      <div class="monthly-controls">
        <div class="monthly-heading">
          <label for="extra-monthly-amount">Extra monthly budget</label>
          <div class="amount-input monthly-input">
            <span aria-hidden="true">$</span>
            <input id="extra-monthly-amount" v-model="monthlyAmount" type="text" inputmode="decimal" required :aria-invalid="!!errors.monthly" :aria-describedby="errors.monthly ? 'extra-monthly-error monthly-help' : 'monthly-help'" />
          </div>
        </div>
        <p v-if="errors.monthly" id="extra-monthly-error" class="field-error">{{ errors.monthly }}</p>
        <label class="sr-only" for="extra-monthly-slider">Adjust extra monthly payment</label>
        <input id="extra-monthly-slider" type="range" min="0" :max="sliderMaximum" step="0.01" :value="(enteredMonthlyCents ?? 0) / 100" :aria-valuetext="`${money(enteredMonthlyCents ?? 0)} extra per month`" aria-describedby="monthly-help" @input="updateSlider" />
        <div class="slider-labels" aria-hidden="true"><span>$0 extra</span><span>{{ money(sliderMaximum * 100) }} extra</span></div>
        <p class="form-note">One extra amount for your whole plan, not for each loan.</p>
      </div>
      <div class="one-time-controls">
        <label for="extra-payment-amount">One-time extra payment</label>
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
        <p id="extra-target-help" class="form-note">Switch loans to instantly compare the impact of the same extra money.</p>
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
            <p>Extra money and freed minimums follow this strategy as balances change.</p>
          </template>
          <p v-else>Add an extra monthly budget to see which loans it targets first.</p>
        </div>
      </div>
      <PaymentPlanSummary v-if="result" :result="result" :selected="selected" @clear="clear" />
      <div v-else class="summary-placeholder">
        <p data-testid="monthly-budget">{{ budgetCents === null ? 'Enter a valid monthly amount to see your budget.' : `${money(minimumCents)} minimums + ${money(enteredMonthlyCents ?? 0)} extra = ${money(budgetCents)} starting monthly budget` }}</p>
        <p>Enter an extra payment to see how much interest and time you could save.</p>
      </div>
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
  <slot />
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
.simulator { padding: var(--space-5); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); }
.simulator.embedded { margin: 0; }
.embedded h2 { font-size: var(--font-lg); }
.embedded .section-intro { font-size: var(--font-xs); margin-top: var(--space-2); }
.embedded .simulator-heading { gap: var(--space-2); }
.embedded .scenario-form { margin-top: var(--space-4); }
.embedded .monthly-controls { padding: 0; border: 0; margin: 0; }
.payment-rules, .comparison-details { margin-top: var(--space-3); }
.one-time-controls { padding-left: var(--space-5); border-left: 1px solid var(--border); }
.one-time-controls .form-note { margin-bottom: 0; }
summary { cursor: pointer; color: var(--text-link); font-size: var(--font-xs); line-height: 1.7; }
.payment-summary, .summary-placeholder { grid-column: 1 / -1; }
.summary-placeholder { padding: var(--space-4); border-radius: var(--radius-sm); background: var(--surface-muted); color: var(--text-secondary); font-size: var(--font-xs); line-height: 1.7; }
.summary-placeholder p { margin: 0; }
.plan-comparison { padding: var(--space-5); min-width: 0; }
.strategy-target { grid-column: 2; grid-row: 1; padding: var(--space-3); background: var(--surface-muted); border-radius: var(--radius-sm); font-size: var(--font-xs); color: var(--text-secondary); line-height: 1.6; }
.strategy-target p { margin: 0; }
.strategy-target p:last-child:not(:first-child) { margin-top: var(--space-2); }
.strategy-target ul { padding: 0; margin: var(--space-2) 0; list-style: none; }
.strategy-target li { display: flex; justify-content: space-between; gap: var(--space-3); }
.strategy-target strong { color: var(--text); overflow-wrap: anywhere; }
.strategy-target span { white-space: nowrap; font-variant-numeric: tabular-nums; }
.simulator-heading { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: var(--space-4); }
h2 { font-size: clamp(1.4rem, 3vw, 1.85rem); letter-spacing: -0.04em; }
.section-intro, .form-note, .simulator-footnote { color: var(--text-muted); font-size: var(--font-xs); line-height: 1.8; }
.section-intro { font-size: var(--font-sm); margin: var(--space-3) 0 0; }
.scenario-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4) var(--space-5); margin-top: var(--space-5); }
.scenario-form > * { min-width: 0; }
.payment-rules, .scenario-form > .date-warning, .scenario-form > .field-error { grid-column: 1 / -1; }
.scenario-fields { display: grid; grid-template-columns: 7rem minmax(0, 1fr); gap: var(--space-2); align-items: start; }
.scenario-field { min-width: 0; }
.scenario-field input, .scenario-field select { height: 3rem; }
label { display: block; font-size: var(--font-xs); font-weight: 600; line-height: 1.6; margin-bottom: var(--space-2); }
input:not([type='range']), select { min-width: 0; width: 100%; height: 3rem; padding: var(--space-3); background: var(--surface); color: var(--text); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); font-size: var(--font-sm); }
input[aria-invalid='true'], select[aria-invalid='true'] { border-color: var(--danger); }
.amount-input { position: relative; }
.amount-input > span { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: var(--font-sm); pointer-events: none; }
.amount-input input { padding-left: 1.7rem; }
.monthly-controls { min-width: 0; }
.monthly-input { width: 7rem; }
input[type='range'] { display: block; width: 100%; min-height: 2.5rem; margin: var(--space-3) 0 0; accent-color: var(--chart-line); cursor: pointer; }
.slider-labels { display: flex; justify-content: space-between; color: var(--text-muted); font-size: var(--font-xs); }
.strategy-field { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); align-items: end; gap: var(--space-4); border-top: 1px solid var(--border); padding-top: var(--space-4); }
.strategy-field > .field-error { grid-column: 1 / -1; }
.field-error { color: var(--danger); font-size: var(--font-xs); line-height: 1.7; margin: var(--space-2) 0 0; }
.date-warning { background: var(--blue-light); border: 1px solid var(--blue-border); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); color: var(--text-secondary); font-size: var(--font-xs); line-height: 1.8; }
.simulator-footnote { margin: var(--space-5) 0 0; padding-top: var(--space-4); border-top: 1px solid var(--border); }
@media (max-width: 48rem) { .scenario-form, .strategy-field { grid-template-columns: 1fr; } .strategy-target { grid-column: auto; grid-row: auto; } .one-time-controls { padding: var(--space-4) 0 0; border-left: 0; border-top: 1px solid var(--border); } }
@media (max-width: 35rem) { .simulator, .plan-comparison { padding: var(--space-4); } }
</style>
