<script setup lang="ts">
import { computed } from 'vue'
import { daysBetween } from '../domain/dates'
import type { Projection } from '../domain/loan'
import type { ExtraScenarioId, PaymentScenarios } from '../domain/paymentScenarios'
import { dateDistance, formatDate, money } from '../format'
import { strategyNames, type RepaymentStrategy } from '../domain/recurringPayments'
import BalanceChart from './BalanceChart.vue'
import PayoffMilestones from './PayoffMilestones.vue'
import PaymentSchedule from './PaymentSchedule.vue'
import StrategyComparison from './StrategyComparison.vue'

const props = defineProps<{ result: PaymentScenarios; selected: ExtraScenarioId }>()
const emit = defineEmits<{ select: [scenario: ExtraScenarioId]; strategy: [strategy: RepaymentStrategy]; clear: [] }>()
const selectedPlan = computed(() => {
  const plan = props.result.scenarios.find(({ id }) => id === props.selected)
  if (!plan) throw new Error('Missing selected scenario.')
  return plan
})
const baseline = computed(() => props.result.oneTime.baseline)
const baselinePaid = computed(() => baseline.value.projection.status === 'paid-off' ? baseline.value.projection : null)
const selectedProjection = computed(() => selectedPlan.value.portfolio.projection)
const selectedPaid = computed(() => selectedProjection.value.status === 'paid-off' ? selectedProjection.value : null)
const chartProjection = computed(() => baselinePaid.value ?? selectedPaid.value)
const activeStrategyName = computed(() => strategyNames[props.result.request.strategy])
const chartLabel = computed(() => {
  if (props.selected === 'one-time') return 'With one-time payment'
  const label = props.selected === 'monthly' ? 'With extra monthly payments' : 'With one-time + monthly payments'
  return props.result.request.extraMonthlyCents > 0 ? `${label} · ${activeStrategyName.value}` : label
})
const chartComparison = computed(() => baselinePaid.value && selectedPaid.value
  ? { projection: selectedPaid.value, label: chartLabel.value } : undefined)
const targetScenario = computed(() => selectedPlan.value.portfolio.loans.find(({ loan }) => loan.id === props.result.request.loanId))
const additionalInterest = computed(() => (selectedPlan.value.savings?.interestCents ?? 0) < 0)
const includesOneTime = computed(() => props.selected !== 'monthly')
const announcement = computed(() => {
  const savings = selectedPlan.value.savings
  return `Comparison updated. Viewing ${selectedPlan.value.label}${props.selected !== 'one-time' && props.result.request.extraMonthlyCents > 0 ? `, ${activeStrategyName.value}` : ''}. ${savings
    ? `${money(Math.abs(savings.interestCents))} ${savings.interestCents >= 0 ? 'interest saved' : 'additional interest'}. ${payoffChange(baseline.value.projection, selectedProjection.value)} overall.`
    : 'Complete savings are not available because at least one plan does not pay off within the limit.'}`
})

function payoffChange(before: Projection, after: Projection): string {
  if (before.status !== 'paid-off' || after.status !== 'paid-off') return 'Not available'
  const days = daysBetween(after.payoffDate, before.payoffDate)
  return days === 0 ? 'Same payoff date' : `${dateDistance(after.payoffDate, before.payoffDate)} ${days > 0 ? 'sooner' : 'later'}`
}

function payoffDate(projection: Projection): string {
  return projection.status === 'paid-off' ? formatDate(projection.payoffDate) : 'Beyond projection limit'
}
</script>

