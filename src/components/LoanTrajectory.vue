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
  ? { projection: comparisonProjection.value, label: props.comparison.label } : undefined)
</script>

<template>
  <section class="journey-visual" aria-label="Payment projection">
    <div v-if="paidOffProjection" class="trajectory-panel">
      <div class="trajectory-heading">
        <h2 id="trajectory-heading">{{ chartView === 'payments' ? 'What you’ll pay over time' : 'Your path to zero' }}</h2>
        <div class="chart-switch" role="group" aria-label="Projection chart view">
          <button type="button" :aria-pressed="chartView === 'payments'" @click="chartView = 'payments'">Total paid over time</button>
          <button type="button" :aria-pressed="chartView === 'balance'" @click="chartView = 'balance'">Remaining balance</button>
        </div>
      </div>
      <div class="payoff-summary">
        <p>Debt-free <strong data-testid="payoff-date">{{ formatDate(paidOffProjection.payoffDate) }}</strong><span> · {{ paidOffProjection.paymentCount }} {{ loanCount > 1 ? `payments across ${loanCount} loans` : `monthly ${paidOffProjection.paymentCount === 1 ? 'payment' : 'payments'} to zero` }}</span></p>
        <p v-if="comparisonProjection" class="preview-payoff" role="status">With extra payments: <strong>{{ formatDate(comparisonProjection.payoffDate) }}</strong> · {{ money(Math.abs(paidOffProjection.remainingInterestCents - comparisonProjection.remainingInterestCents)) }} {{ comparisonProjection.remainingInterestCents <= paidOffProjection.remainingInterestCents ? 'interest saved' : 'additional interest' }} <span class="preview-tag">PREVIEW</span></p>
      </div>
      <PaymentsChart v-if="chartView === 'payments'" :balance-date="portfolio.balanceDate" :initial-balance-cents="balanceCents" :projection="paidOffProjection" :comparison="chartComparison" interactive />
      <BalanceChart v-else :balance-date="portfolio.balanceDate" :initial-balance-cents="balanceCents" :projection="paidOffProjection" :comparison="chartComparison" interactive />
      <p v-if="comparison && !comparisonProjection" class="projection-note">The selected extra-payment plan does not pay off within the projection limit. No complete comparison curve is shown.</p>
      <PaymentSchedule :payments="paidOffProjection.schedule" :combined="loanCount > 1" />
    </div>
    <section v-else class="unpaid-panel" aria-labelledby="unpaid-heading">
      <span class="unpaid-icon" aria-hidden="true">↗</span>
      <p class="eyebrow">LET’S CHECK THAT PAYMENT</p>
      <h2 id="unpaid-heading">{{ loanCount > 1 ? 'Some loans need a payment check.' : projection.status === 'insufficient-payment' ? 'This payment isn’t getting you to zero.' : 'The payoff is beyond this projection.' }}</h2>
      <p v-if="loanCount > 1">At least one loan doesn’t pay off within its 1,200-payment limit. An overall payoff date and complete interest total would be misleading, so we haven’t shown them. Open an individual loan to inspect its schedule.</p>
      <p v-else-if="projection.status === 'insufficient-payment'">Over a full year at the end of the projection, this payment doesn’t cover new interest. Your balance isn’t decreasing. Double-check your minimum with your servicer, or enter a higher monthly payment.</p>
      <p v-else>The loan still has a balance after 1,200 monthly payments. We cap estimates there rather than show an unreliable finish date. Check your figures or try a higher payment.</p>
      <p class="unpaid-footnote">No baseline payoff date or complete interest total is shown because the loan does not pay off within the projection.</p>
      <ul v-if="loanCount > 1" class="blocked-loans">
        <li v-for="entry in blockedLoans" :key="entry.loan.id"><strong>{{ entry.loan.name }}</strong> — {{ entry.projection.status === 'insufficient-payment' ? 'Payment doesn’t cover ongoing interest.' : 'Beyond the projection limit.' }}</li>
      </ul>
      <template v-else>
        <PaymentSchedule :payments="projection.schedule.slice(0, 12)" />
        <p class="unpaid-footnote">The breakdown above shows only the first 12 projected payments.</p>
      </template>
      <BalanceChart v-if="comparisonProjection" :balance-date="portfolio.balanceDate" :initial-balance-cents="balanceCents" :projection="comparisonProjection" :label="comparison?.label" />
      <p v-if="comparisonProjection" class="preview-payoff">Hypothetical debt-free date: <strong>{{ formatDate(comparisonProjection.payoffDate) }}</strong>. Complete savings against the baseline aren’t available.</p>
    </section>
  </section>
</template>

<style scoped>
.journey-visual { min-width: 0; }
.payoff-summary { margin: var(--space-3) 0 0; font-size: var(--font-sm); line-height: 1.7; }
.payoff-summary p { margin: 0; }
.payoff-summary span { color: var(--text-muted); font-size: var(--font-xs); }
.preview-payoff { color: var(--text-link); }
.payoff-summary .preview-tag { display: inline-block; padding: 0 var(--space-2); border-radius: var(--radius-sm); background: var(--blue-light); color: var(--text-link); font-size: 0.6rem; font-weight: 650; }
.trajectory-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
.chart-switch { display: flex; flex-wrap: wrap; gap: var(--space-1); }
.chart-switch button { min-height: 2.75rem; padding: var(--space-2) var(--space-3); background: var(--surface); color: var(--text-muted); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: var(--font-xs); }
.chart-switch button[aria-pressed='true'] { background: var(--blue-light); color: var(--text-link); border-color: var(--blue-border); font-weight: 600; }
.projection-note { color: var(--text-muted); font-size: var(--font-xs); line-height: 1.6; }
.unpaid-panel > p:not(.eyebrow) { font-size: var(--font-sm); color: var(--text-muted); line-height: 1.8; }
.unpaid-panel h2 { margin-top: var(--space-3); }
.unpaid-icon { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border: 1px solid var(--blue-border); border-radius: var(--radius-md); background: var(--blue-light); font-size: 1.5rem; margin-bottom: var(--space-5); }
.unpaid-panel > .unpaid-footnote { font-size: var(--font-xs); }
.blocked-loans { padding-left: var(--space-5); font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.8; }
.blocked-loans li + li { margin-top: var(--space-3); }
</style>
