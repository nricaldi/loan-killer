<script setup lang="ts">
import { computed } from 'vue'
import { vZeroOnFocus } from '../directives/zeroOnFocus'
import { parseMoney } from '../domain/loanForm'
import { addMonths } from '../domain/dates'
import { formatDate, money } from '../format'

const props = defineProps<{
  cards: { id: number; kind: 'monthly' | 'one-time'; amount: string }[]
  disabled: boolean
  balanceCents: number
  minimumCents: number
  goalMonth: string
  goalAnchor: string
  goalMaxMonths: number
  goalBusy: boolean
  goalStatus: string
  goalDisabled: boolean
  errors: { amount?: string; monthly?: string; general?: string }
  hasChanges: boolean
}>()
const emit = defineEmits<{
  amount: [id: number, value: string]
  goal: [month: string]
  submit: []
}>()
const parseAmount = (value: string) => value.trim() === '' ? 0 : parseMoney(value)
const inputId = (kind: 'monthly' | 'one-time') => kind === 'monthly' ? 'extra-monthly-amount' : 'extra-payment-amount'
function rangeMax(card: typeof props.cards[number]) {
  const suggested = card.kind === 'one-time' ? Math.min(5000, Math.ceil(props.balanceCents / 10000) * 100)
    : Math.max(500, Math.ceil(Math.max(props.minimumCents * 2, props.balanceCents / 24) / 5000) * 50)
  return Math.min(10_000_000, Math.max(100, suggested, Math.ceil((parseAmount(card.amount) ?? 0) / 100)))
}
const goalValue = computed(() => {
  if (!props.goalMonth) return Math.min(120, props.goalMaxMonths)
  const [year, month] = props.goalMonth.split('-').map(Number)
  const [startYear, startMonth] = props.goalAnchor.split('-').map(Number)
  return Math.max(0, Math.min(props.goalMaxMonths, (year! - startYear!) * 12 + month! - startMonth!))
})
function changeGoal(event: Event) {
  emit('goal', addMonths(props.goalAnchor, Number((event.target as HTMLInputElement).value)).slice(0, 7))
}
</script>

<template>
  <section id="extra-payment" class="simulator" aria-labelledby="extra-payment-heading">
    <div class="explore-heading"><h2 id="extra-payment-heading">Explore payments</h2></div>
    <form class="scenario-form" novalidate @submit.prevent="emit('submit')">
      <div class="exploration-options">
        <section v-for="card in cards" :key="card.id" class="saving-card" :class="{ active: (parseAmount(card.amount) ?? 0) > 0 }">
          <div class="card-heading"><label :for="inputId(card.kind)">{{ card.kind === 'monthly' ? 'Extra each month' : 'Pay once' }}</label></div>
          <div class="amount-input"><span aria-hidden="true">$</span><input :id="inputId(card.kind)" v-zero-on-focus :value="card.amount" :disabled="disabled" type="text" inputmode="decimal" :aria-invalid="parseAmount(card.amount) === null" :aria-describedby="parseAmount(card.amount) === null ? `card-error-${card.id}` : undefined" @input="emit('amount', card.id, ($event.target as HTMLInputElement).value)" @blur="card.amount.trim() === '' && emit('amount', card.id, '0')" /></div>
          <input class="money-slider" type="range" min="0" :max="rangeMax(card)" step="1" :value="Math.min(rangeMax(card), (parseAmount(card.amount) ?? 0) / 100)" :disabled="disabled" :aria-label="card.kind === 'monthly' ? 'Extra monthly payment slider' : 'One-time payment slider'" :aria-valuetext="money(parseAmount(card.amount) ?? 0)" @input="emit('amount', card.id, String(($event.target as HTMLInputElement).value))" />
          <div class="range-ends" aria-hidden="true"><span>$0</span><span>{{ `$${rangeMax(card).toLocaleString('en-US')}` }}</span></div>
          <p v-if="parseAmount(card.amount) === null" :id="`card-error-${card.id}`" class="field-error">Enter a valid amount with up to two decimal places.</p>
        </section>
      </div>
      <section class="goal-control" :aria-busy="goalBusy">
        <div class="goal-heading"><div class="goal-label"><label for="payoff-goal-month">Debt-free by</label><div class="goal-feedback-slot"><span v-if="goalBusy" class="goal-spinner" aria-hidden="true" /><details v-else-if="goalStatus" :key="goalStatus" class="goal-feedback" @keydown.esc="($event.currentTarget as HTMLDetailsElement).open = false"><summary aria-label="Goal calculation details" :title="goalStatus">!</summary><p>{{ goalStatus }}</p></details></div></div><input id="payoff-goal-month" type="month" :value="goalMonth" :min="goalAnchor.slice(0, 7)" :max="addMonths(goalAnchor, goalMaxMonths).slice(0, 7)" :disabled="goalDisabled" @input="emit('goal', ($event.target as HTMLInputElement).value)" /></div>
        <input class="goal-slider" type="range" min="0" :max="goalMaxMonths" step="1" :value="goalValue" :disabled="goalDisabled" aria-label="Debt-free date slider" :aria-valuetext="goalMonth ? formatDate(`${goalMonth}-01`, true) : 'Choose a payoff goal'" aria-describedby="goal-help goal-status" @input="changeGoal" />

        <p id="goal-help" class="sr-only">Move the date to calculate the monthly extra needed. Your one-time payment stays fixed.</p>
        <p id="goal-status" class="sr-only" role="status">{{ goalBusy ? 'Calculating monthly extra…' : goalStatus }}</p>
      </section>
      <p v-if="Object.keys(errors).length" class="field-error" role="alert" tabindex="-1">{{ errors.general ?? 'Check the highlighted fields.' }}</p>
      <p v-if="hasChanges" class="date-warning" role="status">Invalid inputs aren’t applied; the chart and results still show your last valid comparison.</p>
    </form>
  </section>
