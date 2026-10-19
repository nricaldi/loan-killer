<script setup lang="ts">
import { computed } from 'vue'
import { daysBetween } from '../domain/dates'
import type { ExtraScenarioId, PaymentScenarios } from '../domain/paymentScenarios'
import { buildPayoffTimeline } from '../domain/payoffMilestones'
import { strategyNames, type RepaymentStrategy } from '../domain/recurringPayments'
import { dateDistance, formatDate, money } from '../format'

const props = defineProps<{ result: PaymentScenarios; selected: ExtraScenarioId }>()
const emit = defineEmits<{ strategy: [strategy: RepaymentStrategy]; scenario: [scenario: ExtraScenarioId] }>()
const variant = computed(() => props.selected === 'combined' ? 'combined' : 'monthly')
const comparisons = computed(() => props.result.strategies.map((entry) => {
  const plan = entry[variant.value]
  return { ...entry, plan, first: buildPayoffTimeline(plan.portfolio, props.result.oneTime.baseline).milestones[0] }
}))
const difference = computed(() => {
  const highest = comparisons.value.find(({ strategy }) => strategy === 'highest-rate')?.plan.portfolio.projection
  const smallest = comparisons.value.find(({ strategy }) => strategy === 'smallest-balance')?.plan.portfolio.projection
  if (highest?.status !== 'paid-off' || smallest?.status !== 'paid-off') return null
  return {
    interestCents: smallest.remainingInterestCents - highest.remainingInterestCents,
    days: daysBetween(highest.payoffDate, smallest.payoffDate),
    distance: dateDistance(highest.payoffDate, smallest.payoffDate),
  }
})
const costDifference = computed(() => {
  if (!difference.value) return 'Complete payoff estimates are needed for both strategies to compare cost and time.'
  const cents = difference.value.interestCents
  if (!cents) return 'Both strategies have the same estimated remaining interest.'
  return `${strategyNames[cents > 0 ? 'highest-rate' : 'smallest-balance']} costs ${money(Math.abs(cents))} less interest for this plan.`
})
const timeDifference = computed(() => {
  if (!difference.value) return ''
  if (!difference.value.days) return 'Both strategies have the same debt-free date.'
  return `${strategyNames[difference.value.days > 0 ? 'highest-rate' : 'smallest-balance']} finishes ${difference.value.distance} sooner.`
})
</script>

