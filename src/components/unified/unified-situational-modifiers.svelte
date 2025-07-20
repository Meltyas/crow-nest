<script lang="ts">
  import AddItemForm from '@/components/guard/add-item-form.svelte';
  import SituationalModifierCard from '@/components/guard/situational-modifier-card.svelte';
  import {
    addSituationalModifier,
    deleteSituationalModifierPreset,
    presetsStore,
    toggleSituationalModifierActive
  } from '@/stores/presets';
  import { SyncManager } from '@/utils/sync';
  import { Subject } from 'rxjs';
  import { debounceTime, distinctUntilChanged, takeUntil, tap } from 'rxjs/operators';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { openSituationalModifierEditDialog } from '../../utils/dialog-manager';

  // Component props - siguiendo el patrón de unified-resources
  export let groupId: string | undefined = undefined; // undefined for global situational modifiers
  export let title: string = 'Modificadores Situacionales';
  export let expandedSituationalModifierDetails: Record<string, boolean> = {};
  export let inPresetManager: boolean = false; // Show preset activation buttons when true
  export let displayMode: string = 'guard'; // 'groups' for simple view, 'guard' for full view

  const dispatch = createEventDispatcher();

  // RxJS cleanup and component management
  const destroy$ = new Subject<void>();
  const componentId = `unified-situational-modifiers-${groupId || 'global'}-${Math.random().toString(36).substr(2, 9)}`;

  // SyncManager for bidirectional synchronization
  let syncManager: SyncManager;

  // Local state - siguiendo el patrón de resources-section.svelte
  let addingSituationalModifier = false;
  let newSituationalModifier: any = {
    key: '',
    name: '',
    statEffects: {},
    img: 'icons/svg/upgrade.svg',
    details: ''
  };

  // Variables reactivas basadas en el store actualizado - con ordenamiento personalizado
  $: activeSituationalModifiers = (groupId
    ? $presetsStore.situationalModifiers.filter(m => m.groupId === groupId && m.active)
    : $presetsStore.situationalModifiers.filter(m => !m.groupId && m.active))
    .sort((a, b) => (a.presetOrder ?? 999) - (b.presetOrder ?? 999));

  // Para presets: todos los disponibles para seleccionar - ordenados por presetOrder
  $: availablePresets = (groupId
    ? $presetsStore.situationalModifiers.filter(m => m.groupId === groupId)
    : $presetsStore.situationalModifiers.filter(m => !m.groupId))
    .sort((a, b) => (a.presetOrder ?? 999) - (b.presetOrder ?? 999));

  // En preset manager, mostrar todos los presets; en guard, solo los activos
  $: displaySituationalModifiers = inPresetManager ? availablePresets : activeSituationalModifiers;

  // Drag and drop state
  let draggedIndex: number | null = null;
  let dropZoneVisible: Record<string, 'left' | 'right' | null> = {};

  // Sincronización y lifecycle con RxJS
  onMount(() => {
    console.log('UnifiedSituationalModifiers - Setting up RxJS subscriptions for componentId:', componentId, 'groupId:', groupId);

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
      tap(presets => console.log('UnifiedSituationalModifiers - Store updated for groupId:', groupId, !!presets)),
      takeUntil(destroy$)
    ).subscribe(storePresets => {
      // Store updates are now handled automatically by Svelte's reactivity
      // No need to manually update currentPresets
    });

    // Secondary stream: Remote sync updates (for bidirectional sync)
    syncManager.subscribeToDataType('presets', componentId, (syncPresets) => {
      console.log('UnifiedSituationalModifiers - Sync update for groupId:', groupId, !!syncPresets);
      if (syncPresets && syncPresets !== $presetsStore) {
        console.log('UnifiedSituationalModifiers - Applying sync presets for groupId:', groupId);
        presetsStore.set(syncPresets);
      }
    });

    // Cleanup function for the Svelte store subscription
    return () => {
      presetsStoreUnsubscribe();
    };
  });

  onDestroy(() => {
    // RxJS CLEANUP - Single cleanup call replaces manual unsubscribe
    console.log('UnifiedSituationalModifiers - Cleaning up RxJS subscriptions for componentId:', componentId);

    destroy$.next();
    destroy$.complete();

    if (syncManager) {
      syncManager.cleanupComponent(componentId);
    }
  });

  function openAddSituationalModifier() {
    // Use global dialog for adding new situational modifier
    openSituationalModifierEditDialog({
      id: '',
      name: '',
      description: '',
      statEffects: {},
      img: '',
      sourceId: ''
    }, inPresetManager); // Pass the current context
  }

  function cancelAddSituationalModifier() {
    addingSituationalModifier = false;
  }

  async function confirmAddSituationalModifier() {
    // Crear nuevo preset en el store
    // En guard: active: true por defecto (elementos van directo al guard)
    // En preset manager: active: false por defecto (elementos van al preset pool)
    await addSituationalModifier({
      name: newSituationalModifier.name,
      statEffects: newSituationalModifier.statEffects,
      img: newSituationalModifier.img,
      description: newSituationalModifier.description,
      groupId: groupId,
      sourceId: `situational-modifier-${Date.now()}`,
      active: !inPresetManager // En guard activo por defecto, en preset manager inactivo
    });
    addingSituationalModifier = false;
    dispatch('updateSituationalModifier');
  }

  async function removeSituationalModifierItem(index: number) {
    const situationalModifier = displaySituationalModifiers[index];
    if (situationalModifier && confirm('¿Eliminar este modificador situacional?')) {
      if (inPresetManager) {
        // En preset manager, eliminar completamente
        await deleteSituationalModifierPreset(situationalModifier.id);
      } else {
        // En guard, solo desactivar
        await toggleSituationalModifierActive(situationalModifier.id);
      }
      dispatch('updateSituationalModifier');
    }
  }

  function onNewSituationalModifierImageClick() {
    dispatch('newSituationalModifierImageClick', newSituationalModifier);
  }

  function toggleSituationalModifierDetails(modifierKey: string) {
    expandedSituationalModifierDetails[modifierKey] = !expandedSituationalModifierDetails[modifierKey];
    expandedSituationalModifierDetails = { ...expandedSituationalModifierDetails };
  }

  function showSituationalModifierInChat(modifier: any) {
    dispatch('showSituationalModifierInChat', modifier);
  }

  function debugLogSituationalModifiers() {
    console.log('UnifiedSituationalModifiers Debug:', {
      groupId,
      inPresetManager,
      activeCount: activeSituationalModifiers.length,
      presetCount: availablePresets.length,
      displayCount: displaySituationalModifiers.length
    });
  }

  // New handler function for SituationalModifierCard edit events
  function handleEditSituationalModifier(situationalModifier: any) {
    if (inPresetManager) {
      // Use global dialog when in preset manager
      openSituationalModifierEditDialog(situationalModifier, true); // Pass true for preset manager
    } else {
      // Dispatch event to parent component for guard.svelte
      dispatch('editSituationalModifier', situationalModifier);
    }
  }

  // Handler for SituationalModifierCard use events
  function handleUseSituationalModifier(situationalModifier: any) {
    if (inPresetManager) {
      // Emit a window event that groups.svelte can listen to
      const event = new CustomEvent('crow-nest-apply-situational-modifier', {
        detail: { situationalModifier }
      });
      window.dispatchEvent(event);
    }
    // If not in preset manager, this button shouldn't be shown, but if it is, do nothing
  }

  function handleEditItem(event: CustomEvent) {
    const { item, type } = event.detail;
    if (type === 'situational-modifier') {
      if (inPresetManager) {
        // Use global dialog when in preset manager
        const situationalModifier = {
          id: item.sourceId || item.id,
          name: item.name,
          description: item.description || item.details,
          statEffects: item.statEffects,
          img: item.img,
          sourceId: item.sourceId || item.id
        };
        openSituationalModifierEditDialog(situationalModifier, true); // Pass true for preset manager
      } else {
        // Dispatch event to parent component for guard.svelte
        dispatch('editSituationalModifier', item);
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

    // Reorder the situational modifiers
    await reorderSituationalModifiers(dropData.draggedIndex, dropData.targetIndex);
    draggedIndex = null;
  }

  function handleDragEnd() {
    draggedIndex = null;
    dropZoneVisible = {};
  }

  // Preset management functions
  function createSituationalModifierPreset(situationalModifier: any) {
    dispatch('createPreset', situationalModifier);
  }

  async function toggleSituationalModifierActiveState(data: { id: string, active: boolean }) {
    console.log('UnifiedSituationalModifiers - toggleSituationalModifierActiveState called with:', data);
    console.log('UnifiedSituationalModifiers - Current context:', { inPresetManager, groupId, displayCount: displaySituationalModifiers.length });
    
    // Show current state before toggle
    const currentModifier = displaySituationalModifiers.find(m => m.id === data.id);
    console.log('UnifiedSituationalModifiers - Modifier found in display list:', currentModifier ? { id: currentModifier.id, name: currentModifier.name, active: currentModifier.active } : 'NOT FOUND');
    
    await toggleSituationalModifierActive(data.id);
    
    console.log('UnifiedSituationalModifiers - After toggle - displayCount:', displaySituationalModifiers.length);
    console.log('UnifiedSituationalModifiers - After toggle - activeCount:', activeSituationalModifiers.length);
    console.log('UnifiedSituationalModifiers - After toggle - availableCount:', availablePresets.length);
    
    // Show all modifiers and their states after toggle
    const filteredModifiers = $presetsStore.situationalModifiers
      .filter(m => groupId ? m.groupId === groupId : !m.groupId)
      .map(m => ({ id: m.id, name: m.name, active: m.active }));
    
    console.log('UnifiedSituationalModifiers - All modifiers after toggle:', filteredModifiers);
    console.log('UnifiedSituationalModifiers - Summary: Active =', filteredModifiers.filter(m => m.active).map(m => m.name), 
                'Inactive =', filteredModifiers.filter(m => !m.active).map(m => m.name));
    
    dispatch('updateSituationalModifier'); // Notify parent component if needed
  }

  function removeSituationalModifierPreset(id: string) {
    dispatch('removePreset', id);
  }

  async function reorderSituationalModifiers(dragIndex: number, dropIndex: number) {
    // Create a copy of the current situational modifiers to modify
    const updatedSituationalModifiers = [...$presetsStore.situationalModifiers];

    // Get the items being reordered - only using presetOrder since guardOrder was removed
    const draggedItem = displaySituationalModifiers[dragIndex];
    const orderProperty = 'presetOrder';

    // Find the indices in the main array
    displaySituationalModifiers.forEach((item, index) => {
      const storeIndex = updatedSituationalModifiers.findIndex(m => m.id === item.id);
      if (storeIndex === -1) return;

      if (index === dragIndex) {
        // Set the dragged item to the drop position
        updatedSituationalModifiers[storeIndex] = {
          ...updatedSituationalModifiers[storeIndex],
          [orderProperty]: dropIndex
        };
      } else if (dragIndex < dropIndex && index > dragIndex && index <= dropIndex) {
        // Items shifting left (decrease order)
        const currentOrder = updatedSituationalModifiers[storeIndex][orderProperty] ?? index;
        updatedSituationalModifiers[storeIndex] = {
          ...updatedSituationalModifiers[storeIndex],
          [orderProperty]: Math.max(0, currentOrder - 1)
        };
      } else if (dragIndex > dropIndex && index < dragIndex && index >= dropIndex) {
        // Items shifting right (increase order)
        const currentOrder = updatedSituationalModifiers[storeIndex][orderProperty] ?? index;
        updatedSituationalModifiers[storeIndex] = {
          ...updatedSituationalModifiers[storeIndex],
          [orderProperty]: currentOrder + 1
        };
      }
    });

    // Update the store
    presetsStore.set({
      ...$presetsStore,
      situationalModifiers: updatedSituationalModifiers
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

<div class="situational-modifiers-section">
  <h3 style="display: flex; justify-content: space-between; align-items: center; font-family: 'Eveleth', 'Overpass', Arial, sans-serif; font-size: 1.5rem; color: #f9fafb; font-weight: bold;">
    {title}
    <div style="display: flex; gap: 0.5rem; align-items: center;">
      <button class="debug-button standard-button" on:click={debugLogSituationalModifiers} title="Debug: Mostrar lista en consola">
        🐛 Debug
      </button>
      <button class="add-button standard-button" on:click={openAddSituationalModifier}>➕ Añadir</button>
    </div>
  </h3>

  {#if addingSituationalModifier}
    <AddItemForm
      type="situational-modifier"
      item={newSituationalModifier}
      visible={addingSituationalModifier}
      on:imageClick={onNewSituationalModifierImageClick}
      on:confirm={confirmAddSituationalModifier}
      on:cancel={cancelAddSituationalModifier}
    />
  {/if}

  <div class="situational-modifiers-container {inPresetManager ? '' : 'guard-mode'}">
    {#each displaySituationalModifiers as modifier, i}
      <SituationalModifierCard
        situationalModifier={modifier}
        index={i}
        expandedDetails={expandedSituationalModifierDetails}
        {draggedIndex}
        {dropZoneVisible}
        {inPresetManager}
        simpleView={!inPresetManager && displayMode === 'groups'}
        on:remove={(e) => removeSituationalModifierItem(e.detail)}
        on:edit={(e) => handleEditSituationalModifier(e.detail)}
        on:use={(e) => handleUseSituationalModifier(e.detail)}
        on:dragStart={(e) => handleDragStart(e.detail)}
        on:dragEnter={(e) => handleDragEnter(e.detail)}
        on:dragLeave={(e) => handleDragLeave(e.detail)}
        on:drop={(e) => handleDrop(e.detail)}
        on:dragEnd={handleDragEnd}
        on:createPreset={(e) => createSituationalModifierPreset(e.detail)}
        on:activatePreset={(e) => toggleSituationalModifierActiveState(e.detail)}
        on:removePreset={(e) => removeSituationalModifierPreset(e.detail)}
      />
    {/each}
  </div>
</div>

<style>
  .situational-modifiers-section {
    margin-bottom: 1rem;
  }

  .situational-modifiers-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 0.75rem;
    min-height: 50px;
  }

  /* For guard mode (not preset manager), use single column layout */
  .situational-modifiers-container.guard-mode {
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
