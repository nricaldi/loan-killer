<script setup lang="ts">
import { computed, useId } from 'vue'
import type { Projection } from '../domain/loan'
import { daysBetween } from '../domain/dates'
import { chartMoney, dateDistance, formatDate, money } from '../format'

const props = defineProps<{
  balanceDate: string
  initialBalanceCents: number
  projection: Projection
  endPoint?: { date: string; balanceCents: number }
  payoffDate?: string
  baselinePayoffDate?: string
  label?: string
  comparison?: { projection: Projection; label: string; endPoint?: { date: string; balanceCents: number } }
}>()
const id = useId()
const gradientId = `${id}-balance-fill`
const titleId = `${id}-chart-title`
const descriptionId = `${id}-chart-description`
const width = 720
const height = 220
function chartPoints(projection: Projection, endPoint?: { date: string; balanceCents: number }) {
  const data = [
    { date: props.balanceDate, balanceCents: props.initialBalanceCents },
    ...projection.schedule.flatMap((payment) => payment.kind === 'scheduled' ? [payment] : [
      { date: payment.date, balanceCents: payment.balanceCents + payment.paymentCents },
      payment,
    ]),
  ]
  if (endPoint && endPoint.date > (data.at(-1)?.date ?? props.balanceDate)) data.push(endPoint)
  return data
}

const points = computed(() => chartPoints(props.projection, props.endPoint))
const comparisonPoints = computed(() => props.comparison ? chartPoints(props.comparison.projection, props.comparison.endPoint) : [])
const maxBalance = computed(() => [...points.value, ...comparisonPoints.value].reduce((maximum, point) => Math.max(maximum, point.balanceCents), 1))
const endDate = computed(() => [points.value.at(-1)?.date, comparisonPoints.value.at(-1)?.date]
  .filter((date): date is string => !!date).sort().at(-1) ?? props.balanceDate)
const totalDays = computed(() => Math.max(daysBetween(props.balanceDate, endDate.value), 1))

function coordinatesFor(data: { date: string; balanceCents: number }[]) {
  return data.map((point) => ({
    x: daysBetween(props.balanceDate, point.date) / totalDays.value * width,
    y: (1 - point.balanceCents / maxBalance.value) * height,
  }))
}

function pathFor(data: { x: number; y: number }[]): string {
  return data.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
}

const coordinates = computed(() => coordinatesFor(points.value))
const comparisonCoordinates = computed(() => coordinatesFor(comparisonPoints.value))
const line = computed(() => pathFor(coordinates.value))
const comparisonLine = computed(() => `${pathFor(comparisonCoordinates.value)}${props.comparison?.projection.status === 'paid-off' ? ` L${width},${height}` : ''}`)
const area = computed(() => {
  const data = props.comparison ? comparisonCoordinates.value : coordinates.value
  return `${pathFor(data)} L${data.at(-1)?.x ?? 0},${height} L0,${height} Z`
})
const ticks = computed(() => [1, 0.75, 0.5, 0.25, 0].map((fraction) => ({
  fraction,
  label: chartMoney(maxBalance.value * fraction),
})))
const midpoint = computed(() => points.value[Math.floor((points.value.length - 1) / 2)])
const effective = computed(() => props.comparison?.projection ?? props.projection)
const payoff = computed(() => props.payoffDate ?? (effective.value.status === 'paid-off' ? effective.value.payoffDate : undefined))
const baselinePayoff = computed(() => props.baselinePayoffDate ?? (props.projection.status === 'paid-off' ? props.projection.payoffDate : undefined))
const payoffPercent = computed(() => payoff.value ? Math.max(0, Math.min(100, daysBetween(props.balanceDate, payoff.value) / totalDays.value * 100)) : 0)
const payoffInView = computed(() => payoff.value && payoff.value <= endDate.value)
const timeBenefit = computed(() => {
  if (!props.comparison || !payoff.value || !baselinePayoff.value) return ''
  if (payoff.value === baselinePayoff.value) return 'Same payoff date'
  return `${dateDistance(payoff.value, baselinePayoff.value)} ${payoff.value < baselinePayoff.value ? 'sooner' : 'later'}`
})
const savedInterval = computed(() => props.comparison && payoffInView.value && baselinePayoff.value && payoff.value! < baselinePayoff.value
  ? { left: payoffPercent.value, width: Math.max(0, Math.min(100, daysBetween(props.balanceDate, baselinePayoff.value) / totalDays.value * 100) - payoffPercent.value) } : null)
