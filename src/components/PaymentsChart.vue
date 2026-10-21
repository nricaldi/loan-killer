<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { daysBetween } from '../domain/dates'
import type { PaidOffProjection } from '../domain/loan'
import { chartMoney, formatDate, money } from '../format'
import PaymentInspector from './PaymentInspector.vue'

const props = defineProps<{ balanceDate: string; projection: PaidOffProjection; initialBalanceCents?: number; label?: string; comparison?: { projection: PaidOffProjection; label: string }; interactive?: boolean; compact?: boolean }>()
const id = useId()
const width = 720
const height = 220
const inspector = ref<InstanceType<typeof PaymentInspector> | null>(null)
const inspectedDate = ref<string | null>(null)
const endDate = computed(() => props.comparison && props.comparison.projection.payoffDate > props.projection.payoffDate ? props.comparison.projection.payoffDate : props.projection.payoffDate)
const totalDays = computed(() => Math.max(daysBetween(props.balanceDate, endDate.value), 1))
const maximum = computed(() => Math.max(props.projection.totalPaymentsCents, props.comparison?.projection.totalPaymentsCents ?? 0, 1))
function chartPoints(projection: PaidOffProjection) {
  let principal = 0
  let interest = 0
  const result = [{ x: 0, principal, total: 0 }]
  for (const payment of projection.schedule) {
    const x = daysBetween(props.balanceDate, payment.date) / totalDays.value * width
    // Payments happen on their due dates, not gradually between dates.
    result.push({ x, principal, total: principal + interest })
    principal += payment.principalPaidCents
    interest += payment.interestPaidCents
    result.push({ x, principal, total: principal + interest })
  }
  if (result.at(-1)?.x !== width) result.push({ x: width, principal, total: principal + interest })
  return result
}
const points = computed(() => chartPoints(props.projection))
const comparisonPoints = computed(() => props.comparison ? chartPoints(props.comparison.projection) : [])
function coordinates(value: number) {
  return ((1 - value / maximum.value) * height).toFixed(2)
}
function line(key: 'principal' | 'total') {
  return points.value.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${coordinates(point[key])}`).join(' ')
}
const principalArea = computed(() => `${line('principal')} L${points.value.at(-1)?.x ?? 0},${height} L0,${height} Z`)
const interestArea = computed(() => `${line('total')} ${[...points.value].reverse().map((point) => `L${point.x.toFixed(2)},${coordinates(point.principal)}`).join(' ')} Z`)
const principalTotal = computed(() => props.projection.schedule.reduce((sum, payment) => sum + payment.principalPaidCents, 0))
const ticks = computed(() => [1, 0.75, 0.5, 0.25, 0].map((fraction) => chartMoney(maximum.value * fraction)))
const comparisonLine = computed(() => comparisonPoints.value.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${coordinates(point.total)}`).join(' '))
const inspectionX = computed(() => inspectedDate.value ? daysBetween(props.balanceDate, inspectedDate.value) / totalDays.value * width : null)
function inspectPointer(event: PointerEvent) {
  if (!(event.currentTarget instanceof HTMLElement)) return
  const bounds = event.currentTarget.getBoundingClientRect()
  if (bounds.width > 0) inspector.value?.inspectRatio((event.clientX - bounds.left) / bounds.width)
}
</script>

