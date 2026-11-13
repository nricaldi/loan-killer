<script setup lang="ts">
import { vZeroOnFocus } from '../directives/zeroOnFocus'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { today } from '../domain/dates'
import { parseMoney } from '../domain/loanForm'
import { oneTimePaymentAvailability } from '../domain/oneTimePayment'
import type { ExtraScenarioId } from '../domain/paymentScenarios'
import type { LoanRecord, PortfolioProjection } from '../domain/portfolio'
import { recommendPayments, type PaymentRecommendations } from '../domain/paymentRecommendations'
import { dateDistance, formatDate, money } from '../format'
import ScenarioComparison from './ScenarioComparison.vue'
import PaymentRecommendationDetails from './PaymentRecommendationDetails.vue'
import PaymentPlanSummary from './PaymentPlanSummary.vue'

const props = defineProps<{ loans: readonly LoanRecord[] }>()
const emit = defineEmits<{ preview: [portfolio: PortfolioProjection | null, label: string] }>()
let resetting = false
type SavingCard = { id: number; kind: 'monthly' | 'one-time'; amount: string }
const cards = ref<SavingCard[]>([])
let nextCardId = 0
function total(kind: SavingCard['kind']) {
  const amounts = cards.value.filter(card => card.kind === kind).map(card => parseMoney(card.amount))
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
const enteredOneTimeCents = computed(() => parseMoney(amount.value))
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
onBeforeUnmount(() => emit('preview', null, ''))

function inputId(card: SavingCard) {
  const first = cards.value.find(item => item.kind === card.kind)
  const base = card.kind === 'monthly' ? 'extra-monthly-amount' : 'extra-payment-amount'
  return first?.id === card.id ? base : `${base}-${card.id}`
}
async function addCard(kind: SavingCard['kind']) {
  const card: SavingCard = { id: ++nextCardId, kind, amount: '0' }
  cards.value.push(card)
  await nextTick()
  const input = document.getElementById(inputId(card))
  input?.focus()
  input?.closest('.saving-card')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
}
async function removeCard(id: number) {
  cards.value = cards.value.filter(card => card.id !== id)
  await nextTick()
  form.value?.querySelector<HTMLButtonElement>('.monthly-choice')?.focus()
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
  cards.value = []
  errors.value = {}
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
        </div>
      </div>
      <form ref="form" class="scenario-form" novalidate @submit.prevent="compare()">
        <div class="add-actions">
          <button class="one-time-choice" type="button" @click="addCard('one-time')">+ Add payment</button>
          <button class="monthly-choice" type="button" @click="addCard('monthly')">+ Add recurring</button>
        </div>
        <div v-if="cards.length" class="exploration-options" role="region" aria-label="Extra payments" tabindex="0">
          <section v-for="(card, index) in cards" :key="card.id" class="saving-card">
            <div class="card-heading">
              <h3>{{ card.kind === 'monthly' ? 'Recurring' : 'One-time payment' }}</h3>
              <button type="button" class="remove-card" :aria-label="`Remove ${card.kind === 'monthly' ? 'recurring' : 'one-time'} payment ${index + 1}`" @click="removeCard(card.id)">×</button>
            </div>
            <label :for="inputId(card)">{{ card.kind === 'monthly' ? 'Extra each month' : 'Pay today' }}</label>
            <div class="amount-input"><span aria-hidden="true">$</span><input :id="inputId(card)" v-model="card.amount" v-zero-on-focus type="text" inputmode="decimal" :aria-invalid="parseMoney(card.amount) === null" :aria-describedby="parseMoney(card.amount) === null ? `card-error-${card.id}` : undefined" /></div>
            <div class="presets" :aria-label="card.kind === 'monthly' ? 'Try an extra monthly amount' : 'Try a one-time amount'"><button v-for="value in (card.kind === 'monthly' ? [25, 50, 100] : [100, 500, 1000])" :key="value" type="button" @click="card.amount = String(value)">${{ value.toLocaleString('en-US') }}</button></div>
            <p v-if="parseMoney(card.amount) === null" :id="`card-error-${card.id}`" class="field-error">Enter a valid amount with up to two decimal places.</p>
          </section>
        </div>
        <p v-else class="empty-options">Try an extra payment to see what you could save.</p>
        <div v-if="monthlyRecommendation && enteredMonthlyCents" class="allocation-recommendation monthly-recommendation"><p v-if="!monthlyRecommendation.option.payoffDate">No complete payoff estimate yet. Try a larger amount.</p><template v-else><p v-for="payment in monthlyRecommendation.firstMonthlyPayments" :key="payment.loanId">Next: <strong>{{ money(payment.amountCents) }} to {{ payment.loanName }}</strong> · {{ formatDate(monthlyRecommendation.result.recurringStartDate) }}</p></template></div>
        <div v-if="oneTimeRecommendation?.option.loanName && enteredOneTimeCents" class="allocation-recommendation one-time-recommendation"><p><strong>Pay {{ money(oneTimeRecommendation.result.oneTime.appliedCents) }} toward {{ oneTimeRecommendation.option.loanName }} today.</strong></p></div>
        <p id="monthly-help" class="sr-only">This is one extra monthly amount across the selected loans, above their minimums. Freed minimums roll forward on their due dates.</p>
        <p id="extra-date-help" class="sr-only">A hypothetical payment today, applied to unpaid interest before principal. Scheduled minimums continue.</p>
        <p v-if="Object.keys(errors).length" class="field-error" role="alert" tabindex="-1">{{ errors.general ?? 'Check the highlighted fields.' }}</p>
        <p v-if="hasChanges" class="date-warning" role="status">Invalid inputs aren’t applied; the chart and results still show your last valid comparison.</p>
        <div v-if="result" class="impact-area">
          <PaymentPlanSummary :result="result" :selected="selected" @clear="clear">
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
.explore-actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3); min-width: 0; }
.preview-scope { margin: 0; color: var(--text-secondary); font-size: var(--font-sm); overflow-wrap: anywhere; }
.add-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3); }
.add-actions button { min-height: 44px; padding: 8px 14px; background: var(--blue-light); color: var(--text-link); border: 0; border-radius: var(--radius-sm); font: inherit; font-size: var(--font-sm); font-weight: 600; }
.exploration-options { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x proximity; padding: 3px 3px 14px; margin-inline: -3px; margin-bottom: 8px; }
.saving-card { flex: 0 0 min(17rem, 85%); min-width: 0; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); scroll-snap-align: start; }
.card-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.card-heading h3 { margin: 0; font-size: var(--font-sm); }
.remove-card { flex: 0 0 44px; height: 44px; border: 0; background: transparent; color: var(--text-secondary); font-size: 24px; }
.empty-options { color: var(--text-secondary); font-size: var(--font-sm); }
.saving-card .presets { flex-wrap: nowrap; gap: 6px; }
.saving-card .presets button { flex: 1; padding-inline: 4px; }
label { display: block; margin-bottom: var(--space-2); font-size: var(--font-sm); font-weight: 600; }
input { width: 100%; min-width: 0; min-height: var(--size-touch-target); padding: var(--space-3); background: var(--surface); color: var(--text); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); font: inherit; }
input[aria-invalid='true'] { border-color: var(--danger); }
.amount-input { position: relative; }
.amount-input > span { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--text-secondary); }
.amount-input input { padding-left: 1.7rem; }
.presets { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }
.presets button { min-height: var(--size-touch-target); padding: var(--space-2) var(--space-3); border: 0; border-radius: var(--radius-sm); color: var(--text-link); background: var(--blue-light); font-size: var(--font-sm); }
.budget-note, .date-warning { font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.5; margin: var(--space-3) 0 0; }
.field-error { margin: var(--space-2) 0 0; color: var(--danger); font-size: var(--font-sm); }
.allocation-recommendation { font-size: var(--font-sm); line-height: 1.5; }
.allocation-recommendation p { margin: 0 0 var(--space-2); color: var(--text-secondary); }
.allocation-recommendation strong { color: var(--highlight-background); }
.allocation-recommendation .recommendation-label { color: var(--text); font-weight: 600; }
.tradeoff { font-size: var(--font-sm); line-height: 1.5; color: var(--text-secondary); }
.impact-area { margin-top: var(--space-5); }
.chart-link { display: inline-block; padding-block: var(--space-3); color: var(--text-link); font-size: var(--font-sm); }
.plan-comparison { margin-top: var(--space-4); }
summary { cursor: pointer; color: var(--text-link); font-size: var(--font-sm); }
.plan-comparison > :deep(section) { margin-top: var(--space-4); }
</style>
