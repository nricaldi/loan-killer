<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { LoanStorageIssue } from '../storage/loanStorage'

const props = defineProps<{ issue: LoanStorageIssue | null; requiresReplacement: boolean; loanCount: number }>()
const emit = defineEmits<{ retry: []; replace: [] }>()
const confirming = ref(false)
const notice = ref<HTMLElement | null>(null)
const message = computed(() => {
  if (props.issue === 'load-error') return 'Saved loans couldn’t be restored. Storage may be blocked or the saved format may be unreadable. Any saved copy was left untouched. This tab’s loan changes won’t be saved unless you explicitly replace that copy.'
  if (props.issue === 'conflict') return 'The saved loan list changed in another tab. This tab’s changes have not been saved. Reload to use the other copy and discard this tab’s unsaved changes, or explicitly replace the saved copy with this plan.'
  return 'Your latest loan changes couldn’t be saved. Keep this page open; they are only in memory. A previous saved version may reappear after refresh. Enable browser storage or free up site storage, then retry.'
})

async function confirmReplacement() {
  confirming.value = true
  await nextTick()
  notice.value?.querySelector<HTMLButtonElement>('.cancel-replacement')?.focus()
}

async function cancelReplacement() {
  confirming.value = false
  await nextTick()
  notice.value?.querySelector<HTMLButtonElement>('.replace-copy')?.focus()
}

async function save(replace: boolean) {
  confirming.value = false
  if (replace) emit('replace')
  else emit('retry')
  await nextTick()
  notice.value?.focus()
}
</script>

<template>
  <aside ref="notice" class="storage-notice" :class="{ 'storage-warning': issue }" aria-label="Data storage notice" tabindex="-1">
    <svg v-if="issue" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2 3.5 5v4.5c0 4.2 6.5 7.5 6.5 7.5s6.5-3.3 6.5-7.5V5L10 2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
      <path d="m7 9.5 2 2 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <div class="storage-content">
      <template v-if="issue">
        <p class="storage-error" role="alert"><strong>Local save needs attention.</strong> {{ message }}</p>
        <div v-if="confirming" class="replacement-confirmation" role="group" aria-label="Confirm replacing saved loans">
          <p><strong>{{ loanCount === 0 ? 'Replace saved loans with an empty plan?' : `Replace the saved copy with this tab’s ${loanCount} ${loanCount === 1 ? 'loan' : 'loans'}?` }}</strong> This overwrites only Loan Killer’s saved loan list and can’t be undone.</p>
          <div class="storage-actions"><button class="cancel-replacement" type="button" @click="cancelReplacement">Cancel replacement</button><button type="button" @click="save(true)">Replace saved copy now</button></div>
        </div>
        <div v-else class="storage-actions">
          <button v-if="requiresReplacement" class="replace-copy" type="button" @click="confirmReplacement">Replace saved copy</button>
          <button v-else type="button" @click="save(false)">Retry saving</button>
        </div>
      </template>
      <details class="storage-details">
        <summary>Storage and privacy details</summary>
        <p v-if="!issue"><strong>Kept in this browser.</strong> Added, updated, and confirmed removed loans save automatically and return on this same site. Clearing browser data can delete them.</p>
        <p>No upload or sync. Only this browser profile and site address share these loans; anyone using this profile can access them. The app doesn’t encrypt this local copy. Clearing site data or closing a private-browsing session can delete them. Drafts and what-if scenarios aren’t saved. Balances keep their entered dates and aren’t updated automatically; check your figures and next payment dates when returning.</p>
      </details>
    </div>
  </aside>
</template>

<style scoped>
.storage-notice { display: flex; align-items: start; gap: var(--space-3); }
.storage-notice > svg { width: 1.15rem; height: 1.15rem; flex-shrink: 0; color: var(--text-link); margin-top: 0.1rem; }
.storage-content { min-width: 0; }
p { margin: 0; color: var(--text-secondary); font-size: var(--font-xs); line-height: 1.8; }
strong { font-weight: 600; }
.storage-details { color: var(--text-muted); }
.storage-details summary { color: var(--text-link); font-size: var(--font-xs); line-height: 1.8; cursor: pointer; }
.storage-details p { margin-top: var(--space-2); }
.storage-warning { padding: var(--space-4); background: var(--blue-light); border: 1px solid var(--danger); border-radius: var(--radius-sm); }
.storage-warning .storage-details { margin-top: var(--space-2); }
.storage-error { color: var(--danger); }
.storage-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-3); }
button { background: var(--surface); color: var(--text-link); border: 1px solid var(--blue-border); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); min-height: 2.75rem; font-size: var(--font-xs); line-height: 1.6; }
.replacement-confirmation { margin-top: var(--space-3); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); padding: var(--space-3); background: var(--surface); }
</style>
