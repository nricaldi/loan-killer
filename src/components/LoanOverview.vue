<script setup lang="ts">
import { computed } from 'vue'
import type { PortfolioProjection } from '../domain/portfolio'
import { formatDate, money } from '../format'
import LoanTrajectory from './LoanTrajectory.vue'

const props = defineProps<{ portfolio: PortfolioProjection; comparison?: { portfolio: PortfolioProjection; label: string } | null }>()
const projection = computed(() => props.portfolio.projection)
const loanCount = computed(() => props.portfolio.loans.length)
const balanceCents = computed(() => props.portfolio.principalCents + props.portfolio.accruedInterestCents)
const title = computed(() => loanCount.value === 1
  ? props.portfolio.loans[0]?.loan.name
  : `${loanCount.value} federal student loans`)
const rate = computed(() => {
  const percent = loanCount.value === 1
    ? props.portfolio.loans[0]?.loan.annualRatePercent
    : props.portfolio.weightedRatePercent
  return percent === null || percent === undefined
    ? '—'
    : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: loanCount.value === 1 ? 4 : 3 }).format(percent)}%`
})
const paidOffProjection = computed(() => projection.value.status === 'paid-off' ? projection.value : null)
</script>

<template>
  <div class="overview">
    <div class="summary-grid" aria-label="Your baseline payoff estimate">
      <section class="stat-card">
        <p class="eyebrow">STARTING BALANCE</p>
        <p class="stat-value" data-testid="starting-balance">{{ money(balanceCents) }}</p>
        <p class="stat-note">As of {{ formatDate(portfolio.balanceDate) }} · {{ title }}</p>
      </section>
      <section class="stat-card">
        <p class="eyebrow">TOTAL INTEREST TO PAY</p>
        <p v-if="paidOffProjection" class="stat-value" data-testid="remaining-interest">{{ money(paidOffProjection.remainingInterestCents) }}</p>
        <p v-else class="stat-value unavailable-value">Not available</p>
        <p v-if="paidOffProjection" class="stat-note cost-note">Includes {{ money(portfolio.accruedInterestCents) }} already accrued + {{ money(paidOffProjection.futureInterestCents) }} projected.</p>
        <p v-else class="stat-note">A complete payoff estimate is needed.</p>
      </section>
      <section v-if="paidOffProjection" class="total-card" aria-labelledby="cost-heading">
        <p id="cost-heading" class="eyebrow">ESTIMATED TOTAL TO REPAY</p>
        <p class="total-value" data-testid="total-payments">{{ money(paidOffProjection.totalPaymentsCents) }}</p>
        <p class="stat-note">Includes <strong data-testid="principal-total">{{ money(portfolio.principalCents) }}</strong> principal + interest.<br />From here, with your saved minimums.</p>
      </section>
      <section v-else class="stat-card">
        <p class="eyebrow">ESTIMATED TOTAL TO REPAY</p><p class="stat-value unavailable-value">Not available</p><p class="stat-note">Check the payment warning below.</p>
      </section>
    </div>

    <section class="journey-panel" aria-label="Explore your payment journey">
      <slot name="loans" />
      <div class="journey-content">
        <slot name="journey">
          <LoanTrajectory :portfolio="portfolio" :comparison="comparison" />
        </slot>
      </div>
    </section>

    <section class="panel balance-card" aria-labelledby="balance-heading">
      <div class="balance-header">
        <div>
          <h2 id="balance-heading">Balance details</h2>
          <p class="balance-subtitle"><span class="loan-name">{{ title }}</span> · As of {{ formatDate(portfolio.balanceDate) }}</p>
        </div>
        <div class="starting-balance"><span>{{ loanCount > 1 ? 'Combined minimum' : 'Monthly minimum' }}</span><strong><span data-testid="monthly-minimum">{{ money(portfolio.monthlyPaymentCents) }}</span><small> / month</small></strong></div>
      </div>
      <details class="balance-details">
        <summary>Rates and interest details</summary>
        <div class="balance-facts">
          <div><span>Starting principal</span><strong>{{ money(portfolio.principalCents) }}</strong></div>
          <div><span>{{ loanCount > 1 ? 'Principal-weighted rate' : 'Fixed interest rate' }}</span><strong>{{ rate }}</strong></div>
          <div><span>Interest at starting principal</span><strong>~{{ money(portfolio.annualInterestCents / 12) }}<small> / month</small></strong></div>
        </div>
        <p class="balance-note">Monthly interest is an average at your starting principal. Actual accrual varies with days between payments.</p>
        <p v-if="loanCount > 1" class="balance-note">The rate is weighted by principal, not a new loan rate. Your combined minimum decreases as individual loans are paid off; freed payments aren’t rolled over.</p>
      </details>
    </section>
  </div>
</template>

<style scoped>
.overview { display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; }
.balance-card { padding: var(--space-4) var(--space-5); }
.balance-card h2 { font-size: var(--font-md); }
.balance-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-3); }
.starting-balance { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--space-3); font-size: var(--font-xs); color: var(--text-muted); }
.starting-balance strong { font-size: var(--font-lg); color: var(--text); font-variant-numeric: tabular-nums; }
.balance-details { margin-top: var(--space-3); }
.balance-details summary { cursor: pointer; font-size: var(--font-xs); color: var(--text-link); }
.balance-subtitle { color: var(--text-secondary); font-size: var(--font-xs); margin: 0; line-height: 1.7; overflow-wrap: anywhere; }
.balance-facts { display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: var(--space-4); margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--border); }
.balance-facts > div { display: flex; flex-direction: column; gap: var(--space-2); }
.balance-facts span { color: var(--text-secondary); font-size: var(--font-xs); }
.balance-facts strong { font-size: var(--font-md); font-weight: 600; font-variant-numeric: tabular-nums; }
.balance-facts small { font-size: var(--font-xs); font-weight: 400; white-space: nowrap; }
.balance-note { color: var(--text-secondary); font-size: var(--font-xs); line-height: 1.6; margin: var(--space-4) 0 0; }
.summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); }
.stat-card, .total-card { min-width: 0; padding: var(--space-5); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); }
.total-card { background: var(--highlight-background); border-color: var(--highlight-background); color: var(--highlight-text); }
.total-card .eyebrow, .total-card .stat-note { color: var(--highlight-muted); }
.total-card strong { color: var(--highlight-text); }
.total-value { font-size: clamp(2rem, 3.5vw, 2.75rem); font-weight: 650; line-height: 1.15; letter-spacing: -0.05em; margin: var(--space-3) 0 var(--space-2); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.stat-value { margin: var(--space-3) 0 var(--space-2); font-size: clamp(1.75rem, 3vw, 2.25rem); font-weight: 600; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.unavailable-value { font-size: var(--font-lg); }
.stat-note { color: var(--text-muted); font-size: var(--font-xs); margin: 0; line-height: 1.6; }
.journey-panel { min-width: 0; }
.journey-content { display: grid; gap: var(--space-5); min-width: 0; }
.cost-note { color: var(--text-secondary); font-size: var(--font-xs); line-height: 1.6; }
@media (max-width: 55rem) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .total-card { grid-column: 1 / -1; } }
@media (max-width: 35rem) { .balance-card, .stat-card, .total-card { padding: var(--space-4); } .balance-facts { grid-template-columns: 1fr 1fr; } .balance-facts > div:last-child { grid-column: 1 / -1; } .summary-grid { gap: var(--space-3); } .stat-value { font-size: clamp(1.1rem, 5.5vw, 1.5rem); } .starting-balance small { font-size: var(--font-xs); } }
</style>