<template>
  <div class="comparison-results" data-testid="extra-payment-results">
    <div class="result-heading">
      <div>
        <p class="eyebrow">VIEWING {{ selectedPlan.label.toUpperCase() }} · {{ baseline.loans.length === 1 ? 'YOUR LOAN' : `ALL ${baseline.loans.length} LOANS` }}</p>
        <h3 v-if="selected === 'one-time'">{{ money(result.oneTime.appliedCents) }} toward {{ result.oneTime.targetScenario.loan.name }}</h3>
        <h3 v-else-if="selected === 'monthly'">{{ money(result.request.extraMonthlyCents) }} extra per month</h3>
        <h3 v-else>{{ money(result.oneTime.appliedCents) }} today + {{ money(result.request.extraMonthlyCents) }} extra per month</h3>
        <p v-if="selected !== 'one-time' && result.request.extraMonthlyCents > 0" class="section-note">Monthly allocation: {{ activeStrategyName }}. Minimum amounts and due dates stay the same.</p>
      </div>
      <button class="text-button" type="button" @click="emit('clear')">Clear scenario</button>
    </div>

    <div class="savings-grid">
      <div class="savings-card">
        <p class="eyebrow">{{ additionalInterest ? 'ADDITIONAL INTEREST' : 'INTEREST SAVED' }}</p>
        <p class="savings-value" data-testid="extra-interest-saved">{{ selectedPlan.savings ? money(Math.abs(selectedPlan.savings.interestCents)) : 'Not available' }}</p>
        <p>Compared with minimum payments only. Complete estimates are needed for both plans.</p>
      </div>
      <div class="savings-card">
        <p class="eyebrow">OVERALL PAYOFF CHANGE</p>
        <p class="savings-value" data-testid="extra-time-saved">{{ payoffChange(baseline.projection, selectedProjection) }}</p>
        <p>The date when every loan reaches zero.</p>
      </div>
    </div>

    <section class="plans" aria-labelledby="compare-plans-heading">
      <h3 id="compare-plans-heading">Four ways forward</h3>
      <p class="section-note">Same starting balances. Total payments include every applied payment, including the lump sum. Choose a plan to inspect its chart and schedule.</p>
      <div class="plan-grid">
        <article v-for="plan in result.scenarios" :key="plan.id" class="plan-card" :class="{ 'selected-plan': selected === plan.id }" :data-scenario-id="plan.id">
          <h4>{{ plan.label }}</h4>
          <p v-if="plan.id === 'minimum'" class="reference-label">Your reference plan</p>
          <button v-else type="button" :aria-pressed="selected === plan.id" @click="emit('select', plan.id)">{{ selected === plan.id ? 'Selected' : 'View' }} {{ plan.label }}</button>
          <dl>
            <div><dt>Debt-free date</dt><dd :data-testid="selected === plan.id ? 'extra-payoff-date' : undefined">{{ payoffDate(plan.portfolio.projection) }}</dd></div>
            <div><dt>Remaining interest</dt><dd>{{ plan.portfolio.projection.status === 'paid-off' ? money(plan.portfolio.projection.remainingInterestCents) : 'Not available' }}</dd></div>
            <div><dt>Total payments</dt><dd :data-testid="selected === plan.id ? 'extra-total-payments' : undefined">{{ plan.portfolio.projection.status === 'paid-off' ? money(plan.portfolio.projection.totalPaymentsCents) : 'Not available' }}</dd></div>
          </dl>
          <p class="plan-saving">{{ plan.savings ? `${money(Math.abs(plan.savings.interestCents))} ${plan.savings.interestCents >= 0 ? 'interest saved' : 'additional interest'}` : 'Interest saving not available' }}</p>
          <p class="plan-saving">{{ payoffChange(baseline.projection, plan.portfolio.projection) }}</p>
        </article>
      </div>
    </section>

    <p v-if="result.request.extraMonthlyCents > 0" class="budget-note" data-testid="monthly-budget-note">Monthly and combined plans keep a starting budget of <strong>{{ money(result.monthlyBudgetCents) }} per month</strong>: {{ money(baseline.monthlyPaymentCents) }} in minimums + {{ money(result.request.extraMonthlyCents) }} extra. Extra starts {{ formatDate(result.recurringStartDate) }}, once per month across the plan. All minimums keep their own due dates. Freed minimums and unused final minimums roll into the {{ result.request.strategy === 'highest-rate' ? 'highest-rate active loan' : 'active loan with the smallest current balance' }} on their original due dates. Minimum-only and one-time-only plans do not roll payments over. Final payments are capped; nothing more is spent after all loans reach zero.</p>
    <p v-else class="budget-note">With $0 extra monthly, the monthly plan matches the baseline and the combined plan matches one-time only. Rollover is off.</p>

    <StrategyComparison :result="result" :selected="selected" @strategy="emit('strategy', $event)" @scenario="emit('select', $event)" />

    <div v-if="includesOneTime" class="allocation">
      <h3>Where today’s one-time payment goes</h3>
      <p>On {{ formatDate(result.request.date) }}, before any scheduled payment that day.</p>
      <dl class="allocation-grid">
        <div><dt>To unpaid interest</dt><dd data-testid="extra-to-interest">{{ money(result.oneTime.interestPaidCents) }}</dd></div>
        <div><dt>To principal</dt><dd data-testid="extra-to-principal">{{ money(result.oneTime.principalPaidCents) }}</dd></div>
        <div><dt>This loan’s balance after extra</dt><dd data-testid="extra-balance-after">{{ money(result.oneTime.balanceAfterExtraCents) }}</dd></div>
      </dl>
      <p v-if="result.oneTime.unusedCents > 0" class="budget-note" data-testid="extra-unused">You entered {{ money(result.request.oneTimeCents) }}, but this loan only needs {{ money(result.oneTime.appliedCents) }}. The remaining {{ money(result.oneTime.unusedCents) }} is unused; it isn’t moved to another loan or included in projected payments. This is separate from rolling over future monthly minimums.</p>
    </div>

    <p v-if="targetScenario" class="target-impact"><strong>{{ targetScenario.loan.name }}:</strong> {{ payoffDate(result.oneTime.targetBaseline.projection) }} → {{ payoffDate(targetScenario.projection) }}. {{ payoffChange(result.oneTime.targetBaseline.projection, targetScenario.projection) }} for this loan. Paying it off earlier may not change your overall date if another loan takes longer.</p>
    <p v-if="!selectedPlan.savings" class="budget-note">At least one of the baseline and selected plans doesn’t pay off within the projection limit. We don’t invent a complete interest saving or time reduction. Available dates and totals belong only to a plan that fully pays off.</p>
    <p v-if="additionalInterest" class="section-note">Interest rounds at each payment. Splitting a period with a very small extra payment can change the estimate by a few cents.</p>

    <template v-if="chartProjection">
      <BalanceChart
        :balance-date="baseline.balanceDate"
        :initial-balance-cents="baseline.principalCents + baseline.accruedInterestCents"
        :projection="chartProjection"
        :label="baselinePaid ? 'Minimum payments only' : chartLabel"
        :comparison="chartComparison"
      />
      <p class="section-note">{{ baselinePaid && selectedPaid ? 'Dashed: your baseline. Solid: the selected plan. Both are estimates, not actual history.' : 'Only the plan with a complete payoff estimate is charted.' }}</p>
    </template>
    <PaymentSchedule v-if="selectedPaid" :key="`${selected}-${result.request.strategy}`" :payments="selectedPaid.schedule" :combined="selectedPlan.portfolio.loans.length > 1" />
    <PayoffMilestones :portfolio="selectedPlan.portfolio" :baseline="baseline" :plan-label="`${selectedPlan.label}${selected !== 'one-time' && result.request.extraMonthlyCents > 0 ? ` · ${activeStrategyName}` : ''}`" />
    <p class="sr-only" role="status" aria-atomic="true">{{ announcement }}</p>
  </div>
