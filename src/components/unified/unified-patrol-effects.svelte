<script lang="ts">
  import AddItemForm from '@/components/guard/add-item-form.svelte';
  import PatrolCard from '@/components/guard/patrol-card.svelte';
  import {
    addPatrolEffect,
    deletePatrolEffectPreset,
    presetsStore,
    togglePatrolEffectActive
  } from '@/stores/presets';
  import { SyncManager } from '@/utils/sync';
  import { Subject } from 'rxjs';
  import { debounceTime, distinctUntilChanged, takeUntil, tap } from 'rxjs/operators';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { openPatrolEffectEditDialog } from '../../utils/dialog-manager';

  // Component props - siguiendo el patrón de unified-resources
  export let groupId: string | undefined = undefined; // undefined for global patrol effects
  export let title: string = 'Efectos de Patrulla';
  export let expandedPatrolEffectDetails: Record<string, boolean> = {};
  export let inPresetManager: boolean = false; // Show preset activation buttons when true

  const dispatch = createEventDispatcher();

  // RxJS cleanup and component management
  const destroy$ = new Subject<void>();
  const componentId = `unified-patrol-effects-${groupId || 'global'}-${Math.random().toString(36).substr(2, 9)}`;

  // Suscripción al store para reactividad completa
  let currentPresets = $presetsStore;
  let syncManager: SyncManager;

  // Local state - siguiendo el patrón de resources-section.svelte
  let addingPatrolEffect = false;
  let newPatrolEffect: any = {
    key: '',
    name: '',
    statEffects: {},
    img: 'icons/svg/aura.svg',
    details: ''
  };

  // Variables reactivas basadas en el store actualizado - con ordenamiento personalizado
  $: activePatrolEffects = (groupId
    ? currentPresets.patrolEffects.filter(e => e.groupId === groupId && e.active)
    : currentPresets.patrolEffects.filter(e => !e.groupId && e.active))
    .sort((a, b) => (a.presetOrder ?? 999) - (b.presetOrder ?? 999));

  // Para presets: todos los disponibles para seleccionar - ordenados por presetOrder
  $: availablePresets = (groupId
    ? currentPresets.patrolEffects.filter(e => e.groupId === groupId)
    : currentPresets.patrolEffects.filter(e => !e.groupId))
    .sort((a, b) => (a.presetOrder ?? 999) - (b.presetOrder ?? 999));

  // En preset manager, mostrar todos los presets; en guard, solo los activos
  $: displayPatrolEffects = inPresetManager ? availablePresets : activePatrolEffects;

  // Drag and drop state
  let draggedIndex: number | null = null;
  let dropZoneVisible: Record<string, 'left' | 'right' | null> = {};

  // Sincronización y lifecycle con RxJS
  onMount(() => {
    console.log('UnifiedPatrolEffects - Setting up RxJS subscriptions for componentId:', componentId, 'groupId:', groupId);

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
      tap(presets => console.log('UnifiedPatrolEffects - Store updated for groupId:', groupId, !!presets)),
      takeUntil(destroy$)
    ).subscribe(storePresets => {
      if (storePresets && storePresets !== currentPresets) {
        currentPresets = storePresets;
      }
    });

    // Secondary stream: Remote sync updates (for bidirectional sync)
    syncManager.subscribeToDataType('presets', componentId, (syncPresets) => {
      console.log('UnifiedPatrolEffects - Sync update for groupId:', groupId, !!syncPresets);
      if (syncPresets && syncPresets !== currentPresets) {
        console.log('UnifiedPatrolEffects - Applying sync presets for groupId:', groupId);
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
    console.log('UnifiedPatrolEffects - Cleaning up RxJS subscriptions for componentId:', componentId);

    destroy$.next();
    destroy$.complete();

    if (syncManager) {
      syncManager.cleanupComponent(componentId);
    }
  });

  function openAddPatrolEffect() {
    // Use global dialog for adding new patrol effect
    openPatrolEffectEditDialog({
      id: '',
      name: '',
      value: 0,
      type: 'permanent',
      statEffects: {},
      description: '',
      img: '',
      sourceId: ''
    });
  }

  function cancelAddPatrolEffect() {
    addingPatrolEffect = false;
  }

  async function confirmAddPatrolEffect() {
    // Crear nuevo preset en el store
    // En guard: active: true por defecto (elementos van directo al guard)
    // En preset manager: active: false por defecto (elementos van al preset pool)
    await addPatrolEffect({
      name: newPatrolEffect.name,
      value: newPatrolEffect.value,
      type: newPatrolEffect.type,
      statEffects: newPatrolEffect.statEffects,
      img: newPatrolEffect.img,
      description: newPatrolEffect.description,
      groupId: groupId,
      sourceId: `patrol-effect-${Date.now()}`,
      active: !inPresetManager // En guard activo por defecto, en preset manager inactivo
    });
    addingPatrolEffect = false;
    dispatch('updatePatrolEffect');
  }

  async function removePatrolEffectItem(index: number) {
    const patrolEffect = displayPatrolEffects[index];
    if (patrolEffect && confirm('¿Eliminar este efecto de patrulla?')) {
      if (inPresetManager) {
        // En preset manager, eliminar completamente
        await deletePatrolEffectPreset(patrolEffect.id);
      } else {
        // En guard, solo desactivar
        await togglePatrolEffectActive(patrolEffect.id);
      }
      dispatch('updatePatrolEffect');
    }
  }

  function onNewPatrolEffectImageClick() {
    dispatch('newPatrolEffectImageClick', newPatrolEffect);
  }

  function togglePatrolEffectDetails(effectKey: string) {
    expandedPatrolEffectDetails[effectKey] = !expandedPatrolEffectDetails[effectKey];
    expandedPatrolEffectDetails = { ...expandedPatrolEffectDetails };
  }

  function showPatrolEffectInChat(effect: any) {
    dispatch('showPatrolEffectInChat', effect);
  }

  function debugLogPatrolEffects() {
    console.log('UnifiedPatrolEffects Debug:', {
      groupId,
      inPresetManager,
      activeCount: activePatrolEffects.length,
      presetCount: availablePresets.length,
      displayCount: displayPatrolEffects.length
    });
  }

  // New handler function for PatrolCard edit events
  function handleEditPatrolEffect(patrolEffect: any) {
    if (inPresetManager) {
      // Use global dialog when in preset manager
      openPatrolEffectEditDialog(patrolEffect);
    } else {
      // Dispatch event to parent component for guard.svelte
      dispatch('editPatrolEffect', patrolEffect);
    }
  }

  // Handler for PatrolCard use events
  function handleUsePatrolEffect(patrolEffect: any) {
    if (inPresetManager) {
      // Emit a window event that groups.svelte can listen to
      const event = new CustomEvent('crow-nest-apply-patrol-effect', {
        detail: { patrolEffect }
      });
      window.dispatchEvent(event);
    }
    // If not in preset manager, this button shouldn't be shown, but if it is, do nothing
  }

  function handleEditItem(event: CustomEvent) {
    const { item, type } = event.detail;
    if (type === 'patrol-effect') {
      if (inPresetManager) {
        // Use global dialog when in preset manager
        const patrolEffect = {
          id: item.sourceId || item.id,
          name: item.name,
          value: item.value,
          type: item.type,
          statEffects: item.statEffects,
          description: item.description || item.details,
          img: item.img,
          sourceId: item.sourceId || item.id
        };
        openPatrolEffectEditDialog(patrolEffect);
      } else {
        // Dispatch event to parent component for guard.svelte
        dispatch('editPatrolEffect', item);
      }
    }
  }

  // Drag and drop functionality
  function handleDragStart(index: number) {
    draggedIndex = index;
  }

  function handleDragEnter(index: number) {
    if (draggedIndex !== null && draggedIndex !== index) {
      dropZoneVisible = {};
      dropZoneVisible[index] = 'left'; // simplified for now
      dropZoneVisible = { ...dropZoneVisible };
    }
  }

  function handleDragLeave(index: number) {
    dropZoneVisible[index] = null;
    dropZoneVisible = { ...dropZoneVisible };
  }

  async function handleDrop(dropData: { draggedIndex: number, targetIndex: number, position: 'left' | 'right' }) {
    dropZoneVisible = {};

    if (dropData.draggedIndex === dropData.targetIndex) {
      draggedIndex = null;
      return;
    }

    // Reorder the patrol effects
    await reorderPatrolEffects(dropData.draggedIndex, dropData.targetIndex);
    draggedIndex = null;
  }

  function handleDragEnd() {
    draggedIndex = null;
    dropZoneVisible = {};
  }

  // Preset management functions
  function createPatrolEffectPreset(patrolEffect: any) {
    dispatch('createPreset', patrolEffect);
  }

  async function togglePatrolEffectActiveState(data: { id: string, active: boolean }) {
    console.log('UnifiedPatrolEffects - togglePatrolEffectActiveState called with:', data);
    await togglePatrolEffectActive(data.id);
    dispatch('updatePatrolEffect'); // Notify parent component if needed
  }

  function removePatrolEffectPreset(id: string) {
    dispatch('removePreset', id);
  }

  async function reorderPatrolEffects(dragIndex: number, dropIndex: number) {
    // Create a copy of the current patrol effects to modify
    const updatedPatrolEffects = [...currentPresets.patrolEffects];

    // Get the items being reordered - only using presetOrder since guardOrder was removed
    const draggedItem = displayPatrolEffects[dragIndex];
    const orderProperty = 'presetOrder';

    // Find the indices in the main array
    displayPatrolEffects.forEach((item, index) => {
      const storeIndex = updatedPatrolEffects.findIndex(e => e.id === item.id);
      if (storeIndex === -1) return;

      if (index === dragIndex) {
        // Set the dragged item to the drop position
        updatedPatrolEffects[storeIndex] = {
          ...updatedPatrolEffects[storeIndex],
          [orderProperty]: dropIndex
        };
      } else if (dragIndex < dropIndex && index > dragIndex && index <= dropIndex) {
        // Items shifting left (decrease order)
        const currentOrder = updatedPatrolEffects[storeIndex][orderProperty] ?? index;
        updatedPatrolEffects[storeIndex] = {
          ...updatedPatrolEffects[storeIndex],
          [orderProperty]: Math.max(0, currentOrder - 1)
        };
      } else if (dragIndex > dropIndex && index < dragIndex && index >= dropIndex) {
        // Items shifting right (increase order)
        const currentOrder = updatedPatrolEffects[storeIndex][orderProperty] ?? index;
        updatedPatrolEffects[storeIndex] = {
          ...updatedPatrolEffects[storeIndex],
          [orderProperty]: currentOrder + 1
        };
      }
    });

    // Update the store
    presetsStore.set({
      ...currentPresets,
      patrolEffects: updatedPatrolEffects
    });

    // Persist changes
    await savePresetsToFoundry();
  }

  async function savePresetsToFoundry() {
    try {
      if (typeof game !== 'undefined' && game.settings) {
        await (game as any).settings.set('crow-nest', 'unifiedPresets', $presetsStore);
      }
    } catch (error) {
      console.error('Error saving presets to Foundry:', error);
    }
  }
</script>

<div class="patrol-effects-section">
  <h3 style="display: flex; justify-content: space-between; align-items: center; font-family: 'Eveleth', 'Overpass', Arial, sans-serif; font-size: 1.5rem; color: #f9fafb; font-weight: bold;">
    {title}
    <div style="display: flex; gap: 0.5rem; align-items: center;">
      <button class="debug-button standard-button" on:click={debugLogPatrolEffects} title="Debug: Mostrar lista en consola">
        🐛 Debug
      </button>
      <button class="add-button standard-button" on:click={openAddPatrolEffect}>➕ Añadir</button>
    </div>
  </h3>

  {#if addingPatrolEffect}
    <AddItemForm
      type="patrol-effect"
      item={newPatrolEffect}
      visible={addingPatrolEffect}
      on:imageClick={onNewPatrolEffectImageClick}
      on:confirm={confirmAddPatrolEffect}
      on:cancel={cancelAddPatrolEffect}
    />
  {/if}

  <div class="patrol-effects-container {inPresetManager ? '' : 'guard-mode'}">
    {#each displayPatrolEffects as effect, i}
      <PatrolCard
        patrolEffect={effect}
        index={i}
        expandedDetails={expandedPatrolEffectDetails}
        {draggedIndex}
        {dropZoneVisible}
        {inPresetManager}
        on:remove={(e) => removePatrolEffectItem(e.detail)}
        on:showInChat={(e) => showPatrolEffectInChat(e.detail)}
        on:edit={(e) => handleEditPatrolEffect(e.detail)}
        on:use={(e) => handleUsePatrolEffect(e.detail)}
        on:dragStart={(e) => handleDragStart(e.detail)}
        on:dragEnter={(e) => handleDragEnter(e.detail)}
        on:dragLeave={(e) => handleDragLeave(e.detail)}
        on:drop={(e) => handleDrop(e.detail)}
        on:dragEnd={handleDragEnd}
        on:createPreset={(e) => createPatrolEffectPreset(e.detail)}
        on:activatePreset={(e) => togglePatrolEffectActiveState(e.detail)}
        on:removePreset={(e) => removePatrolEffectPreset(e.detail)}
      />
    {/each}
  </div>
</div>

<style>
  .patrol-effects-section {
    margin-bottom: 1rem;
  }

  .patrol-effects-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 0.75rem;
    min-height: 50px;
  }

  /* For guard mode (not preset manager), use single column layout */
  .patrol-effects-container.guard-mode {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .standard-button {
    background: #007bff;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    transition: background-color 0.2s ease;
  }

  .standard-button:hover {
    background: #0056b3;
  }

  .add-button {
    background: #28a745;
  }

  .add-button:hover {
    background: #218838;
  }

  .debug-button {
    background: #6c757d;
  }

  .debug-button:hover {
    background: #5a6268;
  }
</style>
