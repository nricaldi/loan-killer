<script setup lang="ts">
import { computed } from 'vue'
import type { PortfolioProjection } from '../domain/portfolio'
import { balanceWindow } from '../domain/balanceWindow'
import { addMonths } from '../domain/dates'
import { formatDate, money } from '../format'
import BalanceChart from './BalanceChart.vue'

const props = defineProps<{
  portfolio: PortfolioProjection
  scope?: string
  comparison?: { portfolio: PortfolioProjection; label: string } | null
}>()
const paidOffProjection = computed(() => props.portfolio.projection.status === 'paid-off' ? props.portfolio.projection : null)
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
      <span class="scope-label" aria-live="polite">{{ scope ?? 'All loans' }}</span>
    </div>
    <p class="baseline-context">With <strong data-testid="monthly-minimum">{{ money(portfolio.monthlyPaymentCents) }}</strong> in monthly minimums</p>
    <div class="summary-grid" aria-label="With minimum payments">
      <div><p>Starting balance</p><strong data-testid="starting-balance">{{ money(balanceCents) }}</strong></div>
      <template v-if="paidOffProjection">
        <div><p>Interest to pay</p><strong data-testid="remaining-interest">{{ money(paidOffProjection.remainingInterestCents) }}</strong></div>
        <div><p>Total to repay</p><strong data-testid="total-payments">{{ money(paidOffProjection.totalPaymentsCents) }}</strong></div>
        <div><p>Debt-free with minimums</p><strong data-testid="payoff-date">{{ formatDate(paidOffProjection.payoffDate) }}</strong></div>
      </template>
    </div>
    <p v-if="!paidOffProjection" id="unpaid-heading" class="payoff-warning" role="status">{{ portfolio.projection.status === 'insufficient-payment' ? 'Your minimum payments aren’t getting you to zero.' : 'Your payoff is beyond the estimate.' }} Try increasing your monthly payment below.</p>
    <BalanceChart :balance-date="portfolio.balanceDate" :initial-balance-cents="balanceCents" :projection="baseline.projection" :end-point="baseline.endPoint" label="Minimum payments" :comparison="chartComparison" />
    <p v-if="horizon" class="horizon-note">Showing the first 50 years. A line ending above zero still has a balance.</p>
  </section>
</template>

<style scoped>
.journey-visual { min-width: 0; padding: var(--space-5); }
.trajectory-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
.baseline-context { font-size: var(--font-sm); color: var(--text-secondary); margin: var(--space-2) 0 0; }
.scope-label { font-size: var(--font-sm); color: var(--text-secondary); overflow-wrap: anywhere; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); margin-top: var(--space-5); }
.summary-grid > div { min-width: 0; }
.summary-grid p { color: var(--text-secondary); font-size: var(--font-sm); margin: 0 0 var(--space-2); }
.summary-grid strong { font-size: var(--font-lg); font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.payoff-warning { padding: var(--space-3); border-left: 3px solid var(--danger); background: var(--surface-muted); color: var(--danger); font-size: var(--font-sm); line-height: 1.5; }
.horizon-note { color: var(--text-muted); font-size: var(--font-sm); margin: var(--space-3) 0 0; }
@media (max-width: 50rem) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 35rem) { .journey-visual { padding: var(--space-4); } }
</style>
