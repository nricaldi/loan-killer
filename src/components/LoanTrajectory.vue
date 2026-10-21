<script setup lang="ts">
import { computed } from 'vue'
import type { PortfolioProjection } from '../domain/portfolio'
import { formatDate, money } from '../format'
import BalanceChart from './BalanceChart.vue'
import PaymentsChart from './PaymentsChart.vue'
import PaymentSchedule from './PaymentSchedule.vue'

const props = defineProps<{ portfolio: PortfolioProjection; comparison?: { portfolio: PortfolioProjection; label: string } | null }>()
const chartView = defineModel<'payments' | 'balance'>('view', { default: 'balance' })
const projection = computed(() => props.portfolio.projection)
const paidOffProjection = computed(() => projection.value.status === 'paid-off' ? projection.value : null)
const loanCount = computed(() => props.portfolio.loans.length)
const balanceCents = computed(() => props.portfolio.principalCents + props.portfolio.accruedInterestCents)
const blockedLoans = computed(() => props.portfolio.loans.filter(({ projection }) => projection.status !== 'paid-off'))
const comparisonProjection = computed(() => props.comparison?.portfolio.projection.status === 'paid-off'
  ? props.comparison.portfolio.projection : null)
const chartComparison = computed(() => comparisonProjection.value && props.comparison
  && paidOffProjection.value ? { projection: comparisonProjection.value, label: props.comparison.label } : undefined)
const chartProjection = computed(() => paidOffProjection.value ?? comparisonProjection.value)
const previewOnly = computed(() => !paidOffProjection.value && comparisonProjection.value !== null)
const chartLabel = computed(() => previewOnly.value ? props.comparison?.label : undefined)
</script>

<template>
  <section class="journey-visual" aria-label="Payment projection">
    <div v-if="chartProjection" class="trajectory-panel">
      <div class="trajectory-heading">
        <h2 class="sr-only">Payment projection</h2>
        <div class="payoff-summary" :class="{ 'preview-payoff': comparisonProjection }" aria-live="polite" aria-atomic="true">
          <p v-if="comparisonProjection">With this plan, you’d be debt-free <strong data-testid="preview-payoff-date">{{ formatDate(comparisonProjection.payoffDate) }}</strong></p>
          <p v-else>Debt-free by <strong data-testid="payoff-date">{{ formatDate(chartProjection.payoffDate) }}</strong></p>
          <p class="baseline-context"><template v-if="paidOffProjection && comparisonProjection">Minimums only: <span data-testid="payoff-date">{{ formatDate(paidOffProjection.payoffDate) }}</span> · {{ money(Math.abs(paidOffProjection.remainingInterestCents - comparisonProjection.remainingInterestCents)) }} {{ comparisonProjection.remainingInterestCents <= paidOffProjection.remainingInterestCents ? 'interest saved' : 'additional interest' }}</template><template v-else>{{ previewOnly ? 'No minimum-only payoff estimate' : 'With your saved minimums' }}</template></p>
        </div>
        <p class="chart-minimum">Total minimum<strong data-testid="chart-monthly-minimum">{{ money(portfolio.monthlyPaymentCents) }}<small> / mo</small></strong></p>
        <div class="chart-switch" role="group" aria-label="Projection chart view">
          <button type="button" :aria-pressed="chartView === 'payments'" @click="chartView = 'payments'">Total paid over time</button>
          <button type="button" :aria-pressed="chartView === 'balance'" @click="chartView = 'balance'">Remaining balance</button>
        </div>
      </div>
      <PaymentsChart v-if="chartView === 'payments'" :balance-date="portfolio.balanceDate" :initial-balance-cents="balanceCents" :projection="chartProjection" :label="chartLabel" :comparison="chartComparison" interactive compact />
      <BalanceChart v-else :balance-date="portfolio.balanceDate" :initial-balance-cents="balanceCents" :projection="chartProjection" :label="chartLabel" :comparison="chartComparison" interactive compact />
      <p v-if="comparison && !comparisonProjection" class="projection-note">The selected extra-payment plan does not pay off within the projection limit. No complete comparison curve is shown.</p>
      <p v-if="previewOnly" class="projection-note">Showing your extra-payment plan. Minimum payments alone don’t produce a payoff date within the estimate, so no minimum-only comparison curve is shown.</p>
      <PaymentSchedule :payments="(comparisonProjection ?? chartProjection).schedule" :combined="loanCount > 1" />
    </div>
    <section v-else class="unpaid-panel" aria-labelledby="unpaid-heading">
      <p class="chart-minimum">Total minimum<strong data-testid="chart-monthly-minimum">{{ money(portfolio.monthlyPaymentCents) }}<small> / mo</small></strong></p>
      <h2 id="unpaid-heading">{{ portfolio.monthlyPaymentCents === 0 ? 'No payoff date with $0 minimum payments.' : loanCount > 1 ? 'Some loans need a payment check.' : projection.status === 'insufficient-payment' ? 'This payment isn’t getting you to zero.' : 'The payoff is beyond this projection.' }}</h2>
      <p>Try an extra payment to preview a payoff plan.</p>
      <details class="unpaid-details">
        <summary>Why no payoff date?</summary>
        <p v-if="blockedLoans.some(({ loan }) => loan.monthlyPaymentCents === 0)">A $0 minimum stays at $0 in this estimate until you update it. Interest may still accrue.</p>
        <p v-if="loanCount > 1">At least one loan doesn’t pay off within its 1,200-payment limit. An overall payoff date and complete interest total would be misleading, so we haven’t shown them. Open an individual loan to inspect its schedule.</p>
        <p v-else-if="projection.status === 'insufficient-payment' && portfolio.monthlyPaymentCents > 0">Over a full year at the end of the projection, this payment doesn’t cover new interest. Your balance isn’t decreasing. Double-check your minimum with your servicer, or enter a higher monthly payment.</p>
        <p v-else-if="portfolio.monthlyPaymentCents > 0">The loan still has a balance after 1,200 monthly payments. We cap estimates there rather than show an unreliable finish date. Check your figures or try a higher payment.</p>
        <p class="unpaid-footnote">No baseline payoff date or complete interest total is shown because the loan does not pay off within the projection.</p>
        <ul v-if="loanCount > 1" class="blocked-loans">
          <li v-for="entry in blockedLoans" :key="entry.loan.id"><strong>{{ entry.loan.name }}</strong> — {{ entry.loan.monthlyPaymentCents === 0 ? 'No payoff date with a $0 minimum.' : entry.projection.status === 'insufficient-payment' ? 'Payment doesn’t cover ongoing interest.' : 'Beyond the projection limit.' }}</li>
        </ul>
        <template v-else>
          <PaymentSchedule :payments="projection.schedule.slice(0, 12)" />
          <p class="unpaid-footnote">The breakdown above shows only the first 12 projected payments.</p>
        </template>
      </details>
    </section>
  </section>
