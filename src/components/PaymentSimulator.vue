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
const chartLabel = computed(() => {
  if (selected.value === 'one-time') return 'With one-time payment'
  const label = selected.value === 'monthly' ? 'With extra monthly payments' : 'With one-time + monthly payments'
  return `${label} · ${strategyNames[strategy.value]}`
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
      <span class="hypothetical-badge">WHAT-IF · NOT A REAL PAYMENT</span>
    </div>

    <form ref="form" class="scenario-form" novalidate @submit.prevent="compare()">
      <div class="monthly-controls">
        <div class="monthly-heading">
          <div><p class="eyebrow">THE MONTHLY DIFFERENCE</p><label for="extra-monthly-amount">Extra per month, across all loans</label></div>
          <div class="amount-input monthly-input">
            <span aria-hidden="true">$</span>
            <input id="extra-monthly-amount" v-model="monthlyAmount" type="text" inputmode="decimal" required :aria-invalid="!!errors.monthly" :aria-describedby="errors.monthly ? 'extra-monthly-error monthly-help' : 'monthly-help'" />
          </div>
        </div>
        <p v-if="errors.monthly" id="extra-monthly-error" class="field-error">{{ errors.monthly }}</p>
        <label class="sr-only" for="extra-monthly-slider">Adjust extra monthly payment</label>
        <input id="extra-monthly-slider" type="range" min="0" :max="sliderMaximum" step="0.01" :value="(enteredMonthlyCents ?? 0) / 100" :aria-valuetext="`${money(enteredMonthlyCents ?? 0)} extra per month`" aria-describedby="monthly-help" @input="updateSlider" />
        <div class="slider-labels" aria-hidden="true"><span>$0 extra</span><span>{{ money(sliderMaximum * 100) }} extra</span></div>
        <p class="monthly-budget" data-testid="monthly-budget">{{ budgetCents === null ? 'Enter a valid monthly amount to see your budget.' : `${money(minimumCents)} minimums + ${money(enteredMonthlyCents ?? 0)} extra = ${money(budgetCents)} starting monthly budget` }}</p>
      </div>
      <details class="advanced-payment-options" :open="!embedded">
        <summary v-if="embedded">One-time payments and strategy</summary>
        <div class="strategy-field">
          <label for="repayment-strategy">Monthly payoff strategy</label>
          <select id="repayment-strategy" v-model="strategy" required :aria-invalid="!!errors.strategy" :aria-describedby="errors.strategy ? 'strategy-error strategy-help' : 'strategy-help'">
            <option value="highest-rate">Highest rate first (avalanche)</option>
            <option value="smallest-balance">Smallest balance first (snowball)</option>
          </select>
          <p v-if="errors.strategy" id="strategy-error" class="field-error">{{ errors.strategy }}</p>
        </div>
        <details class="payment-rules" :open="!embedded">
          <summary v-if="embedded">How extra payments are allocated</summary>
          <p id="monthly-help" class="form-note">{{ startDate ? `Starts ${formatDate(startDate)}, then monthly on that date’s day, adjusted for shorter months.` : '' }} This is one extra amount for the plan, not per loan. {{ strategyNames[strategy] }}; all minimums keep their own due dates. A positive monthly increase also rolls freed minimums forward on their original due dates.</p>
          <p id="strategy-help" class="form-note">Choose how extra monthly money and freed minimums are allocated. Both strategies pay every minimum first. Smallest balance includes unpaid interest. Strategy does not change your one-time target or enable rollover when extra monthly is $0.</p>
        </details>

        <details class="one-time-options" :open="!embedded">
          <summary v-if="embedded">Add a one-time payment</summary>
          <div class="scenario-fields">
            <div class="scenario-field">
              <label for="extra-payment-target">One-time payment target</label>
              <select id="extra-payment-target" v-model="targetId" :aria-invalid="!!errors.target" :aria-describedby="errors.target ? 'extra-target-error' : undefined">
                <option v-for="(loan, index) in loans" :key="loan.id" :value="loan.id">{{ index + 1 }}. {{ loan.name }} · {{ loan.annualRatePercent }}%</option>
              </select>
              <p v-if="errors.target" id="extra-target-error" class="field-error">{{ errors.target }}</p>
            </div>
            <div class="scenario-field">
              <label for="extra-payment-amount">One-time extra payment</label>
              <div class="amount-input"><span aria-hidden="true">$</span><input id="extra-payment-amount" v-model="amount" type="text" inputmode="decimal" required :aria-invalid="!!errors.amount" :aria-describedby="errors.amount ? 'extra-amount-error extra-date-help' : 'extra-date-help'" /></div>
              <p v-if="errors.amount" id="extra-amount-error" class="field-error">{{ errors.amount }}</p>
            </div>
          </div>
          <p id="extra-date-help" class="form-note">Modeled for today, {{ formatDate(paymentDate) }}. Applied to unpaid interest first, then principal. Scheduled minimums continue unless the loan is paid off.</p>
        </details>
        <div class="compare-actions"><button class="primary-button" type="submit">Refresh comparison <span aria-hidden="true">→</span></button><p v-if="!embedded" class="form-note">Compare minimums, one-time only, monthly only, and both. Use 0 for either amount to leave it out.</p></div>
      </details>
      <p v-if="unavailable && !errors.general" class="date-warning">{{ unavailable }}</p>
      <p v-if="Object.keys(errors).length" class="field-error" role="alert" tabindex="-1">{{ errors.general ?? 'Check the highlighted fields before comparing.' }}</p>
      <p v-if="hasChanges" class="date-warning" role="status">Invalid inputs aren’t applied; the chart and results still show your last valid comparison.</p>
    </form>

    <template v-if="result">
      <div v-if="embedded" class="live-result">
        <p v-if="selectedPlan?.portfolio.projection.status === 'paid-off'">Preview total <strong>{{ money(selectedPlan.portfolio.projection.totalPaymentsCents) }}</strong><br />Interest <strong>{{ money(selectedPlan.portfolio.projection.remainingInterestCents) }}</strong></p>
        <p v-else>No complete payoff estimate for this preview.</p>
        <button class="text-button" type="button" @click="clear">Reset extra payments</button>
      </div>
      <details v-if="embedded" class="comparison-details">
        <summary>Compare all plans and schedules</summary>
        <ScenarioComparison :result="result" :selected="selected" :show-chart="false" @select="selected = $event" @strategy="chooseStrategy" @clear="clear" />
      </details>
      <ScenarioComparison v-else :result="result" :selected="selected" @select="selected = $event" @strategy="chooseStrategy" @clear="clear" />
    </template>
    <p v-if="!embedded" class="simulator-footnote">These are hypothetical payments, not transactions. Your baseline and entered balances stay unchanged. Loan edits clear this scenario. We don’t model paid-ahead status; check your servicer’s overpayment instructions.</p>
  </section>
</template>

<style scoped>
.simulator { padding: var(--space-7); margin-top: var(--space-7); }
.simulator.embedded { margin: 0; padding: var(--space-4); border: 1px solid var(--blue-border); border-radius: var(--radius-md); background: var(--blue-light); }
.embedded h2 { font-size: var(--font-lg); }
.embedded .section-intro { font-size: var(--font-xs); margin-top: var(--space-2); }
.embedded .hypothetical-badge { padding: 0; border: 0; font-size: 0.55rem; }
.embedded .simulator-heading { gap: var(--space-2); }
.embedded .scenario-form { margin-top: var(--space-4); }
.embedded .monthly-controls { padding: 0; border: 0; margin: 0; }
.embedded .monthly-input { width: 7rem; }
.embedded .monthly-heading label { font-size: var(--font-xs); }
.embedded .monthly-heading .eyebrow { display: none; }
.embedded .monthly-budget { font-size: var(--font-xs); }
.embedded .strategy-field { padding-top: var(--space-3); margin-top: var(--space-3); }
.embedded .scenario-fields { grid-template-columns: 1fr; margin-top: var(--space-3); }
.embedded .compare-actions { margin-top: var(--space-3); }
.embedded .compare-actions button { width: 100%; padding-block: var(--space-2); }
.payment-rules, .one-time-options, .comparison-details, .advanced-payment-options { margin-top: var(--space-3); }
summary { cursor: pointer; color: var(--text-link); font-size: var(--font-xs); line-height: 1.7; }
.live-result { margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--blue-border); font-size: var(--font-sm); line-height: 1.8; }
.live-result p { margin: 0; }
.embedded :deep(.comparison-results) { margin-top: var(--space-3); padding-top: var(--space-3); }
.embedded :deep(.plan-grid), .embedded :deep(.savings-grid), .embedded :deep(.allocation-grid) { grid-template-columns: 1fr; }
.simulator-heading, .monthly-heading, .compare-actions { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: var(--space-4); }
h2 { font-size: clamp(1.4rem, 3vw, 1.85rem); letter-spacing: -0.04em; }
.section-intro, .form-note, .simulator-footnote { color: var(--text-muted); font-size: var(--font-xs); line-height: 1.8; }
.section-intro { font-size: var(--font-sm); margin: var(--space-3) 0 0; }
.hypothetical-badge { border: 1px solid var(--blue-border); border-radius: var(--radius-full); background: var(--blue-light); color: var(--text-link); padding: var(--space-2) var(--space-3); font-size: 0.6rem; font-weight: 600; letter-spacing: 0.07em; }
.scenario-form { margin-top: var(--space-6); }
.scenario-fields { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(10rem, 1fr); gap: var(--space-4); align-items: start; }
.scenario-field { min-width: 0; }
label { display: block; font-size: var(--font-xs); font-weight: 600; margin-bottom: var(--space-2); }
input:not([type='range']), select { min-width: 0; width: 100%; min-height: 2.9rem; padding: var(--space-3); background: var(--surface); color: var(--text); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); font-size: var(--font-sm); }
input[aria-invalid='true'], select[aria-invalid='true'] { border-color: var(--danger); }
.amount-input { position: relative; }
.amount-input > span { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: var(--font-sm); pointer-events: none; }
.amount-input input { padding-left: 1.7rem; }
.monthly-controls { padding: var(--space-5); border: 1px solid var(--blue-border); background: var(--blue-light); border-radius: var(--radius-md); margin-top: var(--space-5); }
.monthly-heading { align-items: center; }
.monthly-heading label { margin: 0; font-size: var(--font-sm); }
.monthly-input { width: 10rem; }
input[type='range'] { display: block; width: 100%; min-height: 2.5rem; margin: var(--space-3) 0 0; accent-color: var(--chart-line); cursor: pointer; }
.slider-labels { display: flex; justify-content: space-between; color: var(--text-muted); font-size: var(--font-xs); }
.monthly-budget { margin: var(--space-3) 0 0; font-size: var(--font-sm); font-weight: 600; line-height: 1.8; }
.strategy-field { margin-top: var(--space-4); border-top: 1px solid var(--blue-border); padding-top: var(--space-4); }
.compare-actions { align-items: center; justify-content: start; margin-top: var(--space-5); }
.compare-actions button { display: flex; justify-content: space-between; gap: var(--space-5); }
.compare-actions p { flex: 1; margin: 0; min-width: 12rem; }
.field-error { color: var(--danger); font-size: var(--font-xs); line-height: 1.7; margin: var(--space-2) 0 0; }
.date-warning { background: var(--blue-light); border: 1px solid var(--blue-border); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); color: var(--text-secondary); font-size: var(--font-xs); line-height: 1.8; }
.simulator-footnote { margin: var(--space-5) 0 0; padding-top: var(--space-4); border-top: 1px solid var(--border); }
@media (max-width: 35rem) { .simulator { padding: var(--space-4); } .scenario-fields { grid-template-columns: 1fr; } .monthly-input { width: 100%; } .compare-actions button { width: 100%; } }
</style>
