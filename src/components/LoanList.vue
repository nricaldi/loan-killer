<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { ProjectedLoan } from '../domain/portfolio'
import LoanPaymentChip from './LoanPaymentChip.vue'

defineProps<{ loans: ProjectedLoan[]; editingId: string | null; visibleLoanId: string | null }>()
const emit = defineEmits<{
  add: [event: MouseEvent]
  edit: [id: string, event: MouseEvent]
  view: [id: string]
  remove: [id: string]
  payment: [id: string, cents: number]
}>()
const pendingRemoval = ref<string | null>(null)
const list = ref<HTMLElement | null>(null)

async function requestRemoval(id: string) {
  pendingRemoval.value = id
  await nextTick()
  list.value?.querySelector<HTMLButtonElement>('.remove-confirmation .text-button')?.focus()
}

async function remove(id: string) {
  pendingRemoval.value = null
  emit('remove', id)
  await nextTick()
  list.value?.querySelector<HTMLButtonElement>('.add-button')?.focus()
}

async function cancelRemoval() {
  const id = pendingRemoval.value
  pendingRemoval.value = null
  await nextTick()
  const buttons = list.value?.querySelectorAll<HTMLButtonElement>('[data-remove-id]')
  Array.from(buttons ?? []).find((button) => button.dataset.removeId === id)?.focus()
}
</script>

<template>
  <section ref="list" class="loan-list" aria-labelledby="loans-heading">
    <div class="list-heading">
      <div>
        <h2 id="loans-heading">Your loans <span>{{ loans.length }}</span></h2>
      </div>
      <button class="add-button" type="button" @click="emit('add', $event)">+ Add loan</button>
    </div>

    <ul>
      <li v-for="{ loan, projection } in loans" :key="loan.id" :data-loan-id="loan.id">
        <LoanPaymentChip :loan="loan" :selected="visibleLoanId === null || visibleLoanId === loan.id" @select="emit('view', loan.id)" @payment="emit('payment', loan.id, $event)">
          <p v-if="projection.status !== 'paid-off'" class="loan-warning">{{ projection.status === 'insufficient-payment' ? 'Payment needs attention' : 'Beyond projection limit' }}</p>
          <div v-if="pendingRemoval !== loan.id" class="loan-actions">
            <button class="text-button" type="button" :aria-label="`Edit ${loan.name}`" :aria-pressed="editingId === loan.id" @click="emit('edit', loan.id, $event)">Edit</button>
            <button class="text-button" type="button" :data-remove-id="loan.id" :aria-label="`Remove ${loan.name}`" @click="requestRemoval(loan.id)">Remove</button>
            <span v-if="loan.fromExample" class="example-label">From example</span>
          </div>
          <div v-else class="remove-confirmation" role="group" :aria-label="`Confirm removal of ${loan.name}`">
            <p>Remove this loan from your plan? This won’t affect your actual loan.</p>
            <div>
              <button class="text-button" type="button" @click="cancelRemoval">Keep loan</button>
              <button class="remove-button" type="button" @click="remove(loan.id)">Remove loan</button>
            </div>
          </div>
        </LoanPaymentChip>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.list-heading, .loan-actions, .remove-confirmation > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.list-heading h2 > span {
  color: var(--text-muted);
  font-size: var(--font-sm);
  margin-left: var(--space-2);
}

.add-button {
  flex-shrink: 0;
  background: var(--blue-light);
  color: var(--text-link);
  border: 1px solid var(--blue-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-xs);
  font-weight: 600;
  min-height: 2.75rem;
}

ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
  gap: var(--space-3);
  list-style: none;
  padding: 0;
  margin: var(--space-5) 0 0;
}

li {
  min-width: 0;
}
.loan-warning, .remove-confirmation p {
  font-size: var(--font-xs);
  color: var(--text-muted);
  line-height: 1.7;
}

.loan-warning {
  color: var(--danger);
}

.loan-actions {
  justify-content: start;
  margin-top: var(--space-2);
}

.loan-actions button {
  min-height: 2.5rem;
}

.loan-actions button:first-child { padding: var(--space-2) var(--space-3); border: 1px solid var(--blue-border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-link); font-weight: 600; text-decoration: none; }

.example-label {
  font-size: 0.65rem;
  color: var(--text-muted);
  margin-left: auto;
}

.remove-confirmation {
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  margin-top: var(--space-3);
}

.remove-confirmation p {
  margin: 0 0 var(--space-3);
}

.remove-button {
  border: 1px solid var(--danger);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--danger);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-xs);
  min-height: 2.5rem;
}

</style>
