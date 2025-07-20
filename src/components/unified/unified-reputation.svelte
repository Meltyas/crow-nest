<script lang="ts">
  import AddItemForm from '@/components/guard/add-item-form.svelte';
  import ItemCard from '@/components/guard/item-card.svelte';
  import {
    addReputation,
    deleteReputationPreset,
    presetsStore,
    toggleReputationActive
  } from '@/stores/presets';
  import { generateUUID } from '@/utils/log';
  import { SyncManager } from '@/utils/sync';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { Subject } from 'rxjs';
  import { takeUntil, distinctUntilChanged, debounceTime, tap } from 'rxjs/operators';
  import { openReputationEditDialog } from '../../utils/dialog-manager';

  // Component props - siguiendo el patrón de resources-section
  export let groupId: string | undefined = undefined; // undefined = global, string = group-specific
  export let title: string = 'Reputación';
  export let expandedReputationDetails: Record<string, boolean> = {};
  export let inPresetManager: boolean = false; // Show preset activation buttons when true

  const dispatch = createEventDispatcher();

  // RxJS cleanup and component management
  const destroy$ = new Subject<void>();
  const componentId = `unified-reputation-${groupId || 'global'}-${Math.random().toString(36).substr(2, 9)}`;

  // Suscripción al store para reactividad completa
  let currentPresets = $presetsStore;
  let syncManager: SyncManager;

  // Local state - siguiendo el patrón de resources-section.svelte
  let addingReputation = false;
  let newReputation: any = {
    key: '',
    name: '',
    value: 0,
    img: 'icons/svg/aura.svg',
    details: ''
  };

  // Variables reactivas basadas en el store actualizado - con ordenamiento personalizado
  $: activeReputations = (groupId
    ? currentPresets.reputations.filter(r => r.groupId === groupId && r.active)
    : currentPresets.reputations.filter(r => !r.groupId && r.active))
    .sort((a, b) => (a.guardOrder ?? 999) - (b.guardOrder ?? 999));

  // Para presets: todos los disponibles para seleccionar - ordenados por presetOrder
  $: availablePresets = (groupId
    ? currentPresets.reputations.filter(r => r.groupId === groupId)
    : currentPresets.reputations.filter(r => !r.groupId))
    .sort((a, b) => (a.presetOrder ?? 999) - (b.presetOrder ?? 999));

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

  // Sincronización y lifecycle con RxJS
  onMount(() => {
    console.log('UnifiedReputation - Setting up RxJS subscriptions for componentId:', componentId, 'groupId:', groupId);

    // Initialize SyncManager (no longer needs dynamic import)
    syncManager = SyncManager.getInstance();

    // RxJS REACTIVE PIPELINE - Convert Svelte store to observable
    const presetsStoreSubject = new Subject();
    const presetsStoreUnsubscribe = presetsStore.subscribe(value => {
      presetsStoreSubject.next(value);
    });

    // Primary stream: Local store updates with debouncing
    presetsStoreSubject.pipe(
      distinctUntilChanged(),
      debounceTime(30),
      tap(presets => console.log('UnifiedReputation - Store updated for groupId:', groupId, !!presets)),
      takeUntil(destroy$)
    ).subscribe(storePresets => {
      if (storePresets && storePresets !== currentPresets) {
        currentPresets = storePresets;
      }
    });

    // Secondary stream: Remote sync updates (for bidirectional sync)
    syncManager.subscribeToDataType('presets', componentId, (syncPresets) => {
      console.log('UnifiedReputation - Sync update for groupId:', groupId, !!syncPresets);
      if (syncPresets && syncPresets !== currentPresets) {
        console.log('UnifiedReputation - Applying sync presets for groupId:', groupId);
        currentPresets = syncPresets;
      }
    });

    // Cleanup function for the Svelte store subscription
    return () => {
      presetsStoreUnsubscribe();
    };
  });

  onDestroy(() => {
    // RxJS CLEANUP - Single cleanup call replaces manual unsubscribe
    console.log('UnifiedReputation - Cleaning up RxJS subscriptions for componentId:', componentId);
    
    if (syncManager) {
      syncManager.cleanupComponent(componentId);
    }

    // Complete the destroy subject to clean up all RxJS subscriptions
    destroy$.next();
    destroy$.complete();
  });

  function openAddReputation() {
    // Use global dialog for adding new reputation
    openReputationEditDialog({
      id: '',
      name: '',
      value: 0,
      description: '',
      img: '',
      sourceId: ''
    });
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
    console.log('UnifiedReputation Debug:', {
      groupId,
      inPresetManager,
      activeCount: activeReputations.length,
      presetCount: availablePresets.length,
      displayCount: displayReputations.length,
      itemCount: reputationItems.length
    });
  }

  function handleEditItem(event: CustomEvent) {
    const { item, type } = event.detail;
    if (type === 'reputation') {
      if (inPresetManager) {
        // Use global dialog when in preset manager
        const reputation = {
          id: item.sourceId || item.id,
          name: item.name,
          value: item.value,
          description: item.description || item.details,
          img: item.img,
          sourceId: item.sourceId || item.id
        };
        openReputationEditDialog(reputation);
      } else {
        // Dispatch event to parent component for guard.svelte
        dispatch('editReputation', { reputation: item });
      }
    }
  }

  // Preset management functions
  async function toggleReputationActiveState(data: { id: string, active: boolean }) {
    console.log('UnifiedReputation - toggleReputationActiveState called with:', data);
    await toggleReputationActive(data.id);
    dispatch('updateReputation'); // Notify parent component if needed
  }

  async function removeReputationPreset(id: string) {
    console.log('UnifiedReputation - removeReputationPreset called with:', id);
    await deleteReputationPreset(id);
    dispatch('updateReputation'); // Notify parent component if needed
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

  async function handleDrop(event: DragEvent, dropIndex: number) {
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

      // Handle reordering directly in preset store
      await reorderReputationsInStore(draggedIndex, newIndex, inPresetManager);
      
      dispatch('reorderReputations', { 
        dragIndex: draggedIndex, 
        dropIndex: newIndex,
        inPresetManager: inPresetManager 
      });
    }

    draggedIndex = null;
    dropZoneVisible = {};
  }

  async function reorderReputationsInStore(dragIndex: number, dropIndex: number, inPresetManager: boolean) {
    const orderProperty = inPresetManager ? 'presetOrder' : 'guardOrder';
    const currentReputations = displayReputations;
    
    if (dragIndex < 0 || dragIndex >= currentReputations.length || 
        dropIndex < 0 || dropIndex >= currentReputations.length) {
      return;
    }

    // Get the dragged item
    const draggedItem = currentReputations[dragIndex];
    
    // Update the preset store with new order values
    const updatedReputations = [...currentPresets.reputations];
    
    // Reassign order values based on new positions
    currentReputations.forEach((reputation, index) => {
      const storeIndex = updatedReputations.findIndex(r => r.id === reputation.id);
      if (storeIndex !== -1) {
        if (index === dragIndex) {
          // Set dragged item order to drop position
          updatedReputations[storeIndex] = {
            ...updatedReputations[storeIndex],
            [orderProperty]: dropIndex
          };
        } else if (index < dragIndex && index >= dropIndex) {
          // Items shifting right (increase order)
          const currentOrder = updatedReputations[storeIndex][orderProperty] ?? index;
          updatedReputations[storeIndex] = {
            ...updatedReputations[storeIndex],
            [orderProperty]: currentOrder + 1
          };
        } else if (index > dragIndex && index <= dropIndex) {
          // Items shifting left (decrease order)
          const currentOrder = updatedReputations[storeIndex][orderProperty] ?? index;
          updatedReputations[storeIndex] = {
            ...updatedReputations[storeIndex],
            [orderProperty]: Math.max(0, currentOrder - 1)
          };
        }
      }
    });

    // Update the store
    presetsStore.set({
      ...currentPresets,
      reputations: updatedReputations
    });

    // Persist changes
    await savePresetsToFoundry();
  }

  async function savePresetsToFoundry() {
    try {
      if (typeof game !== 'undefined' && game.settings) {
        await game.settings.set('crow-nest', 'unifiedPresets', $presetsStore);
      }
    } catch (error) {
      console.error('Error saving presets to Foundry:', error);
    }
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
      <button class="add-button standard-button" on:click={openAddReputation}>➕ Añadir</button>
    </div>
  </h3>

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
        on:activatePreset={(e) => toggleReputationActiveState(e.detail)}
        on:removePreset={(e) => removeReputationPreset(e.detail)}
        on:editItem={handleEditItem}
      />
    {/each}
  </div>
</div>

<style>
  /* Reputation Styles - siguiendo el patrón de resources-section.svelte */
  .reputation-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-top: 0.5rem;
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
