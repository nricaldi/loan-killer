<script setup lang="ts">
import { computed } from 'vue'
import type { Loan, Projection } from '../domain/loan'
import { formatDate, money } from '../format'
import BalanceChart from './BalanceChart.vue'
import PaymentSchedule from './PaymentSchedule.vue'

const props = defineProps<{ loan: Loan; projection: Projection }>()
const balanceCents = computed(() => props.loan.principalCents + props.loan.accruedInterestCents)
const dailyInterestCents = computed(() => props.loan.principalCents * props.loan.annualRatePercent / 100 / 365)
const principalShare = computed(() => props.projection.status === 'paid-off'
  ? props.loan.principalCents / props.projection.totalPaymentsCents * 100
  : 0)
const paidOffProjection = computed(() => props.projection.status === 'paid-off' ? props.projection : null)
</script>

<template>
  <div class="overview">
    <section class="balance-card" aria-labelledby="balance-heading">
      <div class="balance-header">
        <p id="balance-heading" class="eyebrow">YOUR STARTING BALANCE</p>
        <span class="badge"><span aria-hidden="true" /> Minimum payments</span>
      </div>
      <p class="balance-value">{{ money(balanceCents) }}</p>
      <p class="balance-subtitle"><span class="loan-name">{{ loan.name }}</span><span aria-hidden="true"> · </span>As of {{ formatDate(loan.balanceDate) }}</p>
      <div class="balance-facts">
        <div><span>Monthly payment</span><strong>{{ money(loan.monthlyPaymentCents) }}</strong></div>
        <div><span>Fixed interest rate</span><strong>{{ loan.annualRatePercent }}%</strong></div>
        <div><span>Interest accruing now</span><strong>~{{ money(dailyInterestCents * 365 / 12) }}<small> / month</small></strong></div>
      </div>
      <p class="balance-note">Monthly interest is an average at today’s principal. Actual accrual varies with days between payments.</p>
    </section>

    <template v-if="paidOffProjection">
      <div class="stat-grid" aria-label="Your baseline payoff estimate">
        <section class="stat-card">
          <p class="eyebrow">ESTIMATED DEBT-FREE DATE</p>
          <p class="stat-value payoff-date" data-testid="payoff-date">{{ formatDate(paidOffProjection.payoffDate) }}</p>
          <p class="stat-note">{{ paidOffProjection.paymentCount }} monthly {{ paidOffProjection.paymentCount === 1 ? 'payment' : 'payments' }} to zero</p>
        </section>
        <section class="stat-card">
          <p class="eyebrow">REMAINING INTEREST</p>
          <p class="stat-value" data-testid="remaining-interest">{{ money(paidOffProjection.remainingInterestCents) }}</p>
          <p class="stat-note">Includes {{ money(loan.accruedInterestCents) }} already accrued</p>
        </section>
      </div>

      <section class="panel trajectory-panel" aria-labelledby="trajectory-heading">
        <div class="trajectory-heading">
          <div><p class="eyebrow">THE BIGGER PICTURE</p><h2 id="trajectory-heading">Your path to zero</h2></div>
          <span class="projection-label">PROJECTION</span>
        </div>
        <p class="section-description">One payment at a time. Here’s where consistency takes you.</p>
        <BalanceChart :loan="loan" :projection="paidOffProjection" />
        <div class="finish-line">
          <span class="finish-icon" aria-hidden="true">✓</span>
          <p><strong>A finish line, not a forever balance.</strong><br />Your last estimated payment is {{ money(paidOffProjection.schedule.at(-1)?.paymentCents ?? 0) }}.</p>
        </div>
        <PaymentSchedule :payments="paidOffProjection.schedule" />
      </section>

      <section class="panel cost-panel" aria-labelledby="cost-heading">
        <div class="cost-heading"><h2 id="cost-heading">What you’ll pay from here</h2><strong data-testid="total-payments">{{ money(paidOffProjection.totalPaymentsCents) }}</strong></div>
        <div class="cost-bar" role="img" :aria-label="`${money(loan.principalCents)} principal and ${money(paidOffProjection.remainingInterestCents)} remaining interest`"><span :style="{ width: `${principalShare}%` }" /></div>
        <div class="cost-legend"><span><i class="principal-dot" aria-hidden="true" />Principal <strong>{{ money(loan.principalCents) }}</strong></span><span><i class="interest-dot" aria-hidden="true" />Interest <strong>{{ money(paidOffProjection.remainingInterestCents) }}</strong></span></div>
        <p class="cost-note">{{ money(paidOffProjection.futureInterestCents) }} in new interest after {{ formatDate(loan.balanceDate) }}. Previously paid interest isn’t included.</p>
      </section>
    </template>

    <section v-else class="panel unpaid-panel" aria-labelledby="unpaid-heading">
      <span class="unpaid-icon" aria-hidden="true">↗</span>
      <p class="eyebrow">LET’S CHECK THAT PAYMENT</p>
      <h2 id="unpaid-heading">{{ projection.status === 'insufficient-payment' ? 'This payment isn’t getting you to zero.' : 'The payoff is beyond this projection.' }}</h2>
      <p v-if="projection.status === 'insufficient-payment'">Over a full year at the end of the projection, this payment doesn’t cover new interest. Your balance isn’t decreasing. Double-check your minimum with your servicer, or enter a higher monthly payment.</p>
      <p v-else>The loan still has a balance after 1,200 monthly payments. We cap estimates there rather than show an unreliable finish date. Check your figures or try a higher payment.</p>
      <p class="unpaid-footnote">No payoff date or lifetime interest total is shown because the loan does not pay off within the projection.</p>
      <PaymentSchedule :payments="projection.schedule.slice(0, 12)" />
      <p class="unpaid-footnote">The breakdown above shows only the first 12 projected payments.</p>
    </section>
  </div>