<template>
  <section class="strategy-comparison" aria-labelledby="strategy-comparison-heading" data-testid="strategy-comparison">
    <p class="eyebrow">SAME BUDGET. TWO APPROACHES.</p>
    <h3 id="strategy-comparison-heading">Interest focus or smaller wins?</h3>
    <p class="section-note">Highest rate first (avalanche) targets expensive rates. Smallest balance first (snowball) prioritizes smaller remaining balances, including unpaid interest. Neither name guarantees a better result; compare the estimates.</p>

    <p v-if="result.request.extraMonthlyCents === 0" class="comparison-note">Strategies only affect positive monthly-increase plans. With $0 extra monthly, rollover is off and changing strategy does not change any payment.</p>
    <div v-else-if="selected === 'one-time'" class="comparison-note">
      <p>Strategy doesn’t change the one-time target. Select a monthly plan to compare the two approaches.</p>
      <div class="comparison-links"><button type="button" @click="emit('scenario', 'monthly')">Compare monthly strategies</button><button type="button" @click="emit('scenario', 'combined')">Compare combined strategies</button></div>
    </div>
    <template v-else>
      <p class="section-note">Comparing {{ selected === 'combined' ? 'one-time + monthly' : 'extra monthly only' }} with the same {{ money(result.monthlyBudgetCents) }} starting monthly budget{{ selected === 'combined' ? ` and ${money(result.oneTime.appliedCents)} applied today` : '' }}. Only allocation order differs.</p>
      <div class="strategy-grid">
        <article v-for="entry in comparisons" :key="entry.strategy" class="strategy-card" :class="{ 'active-strategy': entry.strategy === result.request.strategy }" :data-strategy-id="entry.strategy">
          <h4>{{ entry.label }}</h4>
          <p class="strategy-alias">{{ entry.strategy === 'highest-rate' ? 'Avalanche · focus on interest rates' : 'Snowball · focus on smaller balances' }}</p>
          <dl>
            <div><dt>Debt-free date</dt><dd>{{ entry.plan.portfolio.projection.status === 'paid-off' ? formatDate(entry.plan.portfolio.projection.payoffDate) : 'Beyond projection limit' }}</dd></div>
            <div><dt>Remaining interest</dt><dd>{{ entry.plan.portfolio.projection.status === 'paid-off' ? money(entry.plan.portfolio.projection.remainingInterestCents) : 'Not available' }}</dd></div>
            <div><dt>Total payments</dt><dd>{{ entry.plan.portfolio.projection.status === 'paid-off' ? money(entry.plan.portfolio.projection.totalPaymentsCents) : 'Not available' }}</dd></div>
            <div><dt>First projected payoff</dt><dd>{{ entry.first ? formatDate(entry.first.date) : 'No known payoff within limit' }}<span v-if="entry.first" class="first-loans">{{ entry.first.loans.map((loan) => loan.name).join(', ') }}</span></dd></div>
          </dl>
          <button type="button" :aria-pressed="entry.strategy === result.request.strategy" @click="emit('strategy', entry.strategy)">{{ entry.strategy === result.request.strategy ? 'Selected' : 'Use' }} {{ entry.label }}</button>
        </article>
      </div>
      <div class="comparison-note" data-testid="strategy-difference"><p>{{ costDifference }}</p><p v-if="timeDifference">{{ timeDifference }}</p><p v-if="result.oneTime.baseline.loans.length === 1">With one loan, allocation order can’t change the result.</p></div>
    </template>
  </section>
</template>

<style scoped>
.strategy-comparison { border-top: 1px solid var(--border); padding-top: var(--space-6); margin-top: var(--space-6); }
h3, h4 { margin: 0; font-size: var(--font-md); font-weight: 600; line-height: 1.6; }
.section-note, .strategy-alias, .comparison-note { font-size: var(--font-xs); line-height: 1.8; color: var(--text-muted); }
.section-note { margin: var(--space-3) 0 0; }
.strategy-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); margin-top: var(--space-5); }
.strategy-card { padding: var(--space-5); border: 1px solid var(--border); border-radius: var(--radius-md); min-width: 0; }
.active-strategy { background: var(--blue-light); border-color: var(--chart-line); }
.strategy-alias { margin: var(--space-2) 0 var(--space-4); }
dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); margin: 0; }
dt { color: var(--text-muted); font-size: var(--font-xs); line-height: 1.7; }
dd { margin: var(--space-1) 0 0; font-size: var(--font-sm); font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1.6; overflow-wrap: anywhere; }
.first-loans { display: block; color: var(--text-secondary); font-size: var(--font-xs); font-weight: 400; }
button { border: 1px solid var(--blue-border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-link); font-size: var(--font-xs); min-height: 2.75rem; padding: var(--space-2) var(--space-3); line-height: 1.7; }
.strategy-card > button { width: 100%; margin-top: var(--space-5); }
button[aria-pressed='true'] { background: var(--blue-primary); font-weight: 600; }
.comparison-note { background: var(--blue-light); color: var(--text-secondary); border: 1px solid var(--blue-border); border-radius: var(--radius-sm); margin: var(--space-4) 0 0; padding: var(--space-3) var(--space-4); }
.comparison-note p { margin: 0; }
.comparison-note p + p { margin-top: var(--space-2); }
.comparison-links { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-3); }
@media (max-width: 35rem) { .strategy-grid { grid-template-columns: 1fr; } }
</style>
