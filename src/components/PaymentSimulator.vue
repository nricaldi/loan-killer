<script setup lang="ts">
import { vZeroOnFocus } from '../directives/zeroOnFocus'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { today } from '../domain/dates'
import { parseMoney } from '../domain/loanForm'
import { oneTimePaymentAvailability } from '../domain/oneTimePayment'
import type { ExtraScenarioId } from '../domain/paymentScenarios'
import type { LoanRecord, PortfolioProjection } from '../domain/portfolio'
import { recommendPayments, type PaymentRecommendations } from '../domain/paymentRecommendations'
import { formatDate, money } from '../format'
import ScenarioComparison from './ScenarioComparison.vue'
import PaymentRecommendationDetails from './PaymentRecommendationDetails.vue'
import PaymentPlanSummary from './PaymentPlanSummary.vue'

const props = defineProps<{ loans: readonly LoanRecord[] }>()
const emit = defineEmits<{ preview: [portfolio: PortfolioProjection | null, label: string] }>()
let resetting = false
const amount = ref('0')
const monthlyAmount = ref('0')
const paymentDate = ref(today())
const errors = ref<{ amount?: string; monthly?: string; general?: string }>({})
const form = ref<HTMLFormElement | null>(null)
const selected = ref<ExtraScenarioId>('one-time')
const recommendations = shallowRef<PaymentRecommendations | null>(null)
const activeRecommendation = computed(() => recommendations.value?.plans[selected.value])
const result = computed(() => activeRecommendation.value?.result ?? null)
const monthlyRecommendation = computed(() => recommendations.value?.plans[selected.value === 'combined' ? 'combined' : 'monthly'])
const oneTimeRecommendation = computed(() => recommendations.value?.plans[selected.value === 'combined' ? 'combined' : 'one-time'])
const comparisonResult = computed(() => result.value ? {
  ...result.value,
  scenarios: result.value.scenarios.map((plan) => {
    if (plan.id === 'minimum') return plan
    return recommendations.value?.plans[plan.id]?.result.scenarios.find((candidate) => candidate.id === plan.id) ?? plan
  }),
} : null)
const unavailable = computed(() => oneTimePaymentAvailability(props.loans, paymentDate.value))
const minimumCents = computed(() => props.loans.reduce((sum, loan) => sum + loan.monthlyPaymentCents, 0))
const enteredOneTimeCents = computed(() => parseMoney(amount.value))
const enteredMonthlyCents = computed(() => parseMoney(monthlyAmount.value))
const budgetCents = computed(() => enteredMonthlyCents.value === null ? null : minimumCents.value + enteredMonthlyCents.value)
const showMonthly = ref(false)
const showOneTime = ref(false)
const hasChanges = computed(() => result.value !== null && (
  parseMoney(amount.value) !== result.value.request.oneTimeCents
  || enteredMonthlyCents.value !== result.value.request.extraMonthlyCents
))
const selectedPlan = computed(() => result.value?.scenarios.find(({ id }) => id === selected.value))
const chartLabel = computed(() => {
  if (selected.value === 'one-time') return 'With one-time payment'
  const label = selected.value === 'monthly' ? 'With extra monthly payments' : 'With one-time + monthly payments'
  return label
})

watch([() => props.loans, amount, monthlyAmount], ([loans], [previousLoans]) => {
  if (resetting) return
  if (loans !== previousLoans) recommendations.value = null
  void compare(false)
})
watch([result, selected], () => emit('preview', selectedPlan.value?.portfolio ?? null, chartLabel.value))
onBeforeUnmount(() => emit('preview', null, ''))

async function compactAll() {
  showMonthly.value = false
  showOneTime.value = false
  await nextTick()
  form.value?.querySelector<HTMLButtonElement>('.monthly-choice')?.focus()
}

async function toggleOption(option: 'monthly' | 'one-time') {
  const expanded = option === 'monthly' ? showMonthly : showOneTime
  expanded.value = !expanded.value
  if (expanded.value) {
    await nextTick()
    form.value?.querySelector<HTMLInputElement>(option === 'monthly' ? '#extra-monthly-amount' : '#extra-payment-amount')?.focus()
  }
}

