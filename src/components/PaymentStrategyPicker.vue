<script setup lang="ts">
import { useId } from 'vue'
import type { RepaymentStrategy } from '../domain/recurringPayments'

defineProps<{ modelValue: RepaymentStrategy }>()
const emit = defineEmits<{ 'update:modelValue': [strategy: RepaymentStrategy] }>()
const id = useId()
function update(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'highest-rate' || value === 'smallest-balance') emit('update:modelValue', value)
}
</script>

<template>
  <div class="strategy-picker">
    <label :for="`${id}-strategy`">Apply monthly extra to</label>
    <select :id="`${id}-strategy`" :value="modelValue" aria-describedby="strategy-help" @change="update">
      <option value="highest-rate">Highest rate first</option>
      <option value="smallest-balance">Smallest balance first</option>
    </select>
  </div>
</template>

<style scoped>
.strategy-picker { min-width: 0; }
label { display: block; margin-bottom: var(--space-2); font-size: var(--font-sm); font-weight: 600; }
select { width: 100%; min-width: 0; min-height: var(--size-touch-target); padding: var(--space-3); background: var(--surface); color: var(--text); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); font: inherit; }
</style>
