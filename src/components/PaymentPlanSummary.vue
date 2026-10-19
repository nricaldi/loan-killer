<script setup lang="ts">
import { computed } from 'vue'
import { daysBetween } from '../domain/dates'
import type { ExtraScenarioId, PaymentScenarios } from '../domain/paymentScenarios'
import { dateDistance, formatDate, money } from '../format'
import { strategyNames } from '../domain/recurringPayments'

const props = defineProps<{ result: PaymentScenarios; selected: ExtraScenarioId }>()
const emit = defineEmits<{ clear: [] }>()
const plan = computed(() => {
  const selected = props.result.scenarios.find(({ id }) => id === props.selected)
  if (!selected) throw new Error('Missing selected scenario.')
  return selected
})
const savings = computed(() => plan.value.savings)
const additionalInterest = computed(() => (savings.value?.interestCents ?? 0) < 0)
const includesOneTime = computed(() => props.selected !== 'monthly' && props.result.request.oneTimeCents > 0)
const monthlyExtraCents = computed(() => props.selected === 'one-time' ? 0 : props.result.request.extraMonthlyCents)
const minimumCents = computed(() => props.result.oneTime.baseline.monthlyPaymentCents)
const projection = computed(() => plan.value.portfolio.projection)
const paidOffProjection = computed(() => projection.value.status === 'paid-off' ? projection.value : null)
const target = computed(() => includesOneTime.value
  ? plan.value.portfolio.loans.find(({ loan }) => loan.id === props.result.request.loanId) : undefined)
const heading = computed(() => {
  const oneTime = `${money(props.result.oneTime.appliedCents)} toward ${props.result.oneTime.targetBaseline.loan.name} today`
  const monthly = `${money(monthlyExtraCents.value)} extra each month`
  if (includesOneTime.value && monthlyExtraCents.value > 0) return `With ${oneTime} and ${monthly}`
  if (includesOneTime.value) return `With ${oneTime}`
  return monthlyExtraCents.value > 0 ? `With ${monthly}` : 'With your saved minimum payments'
})
const payoffChange = computed(() => {
  const before = props.result.oneTime.baseline.projection
  const after = projection.value
  if (before.status !== 'paid-off' || after.status !== 'paid-off') return 'Not available'
  const days = daysBetween(after.payoffDate, before.payoffDate)
  return days === 0 ? 'Same payoff date' : `${dateDistance(after.payoffDate, before.payoffDate)} ${days > 0 ? 'sooner' : 'later'}`
})

const targetPayoffChange = computed(() => {
  const before = props.result.oneTime.targetBaseline.projection
  const after = target.value?.projection
  if (before.status !== 'paid-off' || after?.status !== 'paid-off') return null
  const days = daysBetween(after.payoffDate, before.payoffDate)
  return days === 0 ? 'same payoff date' : `${dateDistance(after.payoffDate, before.payoffDate)} ${days > 0 ? 'sooner' : 'later'}`
})
</script>

