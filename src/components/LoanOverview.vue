<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PortfolioProjection } from '../domain/portfolio'
import { formatDate, money } from '../format'
import BalanceChart from './BalanceChart.vue'
import PaymentsChart from './PaymentsChart.vue'
import PaymentSchedule from './PaymentSchedule.vue'

const props = defineProps<{ portfolio: PortfolioProjection }>()
const chartView = ref<'payments' | 'balance'>('payments')
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
const principalShare = computed(() => projection.value.status === 'paid-off'
  ? props.portfolio.principalCents / projection.value.totalPaymentsCents * 100
  : 0)
const paidOffProjection = computed(() => projection.value.status === 'paid-off' ? projection.value : null)
const blockedLoans = computed(() => props.portfolio.loans.filter(({ projection }) => projection.status !== 'paid-off'))
</script>

<template>
  <div class="overview">
    <div class="summary-grid" :class="{ 'incomplete-estimate': !paidOffProjection }" aria-label="Your baseline payoff estimate">
      <section v-if="paidOffProjection" class="total-card" aria-labelledby="cost-heading">
        <p id="cost-heading" class="eyebrow">ESTIMATED TOTAL TO REPAY</p>
        <p class="total-value" data-testid="total-payments">{{ money(paidOffProjection.totalPaymentsCents) }}</p>
        <p class="stat-note">From your balance date, with minimum payments</p>
        <div class="cost-bar" role="img" :aria-label="`${money(portfolio.principalCents)} principal and ${money(paidOffProjection.remainingInterestCents)} remaining interest`"><span :style="{ width: `${principalShare}%` }" /></div>
        <div class="cost-legend">
          <span><i class="principal-dot" aria-hidden="true" />Principal <strong data-testid="principal-total">{{ money(portfolio.principalCents) }}</strong></span>
          <span><i class="interest-dot" aria-hidden="true" />Interest <strong data-testid="remaining-interest">{{ money(paidOffProjection.remainingInterestCents) }}</strong></span>
        </div>
        <p class="cost-note">Interest includes {{ money(portfolio.accruedInterestCents) }} already accrued + {{ money(paidOffProjection.futureInterestCents) }} projected. Previously paid amounts aren’t included.</p>
      </section>
      <section v-if="paidOffProjection" class="stat-card payoff-card">
        <p class="eyebrow">ESTIMATED DEBT-FREE DATE</p>
        <p class="stat-value payoff-date" data-testid="payoff-date">{{ formatDate(paidOffProjection.payoffDate) }}</p>
        <p class="stat-note">{{ paidOffProjection.paymentCount }} {{ loanCount > 1 ? `payments across ${loanCount} loans` : `monthly ${paidOffProjection.paymentCount === 1 ? 'payment' : 'payments'} to zero` }}</p>
      </section>
      <section class="stat-card monthly-card">
        <p class="eyebrow">{{ loanCount > 1 ? 'COMBINED MONTHLY MINIMUM' : 'MONTHLY MINIMUM' }}</p>
        <p class="stat-value" data-testid="monthly-minimum">{{ money(portfolio.monthlyPaymentCents) }}</p>
        <p class="stat-note">{{ loanCount > 1 ? 'Starting monthly payment across your loans' : 'Your scheduled monthly payment' }}</p>
      </section>
    </div>

    <template v-if="paidOffProjection">
      <section class="panel trajectory-panel" aria-labelledby="trajectory-heading">
        <div class="trajectory-heading">
          <h2 id="trajectory-heading">{{ chartView === 'payments' ? 'What you’ll pay over time' : 'Your path to zero' }}</h2>
          <div class="chart-switch" role="group" aria-label="Projection chart view">
            <button type="button" :aria-pressed="chartView === 'payments'" @click="chartView = 'payments'">Total paid over time</button>
            <button type="button" :aria-pressed="chartView === 'balance'" @click="chartView = 'balance'">Remaining balance</button>
          </div>
        </div>
        <PaymentsChart v-if="chartView === 'payments'" :balance-date="portfolio.balanceDate" :projection="paidOffProjection" />
        <BalanceChart v-else :balance-date="portfolio.balanceDate" :initial-balance-cents="balanceCents" :projection="paidOffProjection" />
        <PaymentSchedule :payments="paidOffProjection.schedule" :combined="loanCount > 1" />
      </section>
    </template>

    <section v-else class="panel unpaid-panel" aria-labelledby="unpaid-heading">
      <span class="unpaid-icon" aria-hidden="true">↗</span>
      <p class="eyebrow">LET’S CHECK THAT PAYMENT</p>
      <h2 id="unpaid-heading">{{ loanCount > 1 ? 'Some loans need a payment check.' : projection.status === 'insufficient-payment' ? 'This payment isn’t getting you to zero.' : 'The payoff is beyond this projection.' }}</h2>
      <p v-if="loanCount > 1">At least one loan doesn’t pay off within its 1,200-payment limit. An overall payoff date and complete interest total would be misleading, so we haven’t shown them. Open an individual loan to inspect its schedule.</p>
      <p v-else-if="projection.status === 'insufficient-payment'">Over a full year at the end of the projection, this payment doesn’t cover new interest. Your balance isn’t decreasing. Double-check your minimum with your servicer, or enter a higher monthly payment.</p>
      <p v-else>The loan still has a balance after 1,200 monthly payments. We cap estimates there rather than show an unreliable finish date. Check your figures or try a higher payment.</p>
      <p class="unpaid-footnote">No payoff date or lifetime interest total is shown because the loan does not pay off within the projection.</p>
      <ul v-if="loanCount > 1" class="blocked-loans">
        <li v-for="entry in blockedLoans" :key="entry.loan.id"><strong>{{ entry.loan.name }}</strong> — {{ entry.projection.status === 'insufficient-payment' ? 'Payment doesn’t cover ongoing interest.' : 'Beyond the projection limit.' }}</li>
      </ul>
      <template v-else>
        <PaymentSchedule :payments="projection.schedule.slice(0, 12)" />
        <p class="unpaid-footnote">The breakdown above shows only the first 12 projected payments.</p>
      </template>
    </section>

    <section class="panel balance-card" aria-labelledby="balance-heading">
      <div class="balance-header">
        <div>
          <h2 id="balance-heading">Balance details</h2>
          <p class="balance-subtitle"><span class="loan-name">{{ title }}</span> · As of {{ formatDate(portfolio.balanceDate) }}</p>
        </div>
        <div class="starting-balance"><span>Starting balance</span><strong data-testid="starting-balance">{{ money(balanceCents) }}</strong></div>
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
.summary-grid { display: grid; grid-template-columns: 1.5fr 1fr 0.85fr; gap: var(--space-4); }
.summary-grid.incomplete-estimate { grid-template-columns: 1fr; }
.stat-card, .total-card { min-width: 0; padding: var(--space-5); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); }
.total-card { background: var(--blue-primary); border-color: var(--blue-border); }
.total-card .eyebrow { color: var(--text-secondary); }
.total-value { font-size: clamp(2rem, 3.5vw, 2.75rem); font-weight: 650; line-height: 1.15; letter-spacing: -0.05em; margin: var(--space-3) 0 var(--space-2); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.stat-value { margin: var(--space-3) 0 var(--space-2); font-size: clamp(1.35rem, 2.7vw, 1.85rem); font-weight: 600; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.stat-note { color: var(--text-muted); font-size: var(--font-xs); margin: 0; line-height: 1.6; }
.trajectory-panel, .unpaid-panel { padding: var(--space-5); }
.trajectory-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
.chart-switch { display: flex; flex-wrap: wrap; gap: var(--space-1); }
.chart-switch button { min-height: 2.75rem; padding: var(--space-2) var(--space-3); background: var(--surface); color: var(--text-muted); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: var(--font-xs); }
.chart-switch button[aria-pressed='true'] { background: var(--blue-light); color: var(--text-link); border-color: var(--blue-border); font-weight: 600; }
.cost-bar { display: flex; height: 0.65rem; margin: var(--space-5) 0 var(--space-4); border-radius: var(--radius-full); background: var(--chart-interest); overflow: hidden; }
.cost-bar span { display: block; height: 100%; background: var(--chart-line); }
.cost-legend { display: flex; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; font-size: var(--font-xs); color: var(--text-muted); }
.cost-legend > span { display: flex; align-items: center; gap: var(--space-2); }
.cost-legend strong { color: var(--text); font-weight: 500; }
.cost-legend i { width: 0.5rem; height: 0.5rem; border-radius: 50%; }
.principal-dot { background: var(--chart-line); }
.interest-dot { background: var(--chart-interest); }
.cost-note { color: var(--text-secondary); font-size: var(--font-xs); line-height: 1.6; margin: var(--space-3) 0 0; }
.unpaid-panel > p:not(.eyebrow) { font-size: var(--font-sm); color: var(--text-muted); line-height: 1.8; }
.unpaid-panel h2 { margin-top: var(--space-3); }
.unpaid-icon { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border: 1px solid var(--blue-border); border-radius: var(--radius-md); background: var(--blue-light); font-size: 1.5rem; margin-bottom: var(--space-5); }
.unpaid-panel > .unpaid-footnote { font-size: var(--font-xs); }
.blocked-loans { padding-left: var(--space-5); font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.8; }
.blocked-loans li + li { margin-top: var(--space-3); }
@media (max-width: 55rem) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .total-card { grid-column: 1 / -1; } }
@media (max-width: 35rem) { .balance-card, .stat-card, .total-card, .trajectory-panel, .unpaid-panel { padding: var(--space-4); } .balance-facts { grid-template-columns: 1fr 1fr; } .balance-facts > div:last-child { grid-column: 1 / -1; } .summary-grid { gap: var(--space-3); } }
@media (max-width: 23rem) { .summary-grid { grid-template-columns: 1fr; } }
</style>
