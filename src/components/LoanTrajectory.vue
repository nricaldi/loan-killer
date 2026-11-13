<script setup lang="ts">
import { computed } from 'vue'
import type { PortfolioProjection } from '../domain/portfolio'
import { balanceWindow } from '../domain/balanceWindow'
import { addMonths, daysBetween } from '../domain/dates'
import { dateDistance, formatDate, money } from '../format'
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
const timeSaved = computed(() => paidOffProjection.value && currentPaid.value
  ? dateDistance(currentPaid.value.payoffDate, paidOffProjection.value.payoffDate) : null)
const newInterestCents = computed(() => currentPaid.value ? Math.max(0, currentPaid.value.totalPaymentsCents - balanceCents.value) : 0)
const scaleCents = computed(() => Math.max(paidOffProjection.value?.totalPaymentsCents ?? 0, currentPaid.value?.totalPaymentsCents ?? 0, balanceCents.value, 1))
const debtPercent = computed(() => balanceCents.value / scaleCents.value * 100)
const interestPercent = computed(() => newInterestCents.value / scaleCents.value * 100)
const savedPercent = computed(() => Math.max(0, interestSaved.value ?? 0) / scaleCents.value * 100)
const timelineEnd = computed(() => [paidOffProjection.value?.payoffDate, currentPaid.value?.payoffDate].filter((date): date is string => !!date).sort().at(-1))
function datePercent(date: string) {
  const span = timelineEnd.value ? daysBetween(props.portfolio.balanceDate, timelineEnd.value) : 0
  return span > 0 ? Math.max(0, Math.min(100, daysBetween(props.portfolio.balanceDate, date) / span * 100)) : 0
}
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
    <div class="visual-outlook" aria-live="polite" aria-atomic="true">
      <section class="repayment-visual" aria-labelledby="repayment-heading">
        <div class="metric-heading"><h3 id="repayment-heading">Total to repay</h3><strong v-if="currentPaid" data-testid="total-payments">{{ money(currentPaid.totalPaymentsCents) }}</strong><strong v-else>No complete estimate</strong></div>
        <p class="baseline-value">Minimums: <span :data-testid="comparison ? 'baseline-total' : undefined">{{ paidOffProjection ? money(paidOffProjection.totalPaymentsCents) : 'No complete estimate' }}</span></p>
        <div class="repayment-track" role="img" :aria-label="currentPaid ? `Amount owed ${money(balanceCents)}, future interest ${money(newInterestCents)}${interestSaved !== null ? `, ${money(Math.abs(interestSaved))} ${interestSaved >= 0 ? 'saved' : 'more to repay'} compared with minimums` : '. Baseline savings unavailable'}` : 'No complete repayment estimate. Try increasing the monthly payment.'">
          <template v-if="currentPaid"><span class="debt-segment" :style="{ width: `${debtPercent}%` }" /><span class="interest-segment" :style="{ width: `${interestPercent}%` }" /><span class="saved-segment" :style="{ width: `${savedPercent}%` }" /></template>
          <span v-if="paidOffProjection" class="baseline-cost-marker" :style="{ left: `${paidOffProjection.totalPaymentsCents / scaleCents * 100}%` }" />
        </div>
        <div class="segment-labels">
          <div><span><i class="debt-key" />Amount owed</span><b data-testid="starting-balance">{{ money(balanceCents) }}</b></div>
          <div><span><i class="interest-key" />Future interest</span><b v-if="currentPaid" data-testid="remaining-interest">{{ money(newInterestCents) }}</b><b v-else>Not available</b></div>
          <div><span><i class="saved-key" />{{ interestSaved !== null && interestSaved < 0 ? 'Extra cost' : 'Saved' }}</span><b v-if="interestSaved !== null" data-testid="plan-interest-saved">{{ money(Math.abs(interestSaved)) }}<span class="sr-only"> {{ interestSaved >= 0 ? 'saved' : 'more interest' }}</span></b><b v-else>Not available</b></div>
        </div>
        <p class="snapshot-note"><template v-if="portfolio.accruedInterestCents">Amount owed includes {{ money(portfolio.accruedInterestCents) }} accrued interest.</template><template v-else-if="!currentPaid">Increase your monthly payment to find a complete payoff plan.</template><template v-else-if="!paidOffProjection">Minimums have no complete payoff estimate; savings are unavailable.</template></p>
      </section>
      <section class="payoff-visual" aria-labelledby="payoff-heading">
        <h3 id="payoff-heading">When you’re debt-free</h3>
        <div class="payoff-dates"><div><span>Your plan</span><strong v-if="currentPaid" data-testid="payoff-date">{{ formatDate(currentPaid.payoffDate) }}</strong><strong v-else>No payoff date</strong></div><div><span>Minimums</span><span :data-testid="comparison ? 'baseline-date' : undefined">{{ paidOffProjection ? formatDate(paidOffProjection.payoffDate) : 'No payoff date' }}</span></div></div>
        <div class="payoff-timeline" role="img" :aria-label="`Starting ${formatDate(portfolio.balanceDate)}. Your plan: ${currentPaid ? formatDate(currentPaid.payoffDate) : 'no payoff date'}. Minimums: ${paidOffProjection ? formatDate(paidOffProjection.payoffDate) : 'no payoff date'}.`"><div v-if="currentPaid" class="time-progress" :style="{ width: `${datePercent(currentPaid.payoffDate)}%` }" /><span class="today-marker" /><span v-if="paidOffProjection" class="baseline-marker" :style="{ left: `${datePercent(paidOffProjection.payoffDate)}%` }" /><span v-if="currentPaid" class="plan-marker" :style="{ left: `${datePercent(currentPaid.payoffDate)}%` }" /></div>
        <div class="time-caption"><span>Balance date · {{ formatDate(portfolio.balanceDate, true) }}</span><span v-if="timelineEnd">{{ formatDate(timelineEnd, true) }}</span></div>
        <p class="time-saved" data-testid="plan-time-saved"><template v-if="timeSaved">{{ currentPaid!.payoffDate === paidOffProjection!.payoffDate ? 'Same payoff date' : `${timeSaved} ${currentPaid!.payoffDate < paidOffProjection!.payoffDate ? 'sooner' : 'later'}` }}</template><template v-else>{{ currentPaid ? 'A payoff date with this plan' : 'No payoff date yet' }}</template></p>
      </section>
    </div>

    <BalanceChart :balance-date="portfolio.balanceDate" :initial-balance-cents="balanceCents" :projection="baseline.projection" :end-point="baseline.endPoint" label="Minimum payments" :comparison="chartComparison" />
    <p v-if="horizon" class="horizon-note">Showing the first 50 years. A line ending above zero still has a balance.</p>
  </section>
