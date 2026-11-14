<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { today } from '../domain/dates'
import { parseMoney } from '../domain/loanForm'
import { oneTimePaymentAvailability } from '../domain/oneTimePayment'
import type { ExtraScenarioId } from '../domain/paymentScenarios'
import { projectPortfolio, type LoanRecord, type PortfolioProjection } from '../domain/portfolio'
import { recommendPayments, type PaymentRecommendations } from '../domain/paymentRecommendations'
import { dateDistance, money } from '../format'
import { goalMonthEnd, monthlyExtraForGoal } from '../domain/payoffGoal'
import PaymentControls from './PaymentControls.vue'
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
  if (loans !== previousLoans || !applyingGoal) cancelGoal()
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

const goalMonth = ref('')
const goalBusy = ref(false)
const goalStatus = ref('')
let goalTimer: ReturnType<typeof setTimeout> | undefined
let goalWorker: Worker | undefined
let goalGeneration = 0
let applyingGoal = false
const baselinePortfolio = computed(() => projectPortfolio(props.loans))
const goalAnchor = computed(() => props.loans.reduce((date, loan) => loan.balanceDate > date ? loan.balanceDate : date, today()))
function monthDistance(start: string, end: string) {
  return (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5, 7)) - Number(start.slice(5, 7))
}
const goalMaxMonths = computed(() => {
  const baseline = baselinePortfolio.value?.projection
  return Math.min(1200, Math.max(12, baseline?.status === 'paid-off' ? monthDistance(goalAnchor.value, baseline.payoffDate) : 600))
})
const actualPayoff = computed(() => selectedPlan.value?.portfolio.projection ?? baselinePortfolio.value?.projection)
const displayedGoalMonth = computed(() => goalMonth.value || (actualPayoff.value?.status === 'paid-off' ? actualPayoff.value.payoffDate.slice(0, 7) : ''))
function cancelGoal(clearMonth = true) {
  goalGeneration++
  clearTimeout(goalTimer)
  goalWorker?.terminate()
  goalWorker = undefined
  goalBusy.value = false
  goalStatus.value = ''
  if (clearMonth) goalMonth.value = ''
}
function updateAmount(id: number, value: string) {
  cancelGoal()
  const card = cards.value.find(card => card.id === id)
  if (card) card.amount = value
}
function setGoal(month: string) {
  cancelGoal()
  if (!month || !props.loans.length) return
  try { goalMonthEnd(month) } catch { goalStatus.value = 'Choose a valid payoff month.'; return }
  if (month < goalAnchor.value.slice(0, 7)) { goalStatus.value = 'Choose this month or later.'; return }
  goalMonth.value = month
  const oneTimeCents = parseMoney(amount.value)
  if (oneTimeCents === null || enteredMonthlyCents.value === null) { goalStatus.value = 'Check the payment amounts first.'; return }
  if (unavailable.value) { goalStatus.value = unavailable.value; return }
  const generation = goalGeneration
  goalBusy.value = true
  const request = { date: today(), goalMonth: month, oneTimeCents }
  const loans = props.loans.map(loan => ({ ...loan }))
  async function finish(message: { result?: ReturnType<typeof monthlyExtraForGoal>; error?: string }) {
    if (generation !== goalGeneration) return
    goalWorker?.terminate()
    goalWorker = undefined
    goalBusy.value = false
    if (!message.result) {
      goalStatus.value = message.error ?? 'This date cannot be reached with the entered payment dates. Try a later month.'
      return
    }
    applyingGoal = true
    goalMonth.value = message.result.payoffDate.slice(0, 7)
    const monthly = cards.value.find(card => card.kind === 'monthly')!
    const unchanged = parseExtraAmount(monthly.amount) === message.result.extraMonthlyCents
    monthly.amount = (message.result.extraMonthlyCents / 100).toFixed(2)
    // Even an unchanged amount can select a different goal-compatible allocation.
    if (unchanged) await compare(false)
    await nextTick()
    applyingGoal = false
  }
  goalTimer = setTimeout(() => {
    if (generation !== goalGeneration) return
    if (typeof Worker === 'undefined') {
      try { void finish({ result: monthlyExtraForGoal(loans, request) }) }
      catch (error) { void finish({ error: error instanceof Error ? error.message : 'Could not calculate this goal.' }) }
      return
    }
    try {
      goalWorker = new Worker(new URL('../workers/payoffGoal.worker.ts', import.meta.url), { type: 'module' })
      goalWorker.onmessage = event => { void finish(event.data) }
      goalWorker.onerror = () => { void finish({ error: 'Could not calculate this goal. Try again.' }) }
      goalWorker.postMessage({ loans, request })
    } catch {
      void finish({ error: 'Could not calculate this goal. Try again.' })
    }
  }, 120)
}
const controlBindings = computed(() => ({
  cards: cards.value,
  disabled: !props.loans.length,
  balanceCents: baselinePortfolio.value ? baselinePortfolio.value.principalCents + baselinePortfolio.value.accruedInterestCents : 0,
  minimumCents: baselinePortfolio.value?.monthlyPaymentCents ?? 0,
  goalMonth: displayedGoalMonth.value,
  goalAnchor: goalAnchor.value,
  goalMaxMonths: goalMaxMonths.value,
  goalBusy: goalBusy.value,
  goalStatus: goalStatus.value,
  goalDisabled: !props.loans.length || !!unavailable.value,
  errors: errors.value,
  hasChanges: hasChanges.value,
  onAmount: updateAmount, onReset: clear, onGoal: setGoal, onSubmit: () => { void compare() },
}))
onBeforeUnmount(() => cancelGoal())
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
    const firstError = document.querySelector<HTMLElement>('#extra-payment [aria-invalid="true"]')
      ?? document.querySelector<HTMLElement>('#extra-payment [role="alert"]')
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
  recommendations.value = recommendPayments(props.loans, { oneTimeCents, extraMonthlyCents, date: paymentDate.value, payoffBy: goalMonth.value ? goalMonthEnd(goalMonth.value) : undefined })
  selected.value = extraMonthlyCents > 0 ? oneTimeCents > 0 ? 'combined' : 'monthly' : 'one-time'
}