</template>

<style scoped>
.comparison-results { border-top: 1px solid var(--border); padding-top: var(--space-6); margin-top: var(--space-6); }
.result-heading { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: var(--space-4); }
h3 { margin: 0; font-size: var(--font-md); font-weight: 600; line-height: 1.6; overflow-wrap: anywhere; }
.savings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); margin-top: var(--space-5); }
.savings-card { background: var(--blue-light); border: 1px solid var(--blue-border); border-radius: var(--radius-md); padding: var(--space-5); }
.savings-value { margin: var(--space-3) 0; font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 600; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; line-height: 1.3; overflow-wrap: anywhere; }
.savings-card > p:last-child, .section-note, .target-impact, .allocation p { margin: var(--space-2) 0 0; color: var(--text-muted); font-size: var(--font-xs); line-height: 1.8; }
.plans, .allocation { margin-top: var(--space-6); }
.plan-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); margin-top: var(--space-4); }
.plan-card { min-width: 0; border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-4); }
.selected-plan { border-color: var(--chart-line); background: var(--blue-light); }
h4 { font-size: var(--font-sm); font-weight: 600; margin: 0 0 var(--space-3); line-height: 1.6; }
.plan-card button { width: 100%; border: 1px solid var(--blue-border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-link); font-size: var(--font-xs); line-height: 1.6; padding: var(--space-2); min-height: 2.75rem; }
.plan-card button[aria-pressed='true'] { background: var(--blue-primary); font-weight: 600; }
.reference-label { display: flex; align-items: center; min-height: 2.75rem; font-size: var(--font-xs); color: var(--text-muted); margin: 0; }
dl { margin: var(--space-4) 0 0; }
.plan-card dl > div { margin-bottom: var(--space-3); }
dt { font-size: var(--font-xs); line-height: 1.6; color: var(--text-muted); }
dd { margin: var(--space-1) 0 0; font-size: var(--font-sm); font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.plan-saving { margin: var(--space-2) 0 0; font-size: var(--font-xs); line-height: 1.7; color: var(--text-secondary); }
.budget-note { background: var(--blue-light); border: 1px solid var(--blue-border); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); margin: var(--space-5) 0 0; color: var(--text-secondary); font-size: var(--font-xs); line-height: 1.8; }
.allocation { border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-5); }
.allocation-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); }
.allocation-grid dd { margin-top: var(--space-2); font-size: var(--font-lg); }
.target-impact { margin-top: var(--space-4); }
.target-impact strong { color: var(--text); }
@media (max-width: 65rem) { .plan-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 35rem) { .savings-grid, .plan-grid, .allocation-grid { grid-template-columns: 1fr; } }
</style>
