<script setup lang="ts">
import { useId } from 'vue'
import type { RepaymentStrategy } from '../domain/recurringPayments'

defineProps<{ modelValue: RepaymentStrategy }>()
const emit = defineEmits<{ 'update:modelValue': [strategy: RepaymentStrategy] }>()
const id = useId()
const options: { value: RepaymentStrategy; title: string; description: string }[] = [
  { value: 'highest-rate', title: 'Highest rate first', description: 'Avalanche · Target higher-interest loans to reduce interest costs.' },
  { value: 'smallest-balance', title: 'Smallest balance first', description: 'Snowball · Target smaller balances for earlier individual payoffs.' },
]
</script>

<template>
  <fieldset class="strategy-picker" aria-describedby="strategy-help">
    <legend>Monthly payoff strategy</legend>
    <div class="strategy-options">
      <label v-for="option in options" :key="option.value" class="strategy-card" :class="{ selected: modelValue === option.value }">
        <input type="radio" :name="`${id}-strategy`" :value="option.value" :checked="modelValue === option.value" :aria-labelledby="`${id}-${option.value}-title`" :aria-describedby="`${id}-${option.value}-description`" @change="emit('update:modelValue', option.value)" />
        <span>
          <strong :id="`${id}-${option.value}-title`">{{ option.title }}</strong>
          <span :id="`${id}-${option.value}-description`" class="strategy-description">{{ option.description }}</span>
        </span>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.strategy-picker { min-width: 0; padding: 0; margin: 0; border: 0; }
legend { padding: 0; margin-bottom: var(--space-2); font-size: var(--font-xs); font-weight: 600; }
.strategy-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-2); }
.strategy-card { display: flex; align-items: start; gap: var(--space-3); padding: var(--space-3); background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius-md); cursor: pointer; }
.strategy-card:hover { border-color: var(--chart-line); }
.strategy-card.selected { border-color: var(--chart-line); background: var(--blue-primary); }
.strategy-card:focus-within { outline: 3px solid var(--focus); outline-offset: 3px; }
input { flex: 0 0 auto; width: 1rem; height: 1rem; margin: 0.1rem 0 0; accent-color: var(--chart-line); }
input:focus-visible { outline: none; }
strong { display: block; color: var(--text); font-size: var(--font-sm); font-weight: 650; }
.strategy-description { display: block; margin-top: var(--space-1); color: var(--text-secondary); font-size: var(--font-xs); line-height: 1.6; }
@media (max-width: 35rem) { .strategy-options { grid-template-columns: 1fr; } }
</style>