async function clear() {
  cancelGoal()
  resetting = true
  recommendations.value = null
  cards.value = initialCards()
  errors.value = {}
  await nextTick()
  resetting = false
  document.getElementById('extra-payment-amount')?.focus()
}
</script>

<template>
  <div class="payment-workspace">
    <slot :controls="controlBindings"><PaymentControls v-bind="controlBindings" /></slot>
    <div v-if="result" class="impact-area">
      <PaymentPlanSummary :result="result" :selected="selected" details-only hide-reset @clear="clear">
        <p v-if="activeRecommendation?.firstMonthlyPayments.length" class="monthly-recommendation">First extra payment: <span v-for="(payment, index) in activeRecommendation.firstMonthlyPayments" :key="payment.loanId">{{ index ? '; ' : '' }}<strong>{{ money(payment.amountCents) }} to {{ payment.loanName }}</strong></span>.</p>
        <PaymentRecommendationDetails v-if="activeRecommendation" :recommendation="activeRecommendation" :selected="selected" embedded />
      </PaymentPlanSummary>

      <p v-if="activeRecommendation?.fastestAlternative" class="tradeoff">An alternative finishes {{ dateDistance(activeRecommendation.option.payoffDate!, activeRecommendation.fastestAlternative.payoffDate!) }} sooner for {{ money(activeRecommendation.fastestAlternative.interestCents! - activeRecommendation.option.interestCents!) }} more interest.</p>
      <a class="chart-link" href="#outlook-heading">See this on the chart ↑</a>
    </div>
    <details v-if="result && result.request.oneTimeCents > 0 && result.request.extraMonthlyCents > 0" class="plan-comparison">
      <summary>Compare payment options</summary>
      <ScenarioComparison v-if="comparisonResult" :result="comparisonResult" :selected="selected" @select="cancelGoal(); selected = $event" />
    </details>
  </div>
</template>

<style scoped>
.payment-workspace { min-width: 0; }
.impact-area { margin-top: var(--space-4); }
.tradeoff { font-size: var(--font-sm); line-height: 1.5; color: var(--text-secondary); }
.chart-link { display: inline-block; padding-block: var(--space-3); color: var(--text-link); font-size: var(--font-sm); }
.plan-comparison { margin-top: var(--space-3); }
summary { cursor: pointer; color: var(--text-link); font-size: var(--font-sm); }
.plan-comparison > :deep(section) { margin-top: var(--space-4); }
</style>
