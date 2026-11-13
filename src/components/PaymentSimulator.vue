<script setup lang="ts">
import { vZeroOnFocus } from '../directives/zeroOnFocus'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { today } from '../domain/dates'
import { parseMoney } from '../domain/loanForm'
import { oneTimePaymentAvailability } from '../domain/oneTimePayment'
import type { ExtraScenarioId } from '../domain/paymentScenarios'
import type { LoanRecord, PortfolioProjection } from '../domain/portfolio'
import { recommendPayments, type PaymentRecommendations } from '../domain/paymentRecommendations'
import { dateDistance, money } from '../format'
import ScenarioComparison from './ScenarioComparison.vue'
import PaymentRecommendationDetails from './PaymentRecommendationDetails.vue'
import PaymentPlanSummary from './PaymentPlanSummary.vue'

const props = defineProps<{ loans: readonly LoanRecord[] }>()
const emit = defineEmits<{ preview: [portfolio: PortfolioProjection | null, label: string]; allocations: [items: { loanId: string; monthlyCents: number; oneTimeCents: number }[]] }>()
let resetting = false
type SavingCard = { id: number; kind: 'monthly' | 'one-time'; amount: string }
const initialCards = (): SavingCard[] => [{ id: 1, kind: 'one-time', amount: '0' }, { id: 2, kind: 'monthly', amount: '0' }]
const cards = ref<SavingCard[]>(initialCards())
const parseExtraAmount = (value: string) => value.trim() === '' ? 0 : parseMoney(value)
function total(kind: SavingCard['kind']) {
  const amounts = cards.value.filter(card => card.kind === kind).map(card => parseExtraAmount(card.amount))
  if (amounts.some(value => value === null)) return 'invalid'
  return (amounts.reduce<number>((sum, value) => sum + (value ?? 0), 0) / 100).toFixed(2)
}
const amount = computed(() => total('one-time'))
const monthlyAmount = computed(() => total('monthly'))
const paymentDate = ref(today())
const errors = ref<{ amount?: string; monthly?: string; general?: string }>({})
const form = ref<HTMLFormElement | null>(null)
const selected = ref<ExtraScenarioId>('one-time')
const recommendations = shallowRef<PaymentRecommendations | null>(null)
const activeRecommendation = computed(() => recommendations.value?.plans[selected.value])
const result = computed(() => activeRecommendation.value?.result ?? null)
const comparisonResult = computed(() => result.value ? {
  ...result.value,
  scenarios: result.value.scenarios.map((plan) => {
    if (plan.id === 'minimum') return plan
    return recommendations.value?.plans[plan.id]?.result.scenarios.find((candidate) => candidate.id === plan.id) ?? plan
  }),
} : null)
const unavailable = computed(() => oneTimePaymentAvailability(props.loans, paymentDate.value))
const enteredMonthlyCents = computed(() => parseMoney(monthlyAmount.value))
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
const allocations = computed(() => {
  const recommendation = activeRecommendation.value
  if (!recommendation) return []
  const items = new Map<string, { loanId: string; monthlyCents: number; oneTimeCents: number }>()
  if (selected.value !== 'one-time') for (const payment of recommendation.firstMonthlyPayments) {
    items.set(payment.loanId, { loanId: payment.loanId, monthlyCents: payment.amountCents, oneTimeCents: 0 })
  }
  if (selected.value !== 'monthly' && recommendation.result.oneTime.appliedCents) {
    const loanId = recommendation.result.request.loanId
    const item = items.get(loanId) ?? { loanId, monthlyCents: 0, oneTimeCents: 0 }
    item.oneTimeCents = recommendation.result.oneTime.appliedCents
    items.set(loanId, item)
  }
  return [...items.values()]
})
watch(allocations, value => emit('allocations', value))
onBeforeUnmount(() => { emit('preview', null, ''); emit('allocations', []) })

function inputId(card: SavingCard) {
  const first = cards.value.find(item => item.kind === card.kind)
  const base = card.kind === 'monthly' ? 'extra-monthly-amount' : 'extra-payment-amount'
  return first?.id === card.id ? base : `${base}-${card.id}`
}
async function compare(focusErrors = true) {
  if (!props.loans.length) { recommendations.value = null; errors.value = {}; return }
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
  cards.value = initialCards()
  errors.value = {}
  await nextTick()
  resetting = false
  form.value?.querySelector<HTMLInputElement>('#extra-payment-amount')?.focus()
}
</script>