</template>

<style scoped>
.journey-visual { min-width: 0; }
.payoff-summary { min-width: min(100%, 12rem); flex: 1 1 12rem; font-size: var(--font-xs); line-height: 1.6; }
.payoff-summary p { margin: 0; }
.payoff-summary strong { display: block; font-size: var(--font-lg); line-height: 1.4; color: var(--text); }
.payoff-summary .baseline-context { min-block-size: 1.25rem; font-size: 0.65rem; color: var(--text-muted); }
.chart-minimum { flex-shrink: 0; margin: 0; font-size: var(--font-xs); color: var(--text-secondary); }
.chart-minimum strong { display: block; font-size: var(--font-lg); color: var(--text); line-height: 1.4; }
.chart-minimum small { font-size: var(--font-xs); font-weight: 400; }
.preview-payoff { color: var(--text-link); }
.trajectory-heading { display: flex; align-items: start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
.chart-switch { display: flex; flex-wrap: wrap; gap: var(--space-1); }
.chart-switch button { min-height: 2rem; padding: var(--space-1) var(--space-2); background: var(--surface); color: var(--text-muted); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: var(--font-xs); }
.chart-switch button[aria-pressed='true'] { background: var(--blue-light); color: var(--text-link); border-color: var(--blue-border); font-weight: 600; }
.projection-note { color: var(--text-muted); font-size: var(--font-xs); line-height: 1.6; }
.journey-visual :deep(.schedule) { margin-top: var(--space-3); }
.journey-visual :deep(.schedule > summary) { padding-top: var(--space-2); }
.unpaid-panel > p:not(.chart-minimum), .unpaid-details { font-size: var(--font-xs); color: var(--text-muted); line-height: 1.7; }
.unpaid-panel h2 { margin-top: var(--space-3); }
summary { cursor: pointer; color: var(--text-link); font-size: var(--font-xs); }
@media (max-width: 35rem) {
  .trajectory-heading { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .payoff-summary, .trajectory-heading .chart-minimum { min-width: 0; }
  .chart-switch { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (any-pointer: coarse) { .chart-switch button { min-height: var(--size-touch-target); } }
.blocked-loans { padding-left: var(--space-5); font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.8; }
.blocked-loans li + li { margin-top: var(--space-3); }
</style>
