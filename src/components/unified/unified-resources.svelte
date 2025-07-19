<script lang="ts">
  import AddItemForm from '@/components/guard/add-item-form.svelte';
  import ItemCard from '@/components/guard/item-card.svelte';
  import {
    addResource,
    deleteResourcePreset,
    presetsStore,
    toggleResourceActive
  } from '@/stores/presets';
  import type { SyncManager } from '@/utils/sync';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { openResourceEditDialog } from '../../utils/dialog-manager';

  // Component props - siguiendo el patrón de unified-reputation
  export let groupId: string | undefined = undefined; // undefined for global resources
  export let title: string = 'Recursos';
  export let expandedResourceDetails: Record<string, boolean> = {};
  export let inPresetManager: boolean = false; // Show preset activation buttons when true

  const dispatch = createEventDispatcher();

  // Suscripción al store para reactividad completa
  let currentPresets = $presetsStore;
  let syncManager: SyncManager;

  // Variables reactivas basadas en el store actualizado - con ordenamiento personalizado
  $: activeResources = (groupId
    ? currentPresets.resources.filter(r => r.groupId === groupId && r.active)
    : currentPresets.resources.filter(r => !r.groupId && r.active))
    .sort((a, b) => (a.guardOrder ?? 999) - (b.guardOrder ?? 999));

  // Presets disponibles para el panel de selección (todos los presets) - ordenados por presetOrder
  $: availablePresets = (groupId
    ? currentPresets.resources.filter(r => r.groupId === groupId)
    : currentPresets.resources.filter(r => !r.groupId))
    .sort((a, b) => (a.presetOrder ?? 999) - (b.presetOrder ?? 999));

  // En preset manager, mostrar todos los presets; en guard, solo los activos
  $: displayResources = inPresetManager ? availablePresets : activeResources;

  // Local state - siguiendo el patrón de unified-reputation
  let addingResource = false;
  let newResource: any = {
    name: '',
    value: 0,
    img: 'icons/svg/item-bag.svg',
    description: ''
  };

  // Convertir a formato ItemCard
  $: resourceItems = displayResources.map(res => ({
    key: res.id,
    id: res.id, // Mantener también el id original para compatibilidad
    name: res.name,
    value: res.value,
    img: res.img || 'icons/svg/item-bag.svg',
    details: res.description || '', // ItemCard espera 'details', no 'description'
    active: res.active || false // Asegurar que active esté disponible para ItemCard
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
    if (data && data.resources) {
      currentPresets = data;
    }
  }

  function openAddResource() {
    // Use global dialog for adding new resource
    openResourceEditDialog({
      id: '',
      name: '',
      value: 0,
      description: '',
      img: '',
      sourceId: ''
    });
  }

  function cancelAddResource() {
    addingResource = false;
  }

  async function confirmAddResource() {
    // Crear preset en el store
    // En guard: active: true por defecto (elementos van directo al guard)
    // En preset manager: active: false por defecto (elementos van al preset pool)
    await addResource({
      name: newResource.name,
      value: newResource.value,
      img: newResource.img,
      description: newResource.description,
      groupId: groupId,
      sourceId: `resource-${Date.now()}`,
      active: !inPresetManager // En guard activo por defecto, en preset manager inactivo
    });
    addingResource = false;
    dispatch('updateResource');
  }

  async function removeResourceItem(index: number) {
    const resource = displayResources[index];
    if (resource && confirm('¿Eliminar este recurso?')) {
      if (inPresetManager) {
        // En preset manager, eliminar completamente
        await deleteResourcePreset(resource.id);
      } else {
        // En guard, solo desactivar
        await toggleResourceActive(resource.id);
      }
      dispatch('updateResource');
    }
  }

  function onNewResImageClick() {
    dispatch('newResImageClick', newResource);
  }

  function toggleResourceDetails(resKey: string) {
    expandedResourceDetails[resKey] = !expandedResourceDetails[resKey];
    expandedResourceDetails = { ...expandedResourceDetails };
  }

  function showResourceInChat(res: any) {
    dispatch('showResourceInChat', res);
  }

  function debugLogResources() {
    console.log('=== DEBUG: Lista de Recursos ===');
    console.log('Active Resources (guard content):', activeResources);
    console.log('Available Presets (all presets):', availablePresets);
    console.log('Display Resources (current context):', displayResources);
    console.log('Resource Items (ItemCard format):', resourceItems);
    console.log('Group ID:', groupId);
    console.log('In Preset Manager:', inPresetManager);
    console.log('================================');
  }

  function handleEditItem(event: CustomEvent) {
    const { item, type } = event.detail;
    if (type === 'resource') {
      if (inPresetManager) {
        // Use global dialog when in preset manager
        console.log('UnifiedResources - Opening global dialog for resource:', item);
        const resource = {
          id: item.sourceId || item.id,
          name: item.name,
          value: item.value,
          description: item.description || item.details,
          img: item.img,
          sourceId: item.sourceId || item.id
        };
        openResourceEditDialog(resource);
      } else {
        // Dispatch event to parent component for guard.svelte
        dispatch('editResource', { resource: item });
      }
    }
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
      await reorderResourcesInStore(draggedIndex, newIndex, inPresetManager);
      
      dispatch('reorderResources', { 
        dragIndex: draggedIndex, 
        dropIndex: newIndex,
        inPresetManager: inPresetManager 
      });
    }

    draggedIndex = null;
    dropZoneVisible = {};
  }

  async function reorderResourcesInStore(dragIndex: number, dropIndex: number, inPresetManager: boolean) {
    const orderProperty = inPresetManager ? 'presetOrder' : 'guardOrder';
    const currentResources = displayResources;
    
    if (dragIndex < 0 || dragIndex >= currentResources.length || 
        dropIndex < 0 || dropIndex >= currentResources.length) {
      return;
    }

    // Get the dragged item
    const draggedItem = currentResources[dragIndex];
    
    // Update the preset store with new order values
    const updatedResources = [...currentPresets.resources];
    
    // Reassign order values based on new positions
    currentResources.forEach((resource, index) => {
      const storeIndex = updatedResources.findIndex(r => r.id === resource.id);
      if (storeIndex !== -1) {
        if (index === dragIndex) {
          // Set dragged item order to drop position
          updatedResources[storeIndex] = {
            ...updatedResources[storeIndex],
            [orderProperty]: dropIndex
          };
        } else if (index < dragIndex && index >= dropIndex) {
          // Items shifting right (increase order)
          const currentOrder = updatedResources[storeIndex][orderProperty] ?? index;
          updatedResources[storeIndex] = {
            ...updatedResources[storeIndex],
            [orderProperty]: currentOrder + 1
          };
        } else if (index > dragIndex && index <= dropIndex) {
          // Items shifting left (decrease order)
          const currentOrder = updatedResources[storeIndex][orderProperty] ?? index;
          updatedResources[storeIndex] = {
            ...updatedResources[storeIndex],
            [orderProperty]: Math.max(0, currentOrder - 1)
          };
        }
      }
    });

    // Update the store
    presetsStore.set({
      ...currentPresets,
      resources: updatedResources
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

</script>

<div class="resources-section">
  <h3 style="display: flex; justify-content: space-between; align-items: center; font-family: 'Eveleth', 'Overpass', Arial, sans-serif; font-size: 1.5rem; color: #f9fafb; font-weight: bold;">
    {title}
    <div style="display: flex; gap: 0.5rem; align-items: center;">
      <button class="debug-button standard-button" on:click={debugLogResources} title="Debug: Mostrar lista en consola">
        🐛 Debug
      </button>
      <button class="add-button standard-button" on:click={openAddResource}>➕ Añadir</button>
    </div>
  </h3>

  {#if addingResource}
    <AddItemForm
      type="resource"
      item={newResource}
      visible={addingResource}
      on:imageClick={onNewResImageClick}
      on:confirm={confirmAddResource}
      on:cancel={cancelAddResource}
    />
  {/if}

  <div class="resource-container">
    {#each resourceItems as res, i}
      <ItemCard
        item={res}
        index={i}
        type="resource"
        expandedDetails={expandedResourceDetails}
        {draggedIndex}
        {dropZoneVisible}
        {inPresetManager}
        on:remove={(e) => removeResourceItem(e.detail)}
        on:showInChat={(e) => showResourceInChat(e.detail)}
        on:toggleDetails={(e) => toggleResourceDetails(e.detail)}
        on:dragStart={(e) => handleDragStart(e.detail.event, e.detail.index)}
        on:dragOver={(e) => handleDragOver(e.detail.event, e.detail.index)}
        on:dragLeave={(e) => handleDragLeave(e.detail.event, e.detail.index)}
        on:drop={(e) => handleDrop(e.detail.event, e.detail.index)}
        on:dragEnd={handleDragEnd}
        on:createPreset={(e) => dispatch('createPreset', e.detail)}
        on:editItem={handleEditItem}
      />
    {/each}
  </div>
</div>

<style>
  /* Resource Container - necesario para ItemCard */
  .resource-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-top: 0.5rem;
  }

  /* Responsive design for resource grid */
  @media (max-width: 1200px) {
    .resource-container {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 768px) {
    .resource-container {
      grid-template-columns: 1fr;
    }
  }
</style>
