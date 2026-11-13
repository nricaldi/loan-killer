<script setup lang="ts">
import { computed } from 'vue'
import type { PortfolioProjection } from '../domain/portfolio'
import { balanceWindow } from '../domain/balanceWindow'
import { addMonths } from '../domain/dates'
import { dateDistance, formatDate, money } from '../format'
import BalanceChart from './BalanceChart.vue'

const props = defineProps<{
  portfolio: PortfolioProjection
  scope?: string
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
      <span class="scope-label" aria-live="polite">{{ scope ?? 'All loans' }}</span>
    </div>
    <p class="baseline-context">With <strong data-testid="monthly-minimum">{{ money(portfolio.monthlyPaymentCents) }}</strong> in monthly minimums</p>
    <div class="summary-grid" :class="{ comparing: comparison }" aria-label="Payoff comparison" aria-live="polite" aria-atomic="true">
      <div><p>Starting balance</p><strong data-testid="starting-balance">{{ money(balanceCents) }}</strong></div>
      <div>
        <p>Total to repay</p>
        <strong v-if="currentPaid" data-testid="total-payments">{{ money(currentPaid.totalPaymentsCents) }}</strong><strong v-else>Not paid off</strong>
        <p v-if="currentPaid" class="interest-note">Includes <span data-testid="remaining-interest">{{ money(currentPaid.remainingInterestCents) }}</span> interest</p>
        <template v-if="comparison">
          <p class="original-value">With minimums: <span data-testid="baseline-total">{{ paidOffProjection ? money(paidOffProjection.totalPaymentsCents) : 'No complete estimate' }}</span></p>
          <p v-if="interestSaved !== null" class="metric-change" data-testid="plan-interest-saved">{{ money(Math.abs(interestSaved)) }} {{ interestSaved >= 0 ? 'saved' : 'more interest' }}</p>
        </template>
      </div>
      <div>
        <p>Payoff date</p>
        <strong v-if="currentPaid" data-testid="payoff-date">{{ formatDate(currentPaid.payoffDate) }}</strong><strong v-else>No payoff date</strong>
        <template v-if="comparison">
          <p class="original-value">With minimums: <span data-testid="baseline-date">{{ paidOffProjection ? formatDate(paidOffProjection.payoffDate) : 'No payoff date' }}</span></p>
          <p v-if="timeSaved" class="metric-change" data-testid="plan-time-saved">{{ currentPaid!.payoffDate === paidOffProjection!.payoffDate ? 'Same payoff date' : `${timeSaved} ${currentPaid!.payoffDate < paidOffProjection!.payoffDate ? 'sooner' : 'later'}` }}</p>
        </template>
      </div>
    </div>
    <p v-if="!currentPaid" id="unpaid-heading" class="payoff-warning" role="status">{{ comparison ? 'This plan does not have a complete payoff estimate. Try increasing the extra amount.' : portfolio.projection.status === 'insufficient-payment' ? 'Your minimum payments aren’t getting you to zero. Try increasing your monthly payment below.' : 'Your payoff is beyond the estimate.' }}</p>
    <BalanceChart :balance-date="portfolio.balanceDate" :initial-balance-cents="balanceCents" :projection="baseline.projection" :end-point="baseline.endPoint" label="Minimum payments" :comparison="chartComparison" />
    <p v-if="horizon" class="horizon-note">Showing the first 50 years. A line ending above zero still has a balance.</p>
  </section>
</template>

<style scoped>
.journey-visual { min-width: 0; padding: var(--space-5); }
.trajectory-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
.baseline-context { font-size: var(--font-sm); color: var(--text-secondary); margin: var(--space-2) 0 0; }
.scope-label { font-size: var(--font-sm); color: var(--text-secondary); overflow-wrap: anywhere; }
.summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); margin-top: var(--space-5); }
.summary-grid.comparing > div:not(:first-child) > strong { color: var(--text-link); }
.summary-grid > div { min-width: 0; }
.summary-grid p { color: var(--text-secondary); font-size: var(--font-sm); margin: 0 0 var(--space-2); }
.summary-grid strong { font-size: var(--font-lg); font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.summary-grid .interest-note, .summary-grid .original-value { margin-top: 8px; font-size: 12px; line-height: 1.5; }
.summary-grid .metric-change { margin-top: 8px; color: var(--text-link); font-weight: 650; }
.payoff-warning { padding: var(--space-3); border-left: 3px solid var(--danger); background: var(--surface-muted); color: var(--danger); font-size: var(--font-sm); line-height: 1.5; }
.horizon-note { color: var(--text-muted); font-size: var(--font-sm); margin: var(--space-3) 0 0; }
@media (max-width: 50rem) { .summary-grid { grid-template-columns: 1fr; } }
@media (max-width: 35rem) { .journey-visual { padding: var(--space-4); } }
</style>
