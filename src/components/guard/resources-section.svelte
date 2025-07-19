<script lang="ts">
  import UnifiedResources from '@/components/unified/unified-resources.svelte';
  import { createEventDispatcher } from 'svelte';

  export let groupId: string | undefined = undefined; // undefined = global, string = group-specific
  export let editingResources = false;
  export let expandedResourceDetails: Record<string, boolean> = {};

  // Props que pasa guard.svelte pero que no usamos directamente
  export const resources: any[] = []; // Mantenemos compatibilidad con guard.svelte

  const dispatch = createEventDispatcher();

  // Reenviar eventos al parent (guard.svelte)
  function handleToggleEditingResources() {
    dispatch('toggleEditingResources');
  }

  function handleAddResource(event: any) {
    dispatch('addResource', event.detail);
  }

  function handleRemoveResource(event: any) {
    dispatch('removeResource', event.detail);
  }

  function handleUpdateResource() {
    dispatch('updateResource');
  }

  function handleResImageClick(event: any) {
    dispatch('resImageClick', event.detail);
  }

  function handleNewResImageClick(event: any) {
    dispatch('newResImageClick', event.detail);
  }

  function handleResFileChange(event: any) {
    dispatch('resFileChange', event.detail);
  }

  function handleShowResourceInChat(event: any) {
    dispatch('showResourceInChat', event.detail);
  }

  function handleReorderResources(event: any) {
    dispatch('reorderResources', event.detail);
  }

  function handleCreatePreset(event: any) {
    dispatch('createPreset', event.detail);
  }
</script>

<UnifiedResources
  {groupId}
  title="Recursos"
  showPresets={true}
  editingResources={editingResources}
  {expandedResourceDetails}
  on:toggleEditingResources={handleToggleEditingResources}
  on:updateResource={handleUpdateResource}
  on:resImageClick={handleResImageClick}
  on:newResImageClick={handleNewResImageClick}
  on:resFileChange={handleResFileChange}
  on:showResourceInChat={handleShowResourceInChat}
  on:reorderResources={handleReorderResources}
  on:createPreset={handleCreatePreset}
/>

<style>
  /* Estilos específicos si son necesarios */
</style>
