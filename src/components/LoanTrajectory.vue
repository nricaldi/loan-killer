<script setup lang="ts">
import { computed } from 'vue'
import type { PortfolioProjection } from '../domain/portfolio'
import { balanceWindow } from '../domain/balanceWindow'
import { addMonths } from '../domain/dates'
import { money } from '../format'
import BalanceChart from './BalanceChart.vue'

const props = defineProps<{
  portfolio: PortfolioProjection
  comparison?: { portfolio: PortfolioProjection; label: string } | null
}>()
const paidOffProjection = computed(() => props.portfolio.projection.status === 'paid-off' ? props.portfolio.projection : null)
const current = computed(() => props.comparison?.portfolio.projection ?? props.portfolio.projection)
const currentPaid = computed(() => current.value.status === 'paid-off' ? current.value : null)
const balanceCents = computed(() => props.portfolio.principalCents + props.portfolio.accruedInterestCents)
const interestSaved = computed(() => paidOffProjection.value && currentPaid.value
  ? paidOffProjection.value.totalPaymentsCents - currentPaid.value.totalPaymentsCents : null)
const newInterestCents = computed(() => currentPaid.value ? Math.max(0, currentPaid.value.totalPaymentsCents - balanceCents.value) : 0)
const scaleCents = computed(() => Math.max(paidOffProjection.value?.totalPaymentsCents ?? 0, currentPaid.value?.totalPaymentsCents ?? 0, balanceCents.value, 1))
const debtPercent = computed(() => balanceCents.value / scaleCents.value * 100)
const interestPercent = computed(() => newInterestCents.value / scaleCents.value * 100)
const savedPercent = computed(() => Math.max(0, interestSaved.value ?? 0) / scaleCents.value * 100)
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
    <div class="sr-only">
      <h2 id="outlook-heading" tabindex="-1">Your payoff outlook</h2>
    </div>
    <p class="sr-only">With <strong data-testid="monthly-minimum">{{ money(portfolio.monthlyPaymentCents) }}</strong> in monthly minimums</p>
    <div class="visual-outlook" aria-live="polite" aria-atomic="true">
      <section class="repayment-visual" aria-labelledby="repayment-heading">
        <div class="metric-heading"><h3 id="repayment-heading">Total to repay</h3><strong v-if="currentPaid" data-testid="total-payments">{{ money(currentPaid.totalPaymentsCents) }}</strong><strong v-else>No complete estimate</strong></div>

        <div class="repayment-track" :class="{ incomplete: !currentPaid }" role="img" :aria-label="currentPaid ? `Amount owed ${money(balanceCents)} including ${money(portfolio.accruedInterestCents)} accrued interest, future interest ${money(newInterestCents)}${interestSaved !== null ? `, ${money(Math.abs(interestSaved))} ${interestSaved >= 0 ? 'saved' : 'more to repay'} compared with minimums (${money(paidOffProjection!.totalPaymentsCents)} total)` : '. Baseline savings unavailable'}` : 'No complete repayment estimate. Try increasing the monthly payment.'">
          <template v-if="currentPaid"><span class="debt-segment" :style="{ width: `${debtPercent}%` }" /><span class="interest-segment" :class="{ empty: !newInterestCents }" :style="{ width: `${interestPercent}%` }" /><span class="saved-segment" :class="{ empty: !savedPercent }" :style="{ width: `${savedPercent}%` }" /></template>
        </div>
        <div class="segment-labels">
          <div><span><i class="debt-key" />Amount owed</span><b data-testid="starting-balance">{{ money(balanceCents) }}</b></div>
          <div><span><i class="interest-key" />Future interest</span><b v-if="currentPaid" data-testid="remaining-interest">{{ money(newInterestCents) }}</b><b v-else>Not available</b></div>
          <div :class="{ 'extra-cost': interestSaved !== null && interestSaved < 0 }"><span><i class="saved-key" />{{ interestSaved !== null && interestSaved < 0 ? 'Extra cost' : 'Saved' }}</span><b v-if="interestSaved !== null" data-testid="plan-interest-saved">{{ money(Math.abs(interestSaved)) }}<span class="sr-only"> {{ interestSaved >= 0 ? 'saved' : 'more interest' }}</span></b><b v-else>Not available</b></div>
        </div>
      </section>
    </div>

    <BalanceChart :balance-date="portfolio.balanceDate" :initial-balance-cents="balanceCents" :projection="baseline.projection" :end-point="baseline.endPoint" label="Minimum payments" :comparison="chartComparison" :payoff-date="currentPaid?.payoffDate" :baseline-payoff-date="paidOffProjection?.payoffDate" />
    <p v-if="horizon" class="horizon-note">Showing the first 50 years. A line ending above zero still has a balance.</p>
  </section>
</template>

<style scoped>
.journey-visual { min-width: 0; padding: var(--space-4); }
.visual-outlook { min-width: 0; }
h3 { font-size: var(--font-sm); margin: 0; font-weight: 650; }
.metric-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; min-height: 3rem; }
.metric-heading > strong { font-size: var(--font-lg); font-variant-numeric: tabular-nums; text-align: right; }
.repayment-track { height: 24px; display: flex; gap: 4px; margin-top: 8px; }
.repayment-track.incomplete { background: var(--border); border-radius: 5px; }
.repayment-track > span { height: 100%; flex: 0 1 auto; min-width: 0; border-radius: 5px; transition: width 180ms ease-out; }
.repayment-track > .empty { display: none; }
.debt-segment, .debt-key { background: var(--highlight-background); }
.interest-segment, .interest-key { background: var(--blue-primary); }
.saved-segment, .saved-key { background: var(--savings); }
.segment-labels > :last-child b { color: var(--savings-text); }
.segment-labels > .extra-cost b { color: var(--danger); }
.extra-cost .saved-key { background: var(--danger); }
.segment-labels { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.segment-labels > div { min-width: 0; }
.segment-labels span { font-size: 12px; color: var(--text-secondary); }
.segment-labels i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 5px; }
.segment-labels b { display: block; margin-top: 5px; font-size: var(--font-sm); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; min-height: 2.8em; line-height: 1.4; }
@media (prefers-reduced-motion: reduce) { .repayment-track > span { transition: none; } }
.horizon-note { color: var(--text-muted); font-size: var(--font-sm); margin: var(--space-3) 0 0; }
@media (max-width: 35rem) { .journey-visual { padding: var(--space-4); } }
</style>