function describe(projection: Projection, label: string, data: { date: string; balanceCents: number }[]) {
  if (projection.status === 'paid-off') return `${label} reaches zero on ${formatDate(projection.payoffDate)}.`
  const last = data.at(-1)
  return `${label}: projected balance ${money(last?.balanceCents ?? props.initialBalanceCents)} on ${formatDate(last?.date ?? props.balanceDate)}. No payoff date is estimated in this view.`
}
</script>

<template>
  <figure class="balance-chart" :class="{ unpaid: projection.status !== 'paid-off' }">
    <div class="chart-body">
      <div class="y-labels" aria-hidden="true">
        <span v-for="tick in ticks" :key="tick.fraction">{{ tick.label }}</span>
      </div>
      <div class="plot">
        <div v-if="savedInterval" class="time-saved-range" aria-hidden="true" :style="{ left: `${savedInterval.left}%`, width: `${savedInterval.width}%` }" />
        <div class="grid-lines" aria-hidden="true"><span v-for="tick in ticks" :key="tick.fraction" /></div>
        <svg
          :viewBox="`0 0 ${width} ${height}`"
          preserveAspectRatio="none"
          role="img"
          :aria-labelledby="`${titleId} ${descriptionId}`"
        >
          <title :id="titleId">{{ comparison ? `Projected balances: ${label ?? 'Minimum payments only'} versus ${comparison.label}` : label ?? 'Projected loan balance with minimum payments' }}</title>
          <desc :id="descriptionId">{{ money(initialBalanceCents) }} on {{ formatDate(balanceDate) }}. {{ describe(projection, label ?? 'Minimum payments only', points) }} {{ comparison ? describe(comparison.projection, comparison.label, comparisonPoints) : '' }} This is a projection, not actual payment history.</desc>
          <defs>
            <linearGradient :id="gradientId" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" :stop-color="comparison ? '#a8d6f5' : '#c9d3db'" stop-opacity="0.55" />
              <stop offset="100%" :stop-color="comparison ? '#a8d6f5' : '#c9d3db'" stop-opacity="0.05" />
            </linearGradient>
          </defs>
          <path :d="area" :fill="`url(#${gradientId})`" />
          <path :d="line" fill="none" class="projection-line" vector-effect="non-scaling-stroke" />
          <path v-if="comparison" :d="comparisonLine" fill="none" class="comparison-line" vector-effect="non-scaling-stroke" />
        </svg>
        <span v-if="coordinates[0]" class="endpoint" aria-hidden="true" :style="{ left: '0%', top: `${coordinates[0].y / height * 100}%` }" />
        <span v-if="coordinates.at(-1)" class="endpoint" aria-hidden="true" :style="{ left: `${(coordinates.at(-1)?.x ?? 0) / width * 100}%`, top: `${(coordinates.at(-1)?.y ?? 0) / height * 100}%` }" />
        <span v-if="comparisonCoordinates.at(-1)" class="endpoint comparison-endpoint" aria-hidden="true" :style="{ left: `${(comparisonCoordinates.at(-1)?.x ?? 0) / width * 100}%`, top: `${(comparisonCoordinates.at(-1)?.y ?? 0) / height * 100}%` }" />
        <div v-if="payoffInView" class="payoff-label" :style="{ '--payoff-position': `${payoffPercent}%` }"><span class="sr-only">Debt-free date: </span><strong data-testid="payoff-date">{{ formatDate(payoff!) }}</strong></div>
      </div>
    </div>
    <div class="date-labels" aria-hidden="true">
      <span>{{ formatDate(balanceDate, true) }}</span>
      <span v-if="midpoint && projection.schedule.length > 3" class="midpoint-label">{{ formatDate(midpoint.date, true) }}</span>
      <span v-if="endDate !== balanceDate">{{ formatDate(endDate, true) }}</span>
    </div>
    <figcaption>
      <span><i class="legend-line" aria-hidden="true" />{{ label ?? 'Estimated balance · minimum payments only' }}<template v-if="comparison"> · <span data-testid="baseline-date">{{ baselinePayoff ? formatDate(baselinePayoff) : 'No payoff date' }}</span></template></span>
      <span :class="{ 'legend-placeholder': !comparison }" :aria-hidden="!comparison"><i class="legend-line comparison-legend" aria-hidden="true" />{{ comparison?.label ?? 'With extra payments' }}</span>
    </figcaption>
    <div class="payoff-result" aria-live="polite">
      <p v-if="payoff && !payoffInView">Debt-free <strong data-testid="payoff-date">{{ formatDate(payoff) }}</strong> · beyond this chart</p>
      <p v-if="timeBenefit" data-testid="plan-time-saved">{{ timeBenefit }}</p>
      <p v-else-if="!payoff">No payoff date yet</p>
    </div>
  </figure>
