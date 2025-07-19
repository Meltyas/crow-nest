<script lang="ts">
  import AddItemForm from '@/components/guard/add-item-form.svelte';
  import ItemCard from '@/components/guard/item-card.svelte';
  import {
    deleteReputationPreset,
    presetsStore,
    toggleReputationActive
  } from '@/stores/presets';
  import { generateUUID } from '@/utils/log';
  import type { SyncManager } from '@/utils/sync';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import ReputationEditDialog from './dialogs/ReputationEditDialog.svelte';

  // Component props - siguiendo el patrón de resources-section
  export let groupId: string | undefined = undefined; // undefined = global, string = group-specific
  export let title: string = 'Reputación';
  export let showPresets: boolean = true;
  export let expandedReputationDetails: Record<string, boolean> = {};
  export let inPresetManager: boolean = false; // Show preset activation buttons when true

  const dispatch = createEventDispatcher();

  // Suscripción al store para reactividad completa
  let currentPresets = $presetsStore;
  let syncManager: SyncManager;

  // Local state - siguiendo el patrón de resources-section.svelte
  let addingReputation = false;
  let showPresetsPanel = false;
  let newReputation: any = {
    key: '',
    name: '',
    value: 0,
    img: 'icons/svg/aura.svg',
    details: ''
  };

  // Estado del diálogo de edición
  let editDialogVisible = false;
  let editingReputation: any = null;

  // Variables reactivas basadas en el store actualizado
  $: activeReputations = groupId
    ? currentPresets.reputations.filter(r => r.groupId === groupId && r.active)
    : currentPresets.reputations.filter(r => !r.groupId && r.active);

  // Para presets: todos los disponibles para seleccionar
  $: availablePresets = groupId
    ? currentPresets.reputations.filter(r => r.groupId === groupId)
    : currentPresets.reputations.filter(r => !r.groupId);

  // En preset manager, mostrar todos los presets; en guard, solo los activos
  $: displayReputations = inPresetManager ? availablePresets : activeReputations;

  // Convertir a formato ItemCard
  $: reputationItems = displayReputations.map(rep => ({
    key: rep.id,
    id: rep.id, // Mantener también el id original para compatibilidad
    name: rep.name,
    value: rep.value,
    img: rep.img || 'icons/svg/aura.svg',
    details: rep.description || '',
    active: rep.active || false // Asegurar que active esté disponible para ItemCard
  }));

  // Sincronización y lifecycle
  onMount(() => {
    // Suscribirse al store para reactividad
    const unsubscribe = presetsStore.subscribe(value => {
      currentPresets = value;
    });

    // Configurar sincronización bidireccional
    import('@/utils/sync').then(({ SyncManager }) => {
      syncManager = SyncManager.getInstance();
      syncManager.subscribe('unifiedPresets', handleSyncUpdate);
    });

    return () => {
      unsubscribe();
    };
  });

  onDestroy(() => {
    if (syncManager) {
      syncManager.unsubscribe('unifiedPresets', handleSyncUpdate);
    }
  });

  function handleSyncUpdate(data: any) {
    // Actualizar cuando lleguen cambios externos
    if (data && data.reputations) {
      currentPresets = data;
    }
  }

  function togglePresets() {
    showPresetsPanel = !showPresetsPanel;
  }

  function openAddReputation() {
    newReputation = {
      key: generateUUID(),
      name: '',
      value: 0,
      img: 'icons/svg/aura.svg',
      details: ''
    };
    addingReputation = true;
  }

  function cancelAddReputation() {
    addingReputation = false;
  }

  async function confirmAddReputation() {
    // Crear nuevo preset en el store
    // En guard: active: true por defecto (elementos van directo al guard)
    // En preset manager: active: false por defecto (elementos van al preset pool)
    const newId = `reputation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newRep = {
      id: newId,
      sourceId: newReputation.key,
      name: newReputation.name,
      value: newReputation.value,
      img: newReputation.img,
      description: newReputation.details,
      groupId, // undefined para global, string para grupo específico
      active: !inPresetManager // En guard activo por defecto, en preset manager inactivo
    };

    // Agregar al store de presets
    const { addReputation } = await import('@/stores/presets');
    await addReputation(newRep);

    addingReputation = false;
    dispatch('updateReputation');
  }

  async function removeReputation(index: number) {
    const reputation = displayReputations[index];
    if (reputation && confirm('¿Eliminar esta reputación?')) {
      if (inPresetManager) {
        // En preset manager, eliminar completamente
        await deleteReputationPreset(reputation.id);
      } else {
        // En guard, solo desactivar
        await toggleReputationActive(reputation.id);
      }
      dispatch('updateReputation');
    }
  }

  function onNewRepImageClick() {
    dispatch('newRepImageClick', newReputation);
  }

  function toggleReputationDetails(repKey: string) {
    expandedReputationDetails[repKey] = !expandedReputationDetails[repKey];
    expandedReputationDetails = { ...expandedReputationDetails };
  }

  function showReputationInChat(rep: any) {
    dispatch('showReputationInChat', rep);
  }

  function debugLogReputations() {
    console.log('=== DEBUG: Lista de Reputaciones ===');
    console.log('Active Reputations (guard content):', activeReputations);
    console.log('Available Presets (all presets):', availablePresets);
    console.log('Display Reputations (current context):', displayReputations);
    console.log('Reputation Items (ItemCard format):', reputationItems);
    console.log('Group ID:', groupId);
    console.log('In Preset Manager:', inPresetManager);
    console.log('====================================');
  }

  async function handleApplyPreset(presetId: string) {
    // Toggle: activar/desactivar preset del store
    await toggleReputationActive(presetId);
    showPresetsPanel = false;
    dispatch('updateReputation');
  }

  async function handleRemovePreset(presetId: string) {
    // Esta función elimina presets del store completamente
    if (confirm('¿Eliminar este preset permanentemente?')) {
      await deleteReputationPreset(presetId);
      dispatch('updateReputation');
    }
  }

  async function handleActivatePreset(presetId: string) {
    // Toggle: activar/desactivar preset del store
    await toggleReputationActive(presetId);

    // Forzar actualización del estado local para reactividad inmediata
    currentPresets = $presetsStore;

    dispatch('updateReputation');
  }

  function handleEditItem(event: CustomEvent) {
    const { item, type } = event.detail;
    if (type === 'reputation') {
      editingReputation = item;
      editDialogVisible = true;
    }
  }

  async function handleSaveEdit(event: CustomEvent) {
    const updatedReputation = event.detail;

    // Use updateReputation function from store
    const { updateReputation } = await import('@/stores/presets');
    await updateReputation(updatedReputation.id || updatedReputation.key, {
      name: updatedReputation.name,
      value: updatedReputation.value,
      description: updatedReputation.details
    });

    // Force local update
    currentPresets = $presetsStore;

    // Close dialog
    editDialogVisible = false;
    editingReputation = null;

    dispatch('updateReputation');
  }

  function handleCloseEdit() {
    editDialogVisible = false;
    editingReputation = null;
  }

  // Drag and drop functionality - siguiendo el patrón de resources-section
  let draggedIndex: number | null = null;
  let dropZoneVisible: Record<string, 'left' | 'right' | null> = {};

  function handleDragStart(event: DragEvent, index: number) {
    draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', '');
    }
  }

  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    event.stopPropagation();

    if (draggedIndex !== null && draggedIndex !== index) {
      const rect = (event.currentTarget as Element).getBoundingClientRect();
      const x = event.clientX;
      const centerX = rect.left + rect.width / 2;
      const side = x < centerX ? 'left' : 'right';

      dropZoneVisible = {};
      dropZoneVisible[index] = side;
      dropZoneVisible = { ...dropZoneVisible };

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    }
  }

  function handleDragLeave(event: DragEvent, index: number) {
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      dropZoneVisible[index] = null;
      dropZoneVisible = { ...dropZoneVisible };
    }
  }

  function handleDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      const side = dropZoneVisible[dropIndex];
      let newIndex: number;

      if (side === 'left') {
        newIndex = dropIndex;
      } else {
        newIndex = dropIndex + 1;
      }

      if (draggedIndex < newIndex) {
        newIndex = newIndex - 1;
      }

      dispatch('reorderReputations', { dragIndex: draggedIndex, dropIndex: newIndex });
    }

    draggedIndex = null;
    dropZoneVisible = {};
  }

  function handleDragEnd() {
    draggedIndex = null;
    dropZoneVisible = {};
  }

  function loadActiveReputations() {
    // Los datos ya se cargan reactivamente desde el store
    // activeReputations = getReputation();
  }

  onMount(() => {
    // Los datos reactivos se cargan automáticamente
    // loadActiveReputations();
  });
</script>

<div class="reputations-section">
  <h3 style="display: flex; justify-content: space-between; align-items: center; font-family: 'Eveleth', 'Overpass', Arial, sans-serif; font-size: 1.5rem; color: #f9fafb; font-weight: bold;">
    {title}
    <div style="display: flex; gap: 0.5rem; align-items: center;">
      <button class="debug-button standard-button" on:click={debugLogReputations} title="Debug: Mostrar lista en consola">
        🐛 Debug
      </button>
      {#if showPresets}
        <button
          class="edit-button standard-button"
          class:active={showPresetsPanel}
          on:click={togglePresets}
        >
          📋 Presets ({availablePresets.length})
        </button>
      {/if}
      <button class="add-button standard-button" on:click={openAddReputation}>➕ Añadir</button>
    </div>
  </h3>

  <!-- Presets Panel -->
  {#if showPresetsPanel && showPresets}
    <div class="presets-panel">
      <h4>Presets de Reputación</h4>
      {#if availablePresets.length === 0}
        <p class="no-presets">No hay presets de reputación guardados</p>
      {:else}
        <div class="presets-list">
          {#each availablePresets as preset}
            <div class="preset-item">
              <div class="preset-info">
                <div class="preset-header">
                  <span class="preset-name">{preset.name}</span>
                  <span class="preset-value">{preset.value}</span>
                </div>
                <div class="preset-status">
                  <span class="status-indicator {preset.active ? 'active' : 'inactive'}">
                    {preset.active ? '✓ Activo' : '○ Inactivo'}
                  </span>
                </div>
              </div>
              <div class="preset-actions">
                <button
                  class="btn btn-xs {preset.active ? 'btn-warning' : 'btn-primary'}"
                  on:click={() => handleApplyPreset(preset.id)}
                  title="{preset.active ? 'Retirar del guard' : 'Usar en guard'}"
                >
                  {preset.active ? 'Retirar' : 'Usar'}
                </button>
                <button
                  class="btn btn-xs btn-danger"
                  on:click={() => handleRemovePreset(preset.id)}
                  title="Eliminar Preset"
                >
                  🗑️
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if addingReputation}
    <AddItemForm
      type="reputation"
      item={newReputation}
      visible={addingReputation}
      on:imageClick={onNewRepImageClick}
      on:confirm={confirmAddReputation}
      on:cancel={cancelAddReputation}
    />
  {/if}

  <div class="reputation-container">
    {#each reputationItems as rep, i}
      <ItemCard
        item={rep}
        index={i}
        type="reputation"
        expandedDetails={expandedReputationDetails}
        {draggedIndex}
        {dropZoneVisible}
        {inPresetManager}
        on:remove={(e) => removeReputation(e.detail)}
        on:showInChat={(e) => showReputationInChat(e.detail)}
        on:toggleDetails={(e) => toggleReputationDetails(e.detail)}
        on:dragStart={(e) => handleDragStart(e.detail.event, e.detail.index)}
        on:dragOver={(e) => handleDragOver(e.detail.event, e.detail.index)}
        on:dragLeave={(e) => handleDragLeave(e.detail.event, e.detail.index)}
        on:drop={(e) => handleDrop(e.detail.event, e.detail.index)}
        on:dragEnd={handleDragEnd}
        on:createPreset={(e) => dispatch('createPreset', e.detail)}
        on:activatePreset={(e) => handleActivatePreset(e.detail.id)}
        on:removePreset={(e) => handleRemovePreset(e.detail)}
        on:editItem={handleEditItem}
      />
    {/each}
  </div>
</div>

{#if editDialogVisible && editingReputation}
  <ReputationEditDialog
    reputation={editingReputation}
    visible={editDialogVisible}
    on:save={handleSaveEdit}
    on:close={handleCloseEdit}
  />
{/if}

<style>
  /* Reputation Styles - siguiendo el patrón de resources-section.svelte */
  .reputation-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-top: 0.5rem;
  }

  /* Presets Panel - mantener estos estilos específicos */
  .presets-panel {
    background: rgba(230, 243, 255, 0.3);
    border: 1px dashed #007bff;
    border-radius: 4px;
    padding: 10px;
    margin-bottom: 12px;
  }

  .presets-panel h4 {
    margin: 0 0 8px 0;
    color: #007bff;
    font-size: 0.9em;
  }

  .presets-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .preset-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid #b3d9ff;
    border-radius: 4px;
    padding: 8px;
  }

  .preset-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .preset-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .preset-status {
    display: flex;
    align-items: center;
  }

  .status-indicator {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-weight: bold;
  }

  .status-indicator.active {
    color: #28a745;
    background-color: rgba(40, 167, 69, 0.1);
  }

  .status-indicator.inactive {
    color: #6c757d;
    background-color: rgba(108, 117, 125, 0.1);
  }

  .preset-name {
    font-weight: bold;
    color: #007bff;
  }

  .preset-value {
    font-size: 0.85em;
    color: #666;
  }

  .preset-actions {
    display: flex;
    gap: 4px;
  }

  .no-presets {
    text-align: center;
    color: #888;
    font-style: italic;
    padding: 16px;
  }

  /* Botones para presets */
  .btn {
    padding: 4px 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 0.85em;
    transition: all 0.2s;
  }

  .btn:hover {
    background: #f0f0f0;
  }

  .btn-primary {
    background: #007bff;
    color: white;
    border-color: #0056b3;
  }

  .btn-primary:hover {
    background: #0056b3;
  }

  .btn-danger {
    background: #dc3545;
    color: white;
    border-color: #c82333;
  }

  .btn-warning {
    background: #ffc107;
    color: #212529;
    border-color: #d39e00;
  }

  .btn-warning:hover {
    background: #d39e00;
  }

  .btn-xs {
    padding: 2px 6px;
    font-size: 0.75em;
  }

  /* Responsive design for reputation grid */
  @media (max-width: 1200px) {
    .reputation-container {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 768px) {
    .reputation-container {
      grid-template-columns: 1fr;
    }
  }
</style>