async function compare(focusErrors = true) {
  paymentDate.value = today()
  const oneTimeCents = parseMoney(amount.value)
  const extraMonthlyCents = enteredMonthlyCents.value
  errors.value = {}
  if (oneTimeCents === null) errors.value.amount = 'Enter $0–$10,000,000 with up to two decimal places, without commas.'
  if (extraMonthlyCents === null) errors.value.monthly = 'Enter $0–$10,000,000 with up to two decimal places, without commas.'
  if ((oneTimeCents || extraMonthlyCents) && unavailable.value) errors.value.general = unavailable.value
  if (Object.keys(errors.value).length || oneTimeCents === null || extraMonthlyCents === null) {
    if (!focusErrors) return
    await nextTick()
    if (errors.value.monthly) showMonthly.value = true
    if (errors.value.amount) showOneTime.value = true
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
  if (oneTimeCents === 0 && extraMonthlyCents === 0) {
    recommendations.value = null
    return
  }
  recommendations.value = recommendPayments(props.loans, { oneTimeCents, extraMonthlyCents, date: paymentDate.value })
  selected.value = extraMonthlyCents > 0 ? oneTimeCents > 0 ? 'combined' : 'monthly' : 'one-time'
}

async function clear() {
  resetting = true
  recommendations.value = null
  amount.value = '0'
  monthlyAmount.value = '0'
  errors.value = {}
  showMonthly.value = false
  showOneTime.value = false
  await nextTick()
  resetting = false
  form.value?.querySelector<HTMLButtonElement>('.monthly-choice')?.focus()
}
</script>

<template>
  <div class="payment-workspace">
    <div v-if="$slots.default" class="chart-area"><slot /></div>
    <section id="extra-payment" class="simulator" aria-labelledby="extra-payment-heading">
      <div class="explore-heading">
        <h2 id="extra-payment-heading">Find a faster way to pay it off</h2>
        <div class="explore-actions">
          <p class="preview-scope">{{ loans.length === 1 ? loans[0]?.name : `All ${loans.length} loans` }}</p>
          <button v-if="showMonthly || showOneTime" class="compact-all" type="button" @click="compactAll">Compact</button>
        </div>
      </div>
      <form ref="form" class="scenario-form" novalidate @submit.prevent="compare()">
        <div class="exploration-options">
          <section class="explore-option" :class="{ expanded: showMonthly }">
            <button class="option-choice monthly-choice" type="button" :aria-expanded="showMonthly" aria-controls="monthly-controls" @click="toggleOption('monthly')"><span>Pay more each month</span><span v-if="!showMonthly && enteredMonthlyCents !== 0" class="option-amount">{{ enteredMonthlyCents === null ? 'Check amount' : `${money(enteredMonthlyCents)}/mo` }}</span><span class="option-action" aria-hidden="true">{{ showMonthly ? 'Done' : enteredMonthlyCents === 0 ? 'Add' : 'Edit' }}</span></button>
            <div v-show="showMonthly" id="monthly-controls" class="option-controls">
              <div class="amount-field">
                <label for="extra-monthly-amount">How much extra per month?</label>
                <div class="amount-input"><span aria-hidden="true">$</span><input id="extra-monthly-amount" v-model="monthlyAmount" v-zero-on-focus type="text" inputmode="decimal" :aria-invalid="!!errors.monthly" :aria-describedby="errors.monthly ? 'extra-monthly-error monthly-help' : 'monthly-help'" /></div>
                <div class="presets" aria-label="Try an extra monthly amount"><button v-for="value in [25, 50, 100]" :key="value" type="button" @click="monthlyAmount = String(value)">+${{ value.toLocaleString('en-US') }}</button></div>
                <p v-if="errors.monthly" id="extra-monthly-error" class="field-error">{{ errors.monthly }}</p>
                <p v-if="enteredMonthlyCents && budgetCents !== null" class="budget-note">Monthly total: <strong>{{ money(budgetCents) }}</strong>. Payments from paid-off loans roll forward.</p>
              </div>
              <div v-if="monthlyRecommendation" class="allocation-recommendation monthly-recommendation">
                <template v-if="monthlyRecommendation.option.payoffDate">
                  <p class="recommendation-label">{{ monthlyRecommendation.tied ? 'Suggested first payment' : 'Recommended first payment' }}</p>
                  <p v-for="payment in monthlyRecommendation.firstMonthlyPayments" :key="payment.loanId"><strong>{{ money(payment.amountCents) }} to {{ payment.loanName }}</strong></p>
                  <p v-if="monthlyRecommendation.firstMonthlyPayments.length">On {{ formatDate(monthlyRecommendation.result.recurringStartDate) }}. Keep paying minimums on your other active loans.</p>
                  <p v-else>Your one-time payment clears the balance; no extra monthly payment is needed.</p>
                </template>
                <template v-else><p class="recommendation-label">No complete payoff estimate yet</p><p>Try a larger amount to find a plan that pays off.</p></template>
              </div>
            </div>
          </section>
          <section class="explore-option" :class="{ expanded: showOneTime }">
            <button class="option-choice one-time-choice" type="button" :aria-expanded="showOneTime" aria-controls="one-time-controls" @click="toggleOption('one-time')"><span>Make a one-time payment</span><span v-if="!showOneTime && enteredOneTimeCents !== 0" class="option-amount">{{ enteredOneTimeCents === null ? 'Check amount' : money(enteredOneTimeCents) }}</span><span class="option-action" aria-hidden="true">{{ showOneTime ? 'Done' : enteredOneTimeCents === 0 ? 'Add' : 'Edit' }}</span></button>
            <div v-show="showOneTime" id="one-time-controls" class="option-controls">
              <div class="amount-field">
                <label for="extra-payment-amount">How much could you pay today?</label>
                <div class="amount-input"><span aria-hidden="true">$</span><input id="extra-payment-amount" v-model="amount" v-zero-on-focus type="text" inputmode="decimal" :aria-invalid="!!errors.amount" :aria-describedby="errors.amount ? 'extra-amount-error extra-date-help' : 'extra-date-help'" /></div>
                <div class="presets" aria-label="Try a one-time amount"><button v-for="value in [100, 500, 1000]" :key="value" type="button" @click="amount = String(value)">${{ value.toLocaleString('en-US') }}</button></div>
                <p v-if="errors.amount" id="extra-amount-error" class="field-error">{{ errors.amount }}</p>
              </div>
              <div v-if="oneTimeRecommendation" class="allocation-recommendation one-time-recommendation">
                <template v-if="oneTimeRecommendation.option.payoffDate">
                  <p class="recommendation-label">{{ oneTimeRecommendation.tied ? 'Suggested payment' : 'Recommended payment' }}</p>
                  <p><strong>Pay {{ money(oneTimeRecommendation.result.oneTime.appliedCents) }} toward {{ oneTimeRecommendation.option.loanName }} today.</strong></p>
                </template>
                <template v-else><p class="recommendation-label">No complete payoff estimate yet</p><p>Try a larger amount to find a plan that pays off.</p></template>
              </div>
            </div>
          </section>
        </div>
        <p id="monthly-help" class="sr-only">This is one extra monthly amount across the selected loans, above their minimums. Freed minimums roll forward on their due dates.</p>
        <p id="extra-date-help" class="sr-only">A hypothetical payment today, applied to unpaid interest before principal. Scheduled minimums continue.</p>
        <p v-if="Object.keys(errors).length" class="field-error" role="alert" tabindex="-1">{{ errors.general ?? 'Check the highlighted fields.' }}</p>
        <p v-if="hasChanges" class="date-warning" role="status">Invalid inputs aren’t applied; the chart and results still show your last valid comparison.</p>
        <div v-if="result" class="impact-area">
          <PaymentPlanSummary :result="result" :selected="selected" @clear="clear" />
          <p v-if="!showMonthly && activeRecommendation && activeRecommendation.firstMonthlyPayments.length" class="compact-allocation">First extra payment: <span v-for="(payment, index) in activeRecommendation.firstMonthlyPayments" :key="payment.loanId">{{ index ? '; ' : '' }}<strong>{{ money(payment.amountCents) }} to {{ payment.loanName }}</strong></span>, on {{ formatDate(activeRecommendation.result.recurringStartDate) }}.</p>
          <PaymentRecommendationDetails v-if="activeRecommendation" :recommendation="activeRecommendation" :selected="selected" />
          <a class="chart-link" href="#outlook-heading">See this on the chart ↑</a>
        </div>
      </form>
      <details v-if="result && result.request.oneTimeCents > 0 && result.request.extraMonthlyCents > 0" class="plan-comparison">
        <summary>Compare payment options</summary>
        <ScenarioComparison v-if="comparisonResult" :result="comparisonResult" :selected="selected" @select="selected = $event" />
      </details>
    </section>
  </div>
</template>

<style scoped>
.payment-workspace { display: grid; gap: var(--space-6); min-width: 0; }
.chart-area { min-width: 0; }
.simulator { min-width: 0; }
.explore-heading { display: flex; align-items: baseline; flex-wrap: wrap; justify-content: space-between; gap: var(--space-2); margin-bottom: var(--space-4); }
.explore-actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3); min-width: 0; }
.compact-all { min-height: var(--size-touch-target); padding: var(--space-2) 0; border: 0; background: transparent; color: var(--text-link); font-size: var(--font-sm); text-decoration: underline; text-underline-offset: 0.2em; }
.preview-scope { margin: 0; color: var(--text-secondary); font-size: var(--font-sm); overflow-wrap: anywhere; }
.exploration-options { border-top: 1px solid var(--border-strong); }
.explore-option { min-width: 0; border-bottom: 1px solid var(--border-strong); }
.option-choice { display: flex; align-items: center; gap: var(--space-3); width: 100%; min-height: 3.5rem; padding: var(--space-3) 0; border: 0; background: transparent; color: var(--text); text-align: left; font-weight: 600; }
.option-choice > :first-child { flex: 1; min-width: 0; }
.option-amount { color: var(--text-link); font-variant-numeric: tabular-nums; white-space: nowrap; font-size: var(--font-sm); }
.option-action { color: var(--text-link); font-size: var(--font-sm); font-weight: 400; text-decoration: underline; text-underline-offset: 0.2em; }
.option-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); align-items: start; padding: 0 0 var(--space-4); }
.amount-field, .allocation-recommendation { min-width: 0; }
label { display: block; margin-bottom: var(--space-2); font-size: var(--font-sm); font-weight: 600; }
input { width: 100%; min-width: 0; min-height: var(--size-touch-target); padding: var(--space-3); background: var(--surface); color: var(--text); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); font: inherit; }
input[aria-invalid='true'] { border-color: var(--danger); }
.amount-input { position: relative; }
.amount-input > span { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--text-secondary); }
.amount-input input { padding-left: 1.7rem; }
.presets { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }
.presets button { min-height: var(--size-touch-target); padding: var(--space-2) var(--space-3); border: 1px solid var(--blue-border); border-radius: var(--radius-sm); color: var(--text-link); background: var(--surface); font-size: var(--font-sm); }
.budget-note, .date-warning { font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.5; margin: var(--space-3) 0 0; }
.field-error { margin: var(--space-2) 0 0; color: var(--danger); font-size: var(--font-sm); }
.allocation-recommendation { padding-top: var(--space-1); font-size: var(--font-sm); line-height: 1.5; }
.allocation-recommendation p { margin: 0 0 var(--space-2); color: var(--text-secondary); }
.allocation-recommendation strong { color: var(--highlight-background); }
.allocation-recommendation .recommendation-label { color: var(--text); font-weight: 600; }
.compact-allocation { color: var(--text-secondary); font-size: var(--font-sm); line-height: 1.5; }
.impact-area { margin-top: var(--space-5); }
.chart-link { display: inline-block; padding-block: var(--space-3); color: var(--text-link); font-size: var(--font-sm); }
.plan-comparison { margin-top: var(--space-4); }
summary { cursor: pointer; color: var(--text-link); font-size: var(--font-sm); }
.plan-comparison > :deep(section) { margin-top: var(--space-4); }
@media (max-width: 40rem) { .option-controls { grid-template-columns: 1fr; } .option-choice { font-size: var(--font-sm); } }
</style>