<template>
  <section class="payment-summary" aria-labelledby="payment-summary-heading" aria-live="polite" aria-atomic="true">
    <h3 id="payment-summary-heading">{{ heading }}</h3>
    <div v-if="savings" class="impact-grid">
      <div>
        <p>{{ additionalInterest ? 'Additional interest' : 'You’ll save in interest' }}</p>
        <strong data-testid="plan-interest-saved">{{ savings ? money(Math.abs(savings.interestCents)) : 'Not available' }}</strong>
      </div>
      <div>
        <p>{{ result.oneTime.baseline.loans.length === 1 ? 'Selected loan paid off' : 'All selected loans paid off' }}</p>
        <strong data-testid="plan-time-saved">{{ payoffChange }}</strong>
      </div>
      <div>
        <p>You’d be debt-free by</p>
        <strong data-testid="plan-payoff-date">{{ projection.status === 'paid-off' ? formatDate(projection.payoffDate) : 'Not available' }}</strong>
      </div>
    </div>
    <div v-else-if="paidOffProjection" class="impact-grid">
      <div>
        <p>You’d be debt-free by</p>
        <strong data-testid="plan-payoff-date">{{ formatDate(paidOffProjection.payoffDate) }}</strong>
      </div>
      <div>
        <p>Interest with this plan</p>
        <strong data-testid="plan-interest-total">{{ money(paidOffProjection.remainingInterestCents) }}</strong>
      </div>
      <div>
        <p>Total to repay</p>
        <strong data-testid="plan-total-payments">{{ money(paidOffProjection.totalPaymentsCents) }}</strong>
      </div>
    </div>
    <p v-else class="plan-status">No payoff date yet with this plan. Try increasing your extra monthly payment or one-time payment.</p>
    <p class="monthly-budget" data-testid="monthly-budget">{{ money(minimumCents) }} minimums + {{ money(monthlyExtraCents) }} extra = <strong>{{ money(minimumCents + monthlyExtraCents) }} starting monthly budget</strong></p>
    <p v-if="monthlyExtraCents > 0" class="impact-note">Monthly strategy: {{ strategyNames[result.request.strategy] }}. Freed minimums roll forward as loans are paid off.</p>
    <p v-if="includesOneTime" class="impact-note">{{ money(result.oneTime.appliedCents) }} applied to {{ result.oneTime.targetBaseline.loan.name }}.<template v-if="targetPayoffChange"> This loan’s payoff: <strong>{{ targetPayoffChange }}</strong>.</template></p>
    <p v-if="includesOneTime && result.oneTime.unusedCents > 0" class="impact-note">{{ money(result.oneTime.unusedCents) }} unused; it isn’t moved to another loan.</p>
    <p v-if="savings" class="impact-note">Estimated savings compared with saved minimum payments only.</p>
    <p v-else-if="paidOffProjection" class="impact-note">This plan pays off your {{ result.oneTime.baseline.loans.length === 1 ? 'loan' : 'loans' }} in {{ dateDistance(result.oneTime.baseline.balanceDate, paidOffProjection.payoffDate) }}. Minimum payments alone don’t produce a payoff date within the estimate, so interest and time savings can’t be calculated. The totals above are for this plan, not savings.</p>
    <p v-else class="impact-note">This plan still has a balance at the end of the projection. No complete interest total or savings estimate is shown.</p>
    <p v-if="selected === 'one-time' && result.request.extraMonthlyCents > 0" class="impact-note">This preview excludes your extra monthly budget.</p>
    <p v-if="selected === 'monthly' && result.request.oneTimeCents > 0" class="impact-note">This preview excludes your one-time payment.</p>
    <button class="reset-button" type="button" @click="emit('clear')">Reset extra payments</button>
  </section>
</template>

<style scoped>
.payment-summary { padding: var(--space-5); background: var(--highlight-background); color: var(--highlight-text); border-radius: var(--radius-md); }
h3 { margin: 0 0 var(--space-4); font-size: var(--font-sm); font-weight: 600; line-height: 1.6; }
.impact-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); }
.impact-grid p { margin: 0 0 var(--space-2); font-size: var(--font-xs); color: var(--highlight-muted); }
.impact-grid strong { display: block; font-size: clamp(1.2rem, 2vw, 1.65rem); font-weight: 650; line-height: 1.3; letter-spacing: -0.03em; overflow-wrap: anywhere; }
.monthly-budget { margin: var(--space-4) 0 0; padding-top: var(--space-4); border-top: 1px solid var(--blue-divider); font-size: var(--font-sm); line-height: 1.7; }
.impact-note { margin: var(--space-2) 0 0; color: var(--highlight-muted); font-size: var(--font-xs); line-height: 1.6; }
.plan-status { font-size: var(--font-sm); line-height: 1.7; }
.reset-button { margin-top: var(--space-3); min-height: 2.75rem; padding: var(--space-2) 0; border: 0; background: transparent; color: var(--highlight-text); font-size: var(--font-xs); text-decoration: underline; text-underline-offset: 0.2em; cursor: pointer; }
@media (max-width: 35rem) { .payment-summary { padding: var(--space-4); } .impact-grid { grid-template-columns: 1fr; } }
</style>
