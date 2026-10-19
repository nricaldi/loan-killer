<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{ editing: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
let previousOverflow = ''

function containFocus(event: KeyboardEvent) {
  const elements = Array.from(dialog.value?.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]') ?? [])
    .filter((element) => !element.matches(':disabled') && element.tabIndex >= 0)
  const first = elements[0]
  const last = elements[elements.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

onMounted(() => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  dialog.value?.showModal()
  dialog.value?.querySelector<HTMLInputElement>('#loan-name')?.focus()
})

onBeforeUnmount(() => {
  dialog.value?.close()
  document.body.style.overflow = previousOverflow
})
</script>

<template>
  <dialog ref="dialog" class="loan-modal" :aria-label="editing ? 'Edit loan' : 'Add loan'" @cancel.prevent="emit('close')" @click.self="emit('close')" @keydown.tab="containFocus">
    <div class="modal-content">
      <button class="close-button" type="button" aria-label="Close loan form" @click="emit('close')">×</button>
      <slot />
    </div>
  </dialog>
</template>

<style scoped>
.loan-modal { width: min(36rem, calc(100% - var(--space-6))); max-height: calc(100dvh - var(--space-6)); padding: 0; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); color: var(--text); box-shadow: var(--shadow-modal); overflow: auto; }
.loan-modal::backdrop { background: #20354180; }
.modal-content { position: relative; }
.close-button { position: absolute; top: var(--space-4); right: var(--space-4); display: grid; place-items: center; width: 2.75rem; height: 2.75rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-secondary); font-size: 1.5rem; line-height: 1; }
</style>
