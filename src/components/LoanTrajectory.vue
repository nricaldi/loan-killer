<script setup lang="ts">
import { computed } from 'vue'
import type { PortfolioProjection } from '../domain/portfolio'
import { balanceWindow } from '../domain/balanceWindow'
import { addMonths } from '../domain/dates'
import { dateDistance, formatDate, money } from '../format'
import BalanceChart from './BalanceChart.vue'

const props = defineProps<{
  portfolio: PortfolioProjection
  comparison?: { portfolio: PortfolioProjection; label: string } | null
}>()
const paidOffProjection = computed(() => props.portfolio.projection.status === 'paid-off' ? props.portfolio.projection : null)
const current = computed(() => props.comparison?.portfolio.projection ?? props.portfolio.projection)
const currentPaid = computed(() => current.value.status === 'paid-off' ? current.value : null)
const interestSaved = computed(() => paidOffProjection.value && currentPaid.value
  ? paidOffProjection.value.remainingInterestCents - currentPaid.value.remainingInterestCents : null)
const timeSaved = computed(() => paidOffProjection.value && currentPaid.value
  ? dateDistance(currentPaid.value.payoffDate, paidOffProjection.value.payoffDate) : null)
const balanceCents = computed(() => props.portfolio.principalCents + props.portfolio.accruedInterestCents)
const horizon = computed(() => props.portfolio.projection.status !== 'paid-off'
  || (props.comparison && props.comparison.portfolio.projection.status !== 'paid-off')
  ? addMonths(props.portfolio.balanceDate, 600) : undefined)
const baseline = computed(() => balanceWindow(props.portfolio, horizon.value))
const chartComparison = computed(() => props.comparison ? {
  ...balanceWindow(props.comparison.portfolio, horizon.value), label: props.comparison.label,
} : undefined)
</script>

<template>
  <section class="panel journey-visual" aria-labelledby="outlook-heading">
    <div class="trajectory-heading">
      <h2 id="outlook-heading" tabindex="-1">Your payoff outlook</h2>
    </div>
    <p class="baseline-context">With <strong data-testid="monthly-minimum">{{ money(portfolio.monthlyPaymentCents) }}</strong> in monthly minimums</p>
    <div class="summary-grid" :class="{ comparing: comparison }" aria-label="Payoff comparison" aria-live="polite" aria-atomic="true">
      <div><p>Starting balance</p><strong data-testid="starting-balance">{{ money(balanceCents) }}</strong></div>
      <div>
        <p>Total to repay</p>
        <strong v-if="currentPaid" data-testid="total-payments">{{ money(currentPaid.totalPaymentsCents) }}</strong><strong v-else>Not paid off</strong>
        <p class="interest-note" :class="{ inactive: !currentPaid }"><template v-if="currentPaid">Includes <span data-testid="remaining-interest">{{ money(currentPaid.remainingInterestCents) }}</span> interest</template></p>
        <div class="comparison-space" :class="{ inactive: !comparison }" :aria-hidden="!comparison">
          <p class="original-value">With minimums: <span :data-testid="comparison ? 'baseline-total' : undefined">{{ paidOffProjection ? money(paidOffProjection.totalPaymentsCents) : 'No complete estimate' }}</span></p>
          <p v-if="comparison && interestSaved !== null" class="metric-change" data-testid="plan-interest-saved">{{ money(Math.abs(interestSaved)) }} {{ interestSaved >= 0 ? 'saved' : 'more interest' }}</p>
        </div>
      </div>
      <div>
        <p>Payoff date</p>
        <strong v-if="currentPaid" data-testid="payoff-date">{{ formatDate(currentPaid.payoffDate) }}</strong><strong v-else>No payoff date</strong><p v-if="!currentPaid" class="sr-only" role="status">This payment is not getting you to zero. Increase your monthly payment to find a payoff plan.</p>
        <div class="comparison-space" :class="{ inactive: !comparison }" :aria-hidden="!comparison">
          <p class="original-value">With minimums: <span :data-testid="comparison ? 'baseline-date' : undefined">{{ paidOffProjection ? formatDate(paidOffProjection.payoffDate) : 'No payoff date' }}</span></p>
          <p v-if="comparison && timeSaved" class="metric-change" data-testid="plan-time-saved">{{ currentPaid!.payoffDate === paidOffProjection!.payoffDate ? 'Same payoff date' : `${timeSaved} ${currentPaid!.payoffDate < paidOffProjection!.payoffDate ? 'sooner' : 'later'}` }}</p>
        </div>
      </div>
    </div>

    <BalanceChart :balance-date="portfolio.balanceDate" :initial-balance-cents="balanceCents" :projection="baseline.projection" :end-point="baseline.endPoint" label="Minimum payments" :comparison="chartComparison" />
    <p v-if="horizon" class="horizon-note">Showing the first 50 years. A line ending above zero still has a balance.</p>
  </section>
</template>

<style scoped>
.journey-visual { min-width: 0; padding: var(--space-5); }
.trajectory-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
.baseline-context { font-size: var(--font-sm); color: var(--text-secondary); margin: var(--space-2) 0 0; }
.summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); margin-top: var(--space-5); }
.summary-grid.comparing > div:not(:first-child) > strong { color: var(--text-link); }
.comparison-space { height: 5rem; }
.summary-grid > div > strong { display: block; min-height: 2.5em; line-height: 1.25; }
.summary-grid .interest-note { height: 3rem; }
.inactive { visibility: hidden; }
.summary-grid > div { min-width: 0; }
.summary-grid p { color: var(--text-secondary); font-size: var(--font-sm); margin: 0 0 var(--space-2); }
.summary-grid strong { font-size: var(--font-lg); font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.summary-grid .interest-note, .summary-grid .original-value { margin-top: 8px; font-size: 12px; line-height: 1.5; }
.summary-grid .metric-change { margin-top: 8px; color: var(--text-link); font-weight: 650; }
.horizon-note { color: var(--text-muted); font-size: var(--font-sm); margin: var(--space-3) 0 0; }
@media (max-width: 40rem) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .summary-grid > :first-child { grid-column: 1 / -1; } }
@media (max-width: 35rem) { .journey-visual { padding: var(--space-4); } }
</style>