</template>

<style scoped>
.simulator { margin: 12px 0; min-width: 0; }
.explore-heading, .goal-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
h2 { font-size: 16px; margin: 0; }
.exploration-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 8px 0 12px; }
.saving-card { min-width: 0; padding: 10px; border-radius: var(--radius-sm); background: var(--blue-primary); transition: background 160ms ease, box-shadow 160ms ease; }
.saving-card.active { background: var(--blue-border); }
.saving-card:focus-within { box-shadow: inset 0 0 0 2px var(--chart-line); }
.card-heading { margin-bottom: 6px; min-height: 20px; display: flex; align-items: center; }
label { font-size: 12px; font-weight: 650; }
.amount-input { position: relative; }
.amount-input > span { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); }
.amount-input input { width: 100%; min-width: 0; min-height: 44px; padding: 8px 8px 8px 26px; background: var(--surface); color: var(--text); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); font: inherit; font-size: 18px; font-weight: 650; }
input[aria-invalid='true'] { border-color: var(--danger); }
input[type='range'] { display: block; width: 100%; height: 44px; margin: 0; padding: 0; accent-color: var(--chart-line); cursor: pointer; }
.range-ends { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--text-secondary); }
.goal-control { min-width: 0; padding: 10px; background: var(--blue-primary); border-radius: var(--radius-sm); }
.goal-heading input { width: 10rem; max-width: 62%; min-width: 0; min-height: 44px; padding: 6px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-link); font: inherit; font-size: 14px; }
.date-warning { font-size: 12px; line-height: 1.5; color: var(--text-secondary); margin: 8px 0 0; }
.goal-label { display: flex; align-items: center; gap: 4px; min-width: 0; }
.goal-feedback-slot { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex: 0 0 32px; }
.goal-feedback { position: relative; }
.goal-feedback summary { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: var(--surface); color: var(--danger); font-weight: 700; cursor: pointer; list-style: none; }
.goal-feedback summary::-webkit-details-marker { display: none; }
.goal-feedback p { position: absolute; z-index: 5; top: 100%; left: -6rem; width: min(18rem, calc(100vw - 4rem)); margin: 6px 0 0; padding: 12px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-secondary); box-shadow: var(--shadow-modal); font-size: 12px; line-height: 1.5; }
.goal-spinner { width: 14px; height: 14px; border: 2px solid var(--blue-border); border-top-color: var(--chart-line); border-radius: 50%; animation: goal-spin 800ms linear infinite; }
@keyframes goal-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .goal-spinner { animation: none; } }
.field-error { margin: 8px 0 0; color: var(--danger); font-size: 12px; }
@media (min-width: 64rem) {
  .scenario-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .exploration-options { display: contents; }
  .scenario-form > .field-error, .scenario-form > .date-warning { grid-column: 1 / -1; }
}
@media (prefers-reduced-motion: reduce) { .saving-card { transition: none; } }
</style>
