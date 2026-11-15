<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import MoneyRuler from './MoneyRuler.vue'
import { parseMoney } from '../domain/loanForm'
import { addMonths } from '../domain/dates'

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
const monthInput = ref<HTMLInputElement | null>(null)
const rulers = ref<InstanceType<typeof MoneyRuler>[]>([])
async function chooseGoal(month: string) {
  rulers.value.forEach(ruler => ruler.stop())
  // Flush the final coast amounts before starting a goal search, or they would cancel it.
  await nextTick()
  emit('goal', month)
}
const earliestMonth = computed(() => props.goalAnchor.slice(0, 7))
const latestMonth = computed(() => addMonths(props.goalAnchor, props.goalMaxMonths).slice(0, 7))
async function stepGoal(direction: number) {
  if (props.goalDisabled || props.goalBusy || !props.goalMonth) return
  rulers.value.forEach(ruler => ruler.stop())
  await nextTick()
  if (!props.goalMonth) return
  const next = addMonths(`${props.goalMonth}-01`, direction).slice(0, 7)
  if (next >= earliestMonth.value && next <= latestMonth.value) emit('goal', next)
}
watch([() => props.goalBusy, () => props.goalStatus, () => props.goalMonth], async () => {
  if (props.goalBusy) return
  await nextTick()
  if (monthInput.value) monthInput.value.value = props.goalMonth
})
</script>

<template>
  <section id="extra-payment" class="simulator" aria-labelledby="extra-payment-heading">
    <div class="explore-heading"><h2 id="extra-payment-heading">Explore payments</h2></div>
    <form class="scenario-form" novalidate @submit.prevent="emit('submit')">
      <div class="exploration-options">
        <section v-for="card in cards" :key="card.id" class="saving-card" :class="{ active: (parseAmount(card.amount) ?? 0) > 0 }">
          <MoneyRuler :id="inputId(card.kind)" ref="rulers" :label="card.kind === 'monthly' ? 'Extra each month' : 'Pay once'" :value="card.amount" :disabled="disabled" @change="emit('amount', card.id, $event)" />
        </section>
      </div>
      <section class="goal-control" :aria-busy="goalBusy">
        <div class="goal-heading"><div class="goal-label"><label for="payoff-goal-month">Debt-free by</label><div class="goal-feedback-slot"><span v-if="goalBusy" class="goal-spinner" aria-hidden="true" /><details v-else-if="goalStatus" :key="goalStatus" class="goal-feedback" @keydown.esc="($event.currentTarget as HTMLDetailsElement).open = false"><summary aria-label="Goal calculation details" :title="goalStatus">!</summary><p>{{ goalStatus }}</p></details></div></div><div class="month-navigation"><button type="button" aria-label="Pay off one month earlier" :disabled="goalDisabled || goalBusy || !goalMonth || goalMonth <= earliestMonth" @click="stepGoal(-1)">‹</button><input id="payoff-goal-month" ref="monthInput" type="month" :value="goalMonth" :min="earliestMonth" :max="latestMonth" :disabled="goalDisabled" aria-describedby="goal-help goal-status" @change="chooseGoal(($event.target as HTMLInputElement).value)" /><button type="button" aria-label="Pay off one month later" :disabled="goalDisabled || goalBusy || !goalMonth || goalMonth >= latestMonth" @click="stepGoal(1)">›</button></div></div>

        <p id="goal-help" class="sr-only">Change the date to calculate the monthly extra needed. This month uses a full one-time payoff and no monthly extra; other goals keep your one-time payment fixed.</p>
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
.scenario-form { padding: 12px; margin-top: 8px; border-radius: var(--radius-md); background: var(--surface); }
.exploration-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0; }
.saving-card { min-width: 0; }
.saving-card:first-child { padding-right: 12px; border-right: 1px solid var(--border); }
.goal-control { min-width: 0; margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border); }
.goal-heading { flex-wrap: wrap; gap: 4px; }
.goal-label label { font-size: 12px; font-weight: 650; }
.month-navigation { display: flex; align-items: center; min-width: 0; }
.month-navigation button { width: 32px; min-height: 44px; padding: 0; border: 0; border-radius: 4px; background: transparent; color: var(--text-secondary); font-size: 22px; }
.month-navigation button:disabled { opacity: .3; cursor: default; }
.month-navigation input { width: 10rem; min-width: 0; min-height: 44px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--text); font: inherit; font-size: 14px; font-weight: 650; }
.date-warning { font-size: 12px; line-height: 1.5; color: var(--text-secondary); margin: 8px 0 0; }
.goal-label { display: flex; align-items: center; gap: 4px; min-width: 0; }
.goal-feedback-slot { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex: 0 0 32px; }
.goal-feedback { position: relative; }
.goal-feedback summary { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: var(--surface); color: var(--danger); font-weight: 700; cursor: pointer; list-style: none; }
.goal-feedback summary::-webkit-details-marker { display: none; }
.goal-feedback p { position: absolute; z-index: 5; top: 100%; left: -6rem; width: min(18rem, calc(100vw - 4rem)); margin: 6px 0 0; padding: 12px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-secondary); box-shadow: var(--shadow-modal); font-size: 12px; line-height: 1.5; }
.goal-spinner { width: 14px; height: 14px; border: 2px solid var(--border-strong); border-top-color: var(--chart-line); border-radius: 50%; animation: goal-spin 800ms linear infinite; }
@keyframes goal-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .goal-spinner { animation: none; } }
.field-error { margin: 8px 0 0; color: var(--danger); font-size: 12px; }
@media (max-width: 39.99rem) {
  .exploration-options { grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .saving-card:first-child { padding-right: 0; border-right: 0; }
  .saving-card + .saving-card { border-top: 1px solid var(--border); padding-top: 10px; }
}
@media (min-width: 64rem) {
  .scenario-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .exploration-options { display: contents; }
  .goal-control { display: flex; flex-direction: column; justify-content: center; margin-top: 0; padding: 0 0 0 12px; border-top: 0; border-left: 1px solid var(--border); }
  .scenario-form > .field-error, .scenario-form > .date-warning { grid-column: 1 / -1; }
}
</style>