<template>
  <div class="payment-workspace">
    <div v-if="$slots.default" class="chart-area"><slot /></div>
    <section id="extra-payment" class="simulator" aria-labelledby="extra-payment-heading">
      <div class="explore-heading">
        <h2 id="extra-payment-heading">Explore payments</h2>
        <button class="reset-tools" type="button" aria-label="Reset extra payments" @click="clear">Reset</button>
      </div>
      <form ref="form" class="scenario-form" novalidate @submit.prevent="compare()">
        <div v-if="cards.length" class="exploration-options" role="region" aria-label="Extra payments" tabindex="0">
          <section v-for="card in cards" :key="card.id" class="saving-card" :class="{ active: (parseExtraAmount(card.amount) ?? 0) > 0 }">
            <div class="card-heading">
              <h3>{{ card.kind === 'monthly' ? 'Recurring' : 'One-time payment' }}</h3>
            </div>
            <label class="sr-only" :for="inputId(card)">{{ card.kind === 'monthly' ? 'Extra each month' : 'Pay today' }}</label>
            <div class="amount-input"><span aria-hidden="true">$</span><input :id="inputId(card)" v-model="card.amount" v-zero-on-focus :disabled="!loans.length" type="text" inputmode="decimal" :aria-invalid="parseExtraAmount(card.amount) === null" :aria-describedby="parseExtraAmount(card.amount) === null ? `card-error-${card.id}` : undefined" @blur="card.amount = card.amount.trim() === '' ? '0' : card.amount" /></div>
            <div class="presets" :aria-label="card.kind === 'monthly' ? 'Try an extra monthly amount' : 'Try a one-time amount'"><button v-for="value in (card.kind === 'monthly' ? [25, 50, 100] : [100, 500, 1000])" :key="value" type="button" :disabled="!loans.length" :aria-pressed="parseExtraAmount(card.amount) === value * 100" @click="card.amount = String(value)">${{ value.toLocaleString('en-US') }}</button></div>
            <p v-if="parseExtraAmount(card.amount) === null" :id="`card-error-${card.id}`" class="field-error">Enter a valid amount with up to two decimal places.</p>
          </section>
        </div>
        <p v-else class="empty-options">Try an extra payment to see what you could save.</p>
        <p id="monthly-help" class="sr-only">This is one extra monthly amount across the selected loans, above their minimums. Freed minimums roll forward on their due dates.</p>
        <p id="extra-date-help" class="sr-only">A hypothetical payment today, applied to unpaid interest before principal. Scheduled minimums continue.</p>
        <p v-if="Object.keys(errors).length" class="field-error" role="alert" tabindex="-1">{{ errors.general ?? 'Check the highlighted fields.' }}</p>
        <p v-if="hasChanges" class="date-warning" role="status">Invalid inputs aren’t applied; the chart and results still show your last valid comparison.</p>
        <div v-if="result" class="impact-area">
          <PaymentPlanSummary :result="result" :selected="selected" details-only hide-reset @clear="clear">
            <p v-if="activeRecommendation?.firstMonthlyPayments.length" class="monthly-recommendation">First extra payment: <span v-for="(payment, index) in activeRecommendation.firstMonthlyPayments" :key="payment.loanId">{{ index ? '; ' : '' }}<strong>{{ money(payment.amountCents) }} to {{ payment.loanName }}</strong></span>.</p>
            <PaymentRecommendationDetails v-if="activeRecommendation" :recommendation="activeRecommendation" :selected="selected" embedded />
          </PaymentPlanSummary>

          <p v-if="activeRecommendation?.fastestAlternative" class="tradeoff">An alternative finishes {{ dateDistance(activeRecommendation.option.payoffDate!, activeRecommendation.fastestAlternative.payoffDate!) }} sooner for {{ money(activeRecommendation.fastestAlternative.interestCents! - activeRecommendation.option.interestCents!) }} more interest.</p>
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
.exploration-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 8px; }
.saving-card { min-width: 0; padding: 12px; border: 0; border-radius: var(--radius-sm); background: var(--blue-light); transition: background 160ms ease, box-shadow 160ms ease; }
.saving-card.active { background: var(--blue-primary); }
.saving-card:focus-within { box-shadow: inset 0 0 0 2px var(--chart-line); }
.reset-tools { min-height: 44px; padding: 6px 12px; border: 1px solid var(--blue-border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-link); font: inherit; font-size: 12px; font-weight: 600; }
.card-heading { min-height: 2.8em; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.card-heading h3 { margin: 0; font-size: var(--font-sm); }
.saving-card .presets { flex-wrap: nowrap; gap: 6px; }
.saving-card .presets button { flex: 1; min-height: 32px; padding: 4px; background: var(--surface); font-size: 12px; border-radius: var(--radius-sm); }
.saving-card .presets button[aria-pressed='true'] { background: var(--highlight-background); color: var(--highlight-text); }
.saving-card .presets button:hover:not(:disabled) { box-shadow: inset 0 0 0 1px var(--chart-line); }
@media (prefers-reduced-motion: reduce) { .saving-card { transition: none; } }
@media (pointer: coarse) { .saving-card .presets button { min-height: 44px; } }
label { display: block; margin-bottom: var(--space-2); font-size: var(--font-sm); font-weight: 600; }
input { width: 100%; min-width: 0; min-height: var(--size-touch-target); padding: var(--space-2); background: var(--surface); color: var(--text); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); font: inherit; font-weight: 650; font-size: 18px; }
input[aria-invalid='true'] { border-color: var(--danger); }
.amount-input { position: relative; }
.amount-input > span { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--text-secondary); }
.amount-input input { padding-left: 1.7rem; }
.presets { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }
.presets button { min-height: var(--size-touch-target); padding: var(--space-2) var(--space-3); border: 0; border-radius: var(--radius-sm); color: var(--text-link); background: var(--blue-light); font-size: var(--font-sm); }
.budget-note, .date-warning { font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.5; margin: var(--space-3) 0 0; }
.field-error { margin: var(--space-2) 0 0; color: var(--danger); font-size: var(--font-sm); }
.tradeoff { font-size: var(--font-sm); line-height: 1.5; color: var(--text-secondary); }
.impact-area { margin-top: var(--space-5); }
.chart-link { display: inline-block; padding-block: var(--space-3); color: var(--text-link); font-size: var(--font-sm); }
.plan-comparison { margin-top: var(--space-4); }
summary { cursor: pointer; color: var(--text-link); font-size: var(--font-sm); }
.plan-comparison > :deep(section) { margin-top: var(--space-4); }
</style>
