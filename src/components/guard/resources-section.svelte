<script lang="ts">
  import type { GuardResource } from '@/guard/stats';
  import { createEventDispatcher } from 'svelte';
  import ItemCard from './item-card.svelte';

  export let resources: GuardResource[] = [];
  export let editingResources = false;
  export let expandedResourceDetails: Record<string, boolean> = {};

  const dispatch = createEventDispatcher();

  let addingResource = false;
  let editingQuantity: Record<string, boolean> = {};
  let newResource: GuardResource = {
    key: '',
    name: '',
    value: 0,
    img: 'icons/svg/item-bag.svg',
    details: ''
  };

  function toggleEditingResources() {
    dispatch('toggleEditingResources');
  }

  function openAddResource() {
    newResource = {
      key: crypto.randomUUID(),
      name: '',
      value: 0,
      img: 'icons/svg/item-bag.svg',
      details: ''
    };
    addingResource = true;
  }

  function cancelAddResource() {
    addingResource = false;
  }

  function confirmAddResource() {
    dispatch('addResource', { ...newResource });
    addingResource = false;
  }

  function removeResource(index: number) {
    dispatch('removeResource', index);
  }

  function updateResource() {
    dispatch('updateResource');
  }

  function onResImageClick(res: GuardResource) {
    dispatch('resImageClick', res);
  }

  function onNewResImageClick() {
    dispatch('newResImageClick', newResource);
  }

  function onResFileChange(res: GuardResource, event: Event) {
    dispatch('resFileChange', { res, event });
  }

  function toggleResourceDetails(resKey: string) {
    expandedResourceDetails[resKey] = !expandedResourceDetails[resKey];
    expandedResourceDetails = { ...expandedResourceDetails };
  }

  function toggleQuantityEdit(resKey: string) {
    editingQuantity[resKey] = !editingQuantity[resKey];
    editingQuantity = { ...editingQuantity };
  }

  function finishQuantityEdit(resKey: string) {
    editingQuantity[resKey] = false;
    editingQuantity = { ...editingQuantity };
    updateResource();
  }

  function showResourceInChat(res: GuardResource) {
    dispatch('showResourceInChat', res);
  }

  // Drag and drop functionality - Drop zones within items
  let draggedIndex: number | null = null;
  let dropZoneVisible: Record<string, 'left' | 'right' | null> = {};

  function handleDragStart(event: DragEvent, index: number) {
    console.log('🚀 DRAG START - Resource index:', index);
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

      console.log('👆 DRAG OVER - Resource index:', index, 'side:', side, 'dragged:', draggedIndex);

      // Clear other drop zones first
      dropZoneVisible = {};
      dropZoneVisible[index] = side;
      dropZoneVisible = { ...dropZoneVisible };

      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      console.log('✨ DROP ZONE VISIBLE:', dropZoneVisible);
    }
  }

  function handleDragLeave(event: DragEvent, index: number) {
    console.log('👈 DRAG LEAVE - Resource index:', index);
    // Only hide if we're actually leaving the item
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      dropZoneVisible[index] = null;
      dropZoneVisible = { ...dropZoneVisible };
      console.log('🚫 DROP ZONE HIDDEN:', dropZoneVisible);
    }
  }

  function handleDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      const side = dropZoneVisible[dropIndex];
      let newIndex: number;

      if (side === 'left') {
        // Insert before this item
        newIndex = dropIndex;
      } else {
        // Insert after this item
        newIndex = dropIndex + 1;
      }

      // Adjust for removal if dragging to a position after current
      if (draggedIndex < newIndex) {
        newIndex = newIndex - 1;
      }

      console.log('🎯 DROP EVENT - from:', draggedIndex, 'to:', side, 'of index:', dropIndex, 'final newIndex:', newIndex);
      console.log('✅ DISPATCHING REORDER - dragIndex:', draggedIndex, 'newIndex:', newIndex);
      dispatch('reorderResources', { dragIndex: draggedIndex, dropIndex: newIndex });
    } else {
      console.log('❌ NO REORDER - same index or null draggedIndex');
    }

    draggedIndex = null;
    dropZoneVisible = {};
  }

  function handleDragEnd() {
    console.log('🏁 DRAG END - Resources');
    draggedIndex = null;
    dropZoneVisible = {};
  }