</template>

<style scoped>
.journey-visual { min-width: 0; padding: var(--space-5); }
.trajectory-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--space-2); }
.baseline-context { font-size: var(--font-sm); color: var(--text-secondary); margin: var(--space-2) 0 0; }
.visual-outlook { display: grid; gap: 24px; margin-top: 24px; }
h3 { font-size: var(--font-sm); margin: 0; font-weight: 650; }
.metric-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; min-height: 3rem; }
.metric-heading > strong { font-size: var(--font-lg); font-variant-numeric: tabular-nums; text-align: right; }
.baseline-value { font-size: 12px; color: var(--text-secondary); margin: 6px 0 14px; }
.repayment-track { position: relative; height: 24px; display: flex; overflow: hidden; border-radius: 5px; background: var(--border); }
.repayment-track > span { height: 100%; flex: 0 0 auto; transition: width 180ms ease-out; }
.repayment-track > .baseline-cost-marker { position: absolute; width: 2px; top: 0; bottom: 0; background: var(--text-placeholder); transform: translateX(-2px); transition: left 180ms ease-out; }
.debt-segment, .debt-key { background: var(--highlight-background); }
.interest-segment, .interest-key { background: var(--blue-primary); }
.saved-segment, .saved-key { background: var(--border); background-image: repeating-linear-gradient(135deg, transparent 0 4px, var(--text-placeholder) 4px 5px); }
.segment-labels { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.segment-labels > div { min-width: 0; }
.segment-labels span { font-size: 12px; color: var(--text-secondary); }
.segment-labels i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 5px; }
.segment-labels b { display: block; margin-top: 5px; font-size: var(--font-sm); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; min-height: 2.8em; line-height: 1.4; }
.snapshot-note { font-size: 12px; line-height: 1.5; color: var(--text-secondary); height: 4.5em; margin: 10px 0 0; }
.payoff-dates { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 12px 0 18px; }
.payoff-dates > div { min-width: 0; }
.payoff-dates > div:last-child { text-align: right; }
.payoff-dates span, .payoff-dates strong { display: block; font-size: var(--font-sm); line-height: 1.4; font-variant-numeric: tabular-nums; }
.payoff-dates > div > :first-child { font-size: 12px; margin-bottom: 4px; color: var(--text-secondary); }
.payoff-dates > div > :last-child { min-height: 2.8em; }
.payoff-dates strong { color: var(--text-link); }
.payoff-timeline { position: relative; height: 4px; margin-inline: 6px; background: var(--border-strong); }
.time-progress { height: 100%; background: var(--chart-line); transition: width 180ms ease-out; }
.payoff-timeline > span { position: absolute; top: 50%; width: 12px; height: 12px; border-radius: 50%; transform: translate(-50%, -50%); }
.today-marker { left: 0; background: var(--text-placeholder); }
.baseline-marker { border: 2px solid var(--text-placeholder); background: var(--surface); }
.plan-marker { background: var(--chart-line); transition: left 180ms ease-out; }
.time-caption { display: flex; justify-content: space-between; gap: 12px; color: var(--text-muted); font-size: 11px; margin-top: 12px; }
.time-saved { min-height: 3em; margin: 12px 0 0; color: var(--text-link); font-size: var(--font-sm); line-height: 1.5; font-weight: 650; }
@media (min-width: 50rem) { .visual-outlook { grid-template-columns: 1fr 1fr; gap: 32px; } }
@media (prefers-reduced-motion: reduce) { .repayment-track > span, .time-progress, .plan-marker { transition: none; } }
.horizon-note { color: var(--text-muted); font-size: var(--font-sm); margin: var(--space-3) 0 0; }
@media (max-width: 35rem) { .journey-visual { padding: var(--space-4); } }
</style>
