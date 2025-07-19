<script lang="ts">
  import UnifiedReputation from '@/components/unified/unified-reputation.svelte';
  import { createEventDispatcher } from 'svelte';

  export let groupId: string | undefined = undefined; // undefined = global, string = group-specific
  export let editingReputation = false;
  export let expandedReputationDetails: Record<string, boolean> = {};

  // Props que pasa guard.svelte pero que no usamos directamente
  export const reputation: any[] = []; // Mantenemos compatibilidad con guard.svelte

  const dispatch = createEventDispatcher();

  // Reenviar eventos al parent (guard.svelte)
  function handleToggleEditingReputation() {
    dispatch('toggleEditingReputation');
  }

  function handleAddReputation(event: any) {
    dispatch('addReputation', event.detail);
  }

  function handleRemoveReputation(event: any) {
    dispatch('removeReputation', event.detail);
  }

  function handleUpdateReputation() {
    dispatch('updateReputation');
  }

  function handleRepImageClick(event: any) {
    dispatch('repImageClick', event.detail);
  }

  function handleNewRepImageClick(event: any) {
    dispatch('newRepImageClick', event.detail);
  }

  function handleRepFileChange(event: any) {
    dispatch('repFileChange', event.detail);
  }

  function handleShowReputationInChat(event: any) {
    dispatch('showReputationInChat', event.detail);
  }

  function handleToggleReputationDetails(event: any) {
    dispatch('toggleReputationDetails', event.detail);
  }

  function handleReorderReputation(event: any) {
    dispatch('reorderReputation', event.detail);
  }

  function handleCreatePreset(event: any) {
    dispatch('createPreset', event.detail);
  }
</script>

<UnifiedReputation
  {groupId}
  title="Reputación"
  showPresets={true}
  editingReputations={editingReputation}
  {expandedReputationDetails}
  on:toggleEditingReputations={handleToggleEditingReputation}
  on:updateReputation={handleUpdateReputation}
  on:repImageClick={handleRepImageClick}
  on:newRepImageClick={handleNewRepImageClick}
  on:repFileChange={handleRepFileChange}
  on:showReputationInChat={handleShowReputationInChat}
  on:reorderReputations={handleReorderReputation}
  on:createPreset={handleCreatePreset}
/>

<style>
  /* Estilos específicos si son necesarios */
</style>