<template>
  <figure class="payments-chart" :class="{ compact }">
    <div class="chart-body">
      <div class="y-labels" aria-hidden="true"><span v-for="(tick, index) in ticks" :key="index">{{ tick }}</span></div>
      <div class="plot" @pointermove="inspectPointer" @pointerdown="inspectPointer">
        <div class="grid-lines" aria-hidden="true"><span v-for="index in 5" :key="index" /></div>
        <svg :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none" role="img" :aria-labelledby="`${id}-title ${id}-description`">
          <title :id="`${id}-title`">Projected payments over time</title>
          <desc :id="`${id}-description`">Starting at $0 paid from {{ formatDate(balanceDate) }}, your cumulative payments reach {{ money(projection.totalPaymentsCents) }} on {{ formatDate(projection.payoffDate) }}: {{ money(principalTotal) }} toward principal and {{ money(projection.remainingInterestCents) }} toward interest. {{ comparison ? `${comparison.label}: ${money(comparison.projection.totalPaymentsCents)} by ${formatDate(comparison.projection.payoffDate)}.` : '' }} This is a projection, not actual payment history. A payment-by-payment table follows.</desc>
          <path class="principal-area" :d="principalArea" />
          <path class="interest-area" :d="interestArea" />
          <path class="total-line" :d="line('total')" fill="none" vector-effect="non-scaling-stroke" />
          <path v-if="comparison" class="comparison-line" :d="comparisonLine" fill="none" vector-effect="non-scaling-stroke" />
          <line v-if="interactive && inspectionX !== null" class="inspection-line" :x1="inspectionX" :x2="inspectionX" y1="0" :y2="height" vector-effect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
    <div class="date-labels" aria-hidden="true"><span>{{ formatDate(balanceDate, true) }}</span><span v-if="endDate !== balanceDate">{{ formatDate(endDate, true) }}</span></div>
    <figcaption><span><i class="principal-dot" aria-hidden="true" />Principal paid</span><span><i class="interest-dot" aria-hidden="true" />Interest paid</span><span>{{ label ?? 'Minimum payments' }}</span><span v-if="comparison"><i class="comparison-legend" aria-hidden="true" />{{ comparison.label }}</span></figcaption>
    <component :is="compact ? 'details' : 'div'" v-if="interactive" class="inspection-details">
      <summary v-if="compact">Explore payments</summary>
      <PaymentInspector ref="inspector" :payments="(comparison?.projection ?? projection).schedule" :balance-date="balanceDate" :end-date="endDate" :initial-balance-cents="initialBalanceCents ?? 0" :label="comparison?.label ?? label ?? 'Minimum payments'" @inspect="inspectedDate = $event" />
    </component>
  </figure>
</template>

<style scoped>
.payments-chart { margin: var(--space-5) 0 0; }
.chart-body { display: grid; grid-template-columns: 4rem minmax(0, 1fr); gap: var(--space-3); height: 13rem; padding-right: var(--space-2); }
.y-labels { display: flex; flex-direction: column; justify-content: space-between; text-align: right; color: var(--text-muted); font-size: var(--font-xs); line-height: 1; margin-block: -0.375rem; }
.plot { position: relative; min-width: 0; min-height: 0; }
.grid-lines { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; }
.grid-lines span { border-top: 1px dashed var(--border); }
svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; overflow: visible; }
.principal-area, .principal-dot { fill: var(--chart-line); background: var(--chart-line); }
.interest-area, .interest-dot { fill: var(--chart-interest); background: var(--chart-interest); }
.total-line { stroke: var(--chart-extra); stroke-width: 2; stroke-linejoin: round; }
.comparison-line { stroke: var(--chart-extra); stroke-width: 3; stroke-dasharray: 7 4; stroke-linejoin: round; }
.inspection-line { stroke: var(--text-secondary); stroke-width: 1; stroke-dasharray: 3 3; pointer-events: none; }
.comparison-legend { border-top: 2px dashed var(--chart-extra); width: 1rem; height: 0; }
.date-labels { display: flex; justify-content: space-between; gap: var(--space-2); margin: var(--space-3) var(--space-2) 0 4.75rem; font-size: var(--font-xs); color: var(--text-muted); }
figcaption { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-3); margin-top: var(--space-3); font-size: var(--font-xs); color: var(--text-muted); }
figcaption span { display: flex; align-items: center; gap: var(--space-2); }
figcaption i { width: 0.65rem; height: 0.65rem; border-radius: var(--radius-sm); }
.compact { margin-top: var(--space-4); }
.compact .chart-body { height: 10.5rem; }
.compact figcaption { min-block-size: 1rem; align-content: start; justify-content: start; }
.inspection-details summary { cursor: pointer; color: var(--text-link); font-size: var(--font-xs); line-height: 1.7; }
@media (max-width: 35rem) { .chart-body { grid-template-columns: 3.25rem minmax(0, 1fr); height: 11rem; } .date-labels { margin-left: 4rem; } }
</style>