</template>

<style scoped>
.overview { display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; }
.balance-card { padding: var(--space-7); border-radius: var(--radius-lg); background: var(--blue-primary); border: 1px solid var(--blue-border); }
.balance-card .eyebrow { color: var(--text-secondary); }
.balance-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-3); }
.badge { display: inline-flex; align-items: center; gap: var(--space-2); background: var(--blue-light); padding: 0.4rem 0.6rem; border-radius: var(--radius-full); color: var(--text-link); font-size: var(--font-xs); font-weight: 600; }
.badge > span { width: 0.35rem; height: 0.35rem; border-radius: 50%; background: var(--text-link); }
.balance-value { font-size: clamp(2.5rem, 5vw, 3.5rem); line-height: 1.15; font-weight: 650; letter-spacing: -0.06em; margin: var(--space-4) 0 var(--space-2); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.balance-subtitle { color: var(--text-secondary); font-size: var(--font-xs); margin: 0; line-height: 1.7; overflow-wrap: anywhere; }
.balance-facts { display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: var(--space-4); margin-top: var(--space-6); padding-top: var(--space-5); border-top: 1px solid var(--blue-divider); }
.balance-facts > div { display: flex; flex-direction: column; gap: var(--space-2); }
.balance-facts span { color: var(--text-secondary); font-size: var(--font-xs); }
.balance-facts strong { font-size: var(--font-md); font-weight: 600; font-variant-numeric: tabular-nums; }
.balance-facts small { font-size: var(--font-xs); font-weight: 400; white-space: nowrap; }
.balance-note { color: var(--text-secondary); font-size: var(--font-xs); line-height: 1.6; margin: var(--space-4) 0 0; }
.stat-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-5); }
.stat-card { min-width: 0; padding: var(--space-5) var(--space-6); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); }
.stat-value { margin: var(--space-3) 0 var(--space-2); font-size: clamp(1.35rem, 2.7vw, 1.85rem); font-weight: 600; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.stat-note { color: var(--text-muted); font-size: var(--font-xs); margin: 0; line-height: 1.6; }
.trajectory-panel, .cost-panel, .unpaid-panel { padding: var(--space-6); }
.trajectory-heading, .cost-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
.projection-label { color: var(--text-muted); font-size: 0.6rem; letter-spacing: 0.09em; padding: 0.4rem 0.6rem; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.section-description { color: var(--text-muted); font-size: var(--font-sm); line-height: 1.6; margin: var(--space-3) 0 0; }
.finish-line { display: flex; align-items: center; gap: var(--space-3); background: var(--surface-muted); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); margin-top: var(--space-5); }
.finish-icon { display: grid; place-items: center; flex-shrink: 0; width: 1.75rem; height: 1.75rem; border-radius: 50%; border: 1px solid var(--blue-border); color: var(--text-link); background: var(--blue-light); font-size: var(--font-sm); }
.finish-line p { font-size: var(--font-xs); line-height: 1.7; margin: 0; color: var(--text-muted); }
.finish-line strong { font-weight: 550; color: var(--text); }
.cost-heading h2 { font-size: var(--font-md); }
.cost-heading > strong { font-size: var(--font-lg); font-weight: 600; font-variant-numeric: tabular-nums; }
.cost-bar { display: flex; height: 0.65rem; margin: var(--space-5) 0 var(--space-4); border-radius: var(--radius-full); background: var(--chart-interest); overflow: hidden; }
.cost-bar span { display: block; height: 100%; background: var(--chart-line); }
.cost-legend { display: flex; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; font-size: var(--font-xs); color: var(--text-muted); }
.cost-legend > span { display: flex; align-items: center; gap: var(--space-2); }
.cost-legend strong { color: var(--text); font-weight: 500; }
.cost-legend i { width: 0.5rem; height: 0.5rem; border-radius: 50%; }
.principal-dot { background: var(--chart-line); }
.interest-dot { background: var(--chart-interest); }
.cost-note { color: var(--text-muted); font-size: var(--font-xs); line-height: 1.7; margin: var(--space-4) 0 0; }
.unpaid-panel > p:not(.eyebrow) { font-size: var(--font-sm); color: var(--text-muted); line-height: 1.8; }
.unpaid-panel h2 { margin-top: var(--space-3); }
.unpaid-icon { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border: 1px solid var(--blue-border); border-radius: var(--radius-md); background: var(--blue-light); font-size: 1.5rem; margin-bottom: var(--space-5); }
.unpaid-panel > .unpaid-footnote { font-size: var(--font-xs); }
@media (max-width: 35rem) { .balance-card { padding: var(--space-5); } .balance-facts { grid-template-columns: 1fr 1fr; } .balance-facts > div:last-child { grid-column: 1 / -1; } .stat-grid { gap: var(--space-3); } .stat-card { padding: var(--space-4); } .trajectory-panel, .cost-panel, .unpaid-panel { padding: var(--space-4); } }
@media (max-width: 23rem) { .stat-grid { grid-template-columns: 1fr; } }
</style>