</template>

<style scoped>
.balance-chart { margin: var(--space-7) 0 0; }
.chart-body { display: grid; grid-template-columns: 3.25rem minmax(0, 1fr); gap: var(--space-3); height: 14rem; padding-right: var(--space-2); }
.y-labels { display: flex; flex-direction: column; justify-content: space-between; text-align: right; color: var(--text-muted); font-size: var(--font-xs); line-height: 1; margin-block: -0.375rem; }
.plot { position: relative; min-width: 0; min-height: 0; }
.time-saved-range { position: absolute; bottom: 6px; height: 8px; border-inline: 1px solid var(--savings); border-bottom: 2px solid var(--savings); }
.payoff-label { left: clamp(0px, calc(var(--payoff-position) - 3.5rem), calc(100% - 7rem)); position: absolute; bottom: 18px; width: 7rem; padding: 5px 4px; border-radius: 4px; text-align: center; background: var(--surface); color: var(--text-link); font-size: 12px; white-space: nowrap; box-shadow: var(--shadow-sm); }
.payoff-label strong { font-weight: 650; }
.payoff-result { display: flow-root; min-height: 3rem; font-size: var(--font-sm); line-height: 1.5; color: var(--savings-text); font-weight: 650; text-align: center; }
.payoff-result p { margin: 6px 0 0; }
.grid-lines { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; }
.grid-lines span { border-top: 1px dashed var(--border); }
svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; overflow: visible; }
.projection-line { stroke: var(--text-placeholder); stroke-width: 2.5; stroke-dasharray: 3 5; stroke-linejoin: round; stroke-linecap: round; }
.comparison-line { stroke: var(--chart-line); stroke-width: 3; stroke-linejoin: round; stroke-linecap: round; }
.inspection-line { stroke: var(--text-secondary); stroke-width: 1; stroke-dasharray: 3 3; pointer-events: none; }
.endpoint { position: absolute; width: 0.6rem; height: 0.6rem; border-radius: 50%; border: 2px solid var(--text-placeholder); background: var(--surface); transform: translate(-50%, -50%); }
.comparison-endpoint { border-color: var(--chart-line); background: var(--chart-line); }
.date-labels { display: flex; justify-content: space-between; gap: var(--space-2); margin: var(--space-4) var(--space-2) 0 4rem; font-size: var(--font-xs); color: var(--text-muted); }
figcaption { display: flex; flex-direction: column; flex-wrap: wrap; min-height: 3rem; align-items: center; justify-content: center; gap: var(--space-3); margin-top: var(--space-3); color: var(--text-muted); font-size: var(--font-xs); }
.legend-placeholder { visibility: hidden; }
figcaption > span { display: flex; align-items: center; gap: var(--space-2); }
.legend-line { display: inline-block; width: 1.5rem; border-top: 2px dotted var(--text-placeholder); }
.comparison-legend { border-top: 3px solid var(--chart-line); }
@media (max-width: 35rem) { .chart-body { height: 12rem; } .midpoint-label { display: none; } figcaption { font-size: 0.65rem; } }
</style>
