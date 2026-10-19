<script setup lang="ts">
import { computed, useId } from 'vue'
import type { PaidOffProjection } from '../domain/loan'
import { daysBetween } from '../domain/dates'
import { chartMoney, formatDate, money } from '../format'

const props = defineProps<{
  balanceDate: string
  initialBalanceCents: number
  projection: PaidOffProjection
  label?: string
  comparison?: { projection: PaidOffProjection; label: string }
}>()
const id = useId()
const gradientId = `${id}-balance-fill`
const titleId = `${id}-chart-title`
const descriptionId = `${id}-chart-description`
const width = 720
const height = 220

function chartPoints(projection: PaidOffProjection) {
  return [
    { date: props.balanceDate, balanceCents: props.initialBalanceCents },
    ...projection.schedule.flatMap((payment) => payment.kind === 'scheduled' ? [payment] : [
      { date: payment.date, balanceCents: payment.balanceCents + payment.paymentCents },
      payment,
    ]),
  ]
}

const points = computed(() => chartPoints(props.projection))
const comparisonPoints = computed(() => props.comparison ? chartPoints(props.comparison.projection) : [])
const maxBalance = computed(() => [...points.value, ...comparisonPoints.value].reduce((maximum, point) => Math.max(maximum, point.balanceCents), 1))
const endDate = computed(() => props.comparison && props.comparison.projection.payoffDate > props.projection.payoffDate
  ? props.comparison.projection.payoffDate : props.projection.payoffDate)
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
const comparisonLine = computed(() => `${pathFor(comparisonCoordinates.value)} L${width},${height}`)
const area = computed(() => `${line.value} L${coordinates.value.at(-1)?.x ?? 0},${height} L0,${height} Z`)
const ticks = computed(() => [1, 0.75, 0.5, 0.25, 0].map((fraction) => ({
  fraction,
  label: chartMoney(maxBalance.value * fraction),
})))
const midpoint = computed(() => points.value[Math.floor((points.value.length - 1) / 2)])
</script>

<template>
  <figure class="balance-chart">
    <div class="chart-body">
      <div class="y-labels" aria-hidden="true">
        <span v-for="tick in ticks" :key="tick.fraction">{{ tick.label }}</span>
      </div>
      <div class="plot">
        <div class="grid-lines" aria-hidden="true"><span v-for="tick in ticks" :key="tick.fraction" /></div>
        <svg
          :viewBox="`0 0 ${width} ${height}`"
          preserveAspectRatio="none"
          role="img"
          :aria-labelledby="`${titleId} ${descriptionId}`"
        >
          <title :id="titleId">{{ comparison ? `Projected balances: ${label ?? 'Minimum payments only'} versus ${comparison.label}` : label ?? 'Projected loan balance with minimum payments' }}</title>
          <desc :id="descriptionId">{{ money(initialBalanceCents) }} on {{ formatDate(balanceDate) }}. {{ label ?? 'Minimum payments only' }} reaches zero on {{ formatDate(projection.payoffDate) }}. {{ comparison ? `${comparison.label} reaches zero on ${formatDate(comparison.projection.payoffDate)}.` : '' }} This is a projection, not actual payment history. A payment-by-payment table follows.</desc>
          <defs>
            <linearGradient :id="gradientId" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#a8d6f5" stop-opacity="0.55" />
              <stop offset="100%" stop-color="#a8d6f5" stop-opacity="0.05" />
            </linearGradient>
          </defs>
          <path :d="area" :fill="`url(#${gradientId})`" />
          <path :d="line" fill="none" class="projection-line" vector-effect="non-scaling-stroke" />
          <path v-if="comparison" :d="comparisonLine" fill="none" class="comparison-line" vector-effect="non-scaling-stroke" />
        </svg>
        <span v-if="coordinates[0]" class="endpoint" aria-hidden="true" :style="{ left: '0%', top: `${coordinates[0].y / height * 100}%` }" />
        <span v-if="coordinates.at(-1)" class="endpoint" aria-hidden="true" :style="{ left: `${(coordinates.at(-1)?.x ?? 0) / width * 100}%`, top: '100%' }" />
        <span v-if="comparisonCoordinates.at(-1)" class="endpoint comparison-endpoint" aria-hidden="true" :style="{ left: `${(comparisonCoordinates.at(-1)?.x ?? 0) / width * 100}%`, top: '100%' }" />
      </div>
    </div>
    <div class="date-labels" aria-hidden="true">
      <span>{{ formatDate(balanceDate, true) }}</span>
      <span v-if="midpoint && projection.paymentCount > 3" class="midpoint-label">{{ formatDate(midpoint.date, true) }}</span>
      <span v-if="endDate !== balanceDate">{{ formatDate(endDate, true) }}</span>
    </div>
    <figcaption>
      <span><i class="legend-line" aria-hidden="true" />{{ label ?? 'Estimated balance · minimum payments only' }}</span>
      <span v-if="comparison"><i class="legend-line comparison-legend" aria-hidden="true" />{{ comparison.label }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.balance-chart { margin: var(--space-7) 0 0; }
.chart-body { display: grid; grid-template-columns: 3.25rem minmax(0, 1fr); gap: var(--space-3); height: 14rem; padding-right: var(--space-2); }
.y-labels { display: flex; flex-direction: column; justify-content: space-between; text-align: right; color: var(--text-muted); font-size: var(--font-xs); line-height: 1; margin-block: -0.375rem; }
.plot { position: relative; min-width: 0; min-height: 0; }
.grid-lines { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; }
.grid-lines span { border-top: 1px dashed var(--border); }
svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; overflow: visible; }
.projection-line { stroke: var(--chart-line); stroke-width: 2.5; stroke-dasharray: 6 4; stroke-linejoin: round; stroke-linecap: round; }
.comparison-line { stroke: var(--chart-extra); stroke-width: 3; stroke-linejoin: round; stroke-linecap: round; }
.endpoint { position: absolute; width: 0.6rem; height: 0.6rem; border-radius: 50%; border: 2px solid var(--chart-line); background: var(--surface); transform: translate(-50%, -50%); }
.comparison-endpoint { border-color: var(--chart-extra); background: var(--chart-extra); }
.date-labels { display: flex; justify-content: space-between; gap: var(--space-2); margin: var(--space-4) var(--space-2) 0 4rem; font-size: var(--font-xs); color: var(--text-muted); }
figcaption { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--space-3); margin-top: var(--space-3); color: var(--text-muted); font-size: var(--font-xs); }
figcaption > span { display: flex; align-items: center; gap: var(--space-2); }
.legend-line { display: inline-block; width: 1.5rem; border-top: 2px dashed var(--chart-line); }
.comparison-legend { border-top: 3px solid var(--chart-extra); }
@media (max-width: 35rem) { .chart-body { height: 12rem; } .midpoint-label { display: none; } figcaption { font-size: 0.65rem; } }
</style>