</script>

<div class="resources-section">
  <h3 style="display: flex; justify-content: space-between; align-items: center; font-family: 'Eveleth', 'Overpass', Arial, sans-serif; font-size: 1.5rem; color: #f9fafb; font-weight: bold;">
    Recursos
    <div style="display: flex; gap: 0.5rem; align-items: center;">
      <button class="edit-button standard-button" on:click={toggleEditingResources}>
        ✏️ {editingResources ? 'Finalizar' : 'Editar'}
      </button>
      <button class="add-button standard-button" on:click={openAddResource}>➕ Añadir</button>
    </div>
  </h3>

  {#if addingResource}
    <div class="add-resource-form">
      <button type="button" class="resource-edit-image-button" on:click={onNewResImageClick}>
        <img class="resource-image" src={newResource.img || 'icons/svg/item-bag.svg'} alt="resource" />
      </button>
      <input class="resource-input resource-name" placeholder="Nombre del recurso" bind:value={newResource.name} />
      <input class="resource-input number"type="number" min="0" placeholder="Cantidad" bind:value={newResource.value} />
      <textarea class="resource-textarea" placeholder="Descripción del recurso..." bind:value={newResource.details}></textarea>
      <button class="standard-button" on:click={confirmAddResource}>Agregar</button>
      <button class="standard-button" on:click={cancelAddResource}>Cancelar</button>
    </div>
  {/if}

  <div class="resource-container">
    {#each resources as res, i}
      <ItemCard
        item={res}
        index={i}
        type="resource"
        editing={editingResources}
        expandedDetails={expandedResourceDetails}
        {editingQuantity}
        {draggedIndex}
        {dropZoneVisible}
        on:imageClick={(e) => onResImageClick(e.detail)}
        on:fileChange={(e) => onResFileChange(e.detail.item, e.detail.event)}
        on:update={updateResource}
        on:remove={(e) => removeResource(e.detail)}
        on:showInChat={(e) => showResourceInChat(e.detail)}
        on:toggleDetails={(e) => toggleResourceDetails(e.detail)}
        on:toggleQuantityEdit={(e) => toggleQuantityEdit(e.detail)}
        on:finishQuantityEdit={(e) => finishQuantityEdit(e.detail)}
        on:dragStart={(e) => handleDragStart(e.detail.event, e.detail.index)}
        on:dragOver={(e) => handleDragOver(e.detail.event, e.detail.index)}
        on:dragLeave={(e) => handleDragLeave(e.detail.event, e.detail.index)}
        on:drop={(e) => handleDrop(e.detail.event, e.detail.index)}
        on:dragEnd={handleDragEnd}
      />
    {/each}
  </div>
</div>

<style>
  /* Resource Styles */
  .resource-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .resource-input {
    background: transparent;
    border: solid 1px #000000;
    color: #000000;
  }

  .resource-input.number {
    width: 48px;
  }

  .resource-textarea {
    background: transparent;
    border: solid 1px #000000;
    margin-bottom: 0.5rem;
    font-family: "Overpass", sans-serif;
    font-size: 14px;
    line-height: 1.4;
    color: #000000;
    width: 100%;
  }

  .resource-edit-image-button {
    align-self: center;
    padding: 0;
    width: 100%;
    height: 56px;
  }

  /* Add Resource Form */
  .add-resource-form {
    display: flex;
    font-family: "Overpass", sans-serif;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid #6b7280;
    border-radius: 8px;
    background: #ffffff;
    margin-bottom: 1rem;
    max-width: 31.7%;
  }

  .resource-image {
    background:#000000;
    width: 100%;
    height: 56px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid #d4af37;
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
