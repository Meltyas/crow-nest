<script lang="ts">
  import type { GuardResource } from '@/guard/stats';
  import { createEventDispatcher } from 'svelte';

  export let resources: GuardResource[] = [];
  export let editingResources = false;
  export let expandedResourceDetails: Record<string, boolean> = {};

  const dispatch = createEventDispatcher();

  let addingResource = false;
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
      <button class="edit-button small-button" on:click={toggleEditingResources}>
        ✏️ {editingResources ? 'Finalizar' : 'Editar'}
      </button>
      <button class="add-button small-button" on:click={openAddResource}>➕ Añadir</button>
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
      <button on:click={confirmAddResource}>Agregar</button>
      <button on:click={cancelAddResource}>Cancelar</button>
    </div>
  {/if}

  <div class="resource-container">
    {#each resources as res, i}
      <div class="resource-item"
           role="listitem"
           draggable="true"
           on:dragstart={(e) => handleDragStart(e, i)}
           on:dragover={(e) => handleDragOver(e, i)}
           on:dragleave={(e) => handleDragLeave(e, i)}
           on:drop={(e) => handleDrop(e, i)}
           on:dragend={handleDragEnd}
           class:dragging={draggedIndex === i}>

        <!-- Drop zones overlays -->
        <div class="drop-zone drop-zone-left" class:show={dropZoneVisible[i] === 'left'}>
          ⬅️ Insertar antes
        </div>
        <div class="drop-zone drop-zone-right" class:show={dropZoneVisible[i] === 'right'}>
          Insertar después ➡️
        </div>

        {#if editingResources}
          <div class="resource-edit">
            <button type="button" class="image-button resource-edit-image-button" on:click={() => onResImageClick(res)}>
              <img class="resource-image-edit" src={res.img || 'icons/svg/item-bag.svg'} alt="resource" />
            </button>
                        <div class="resource-edit-text-container">
            <input id={`res-file-${res.key}`} type="file" accept="image/*" style="display:none" on:change={(e)=>onResFileChange(res,e)} />
            <input class="resource-input resource-name" placeholder="Nombre" bind:value={res.name} on:change={updateResource} />
            <textarea class="resource-textarea" placeholder="Descripción del recurso..." bind:value={res.details} on:change={updateResource}></textarea>
            <div class="res-actions">
              <input class="resource-input number" type="number" min="0" bind:value={res.value} on:change={updateResource} />
              <button on:click={() => removeResource(i)}>✕</button>
              </div>

            </div>
          </div>
        {:else}
          <div class="resource-display" role="button" tabindex="0"
               on:click={() => showResourceInChat(res)}
               on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showResourceInChat(res); } }}>
            <div class="drag-handle">🖱️</div>
            <img class="resource-image" src={res.img || 'icons/svg/item-bag.svg'} alt="resource" />
            <div class="resource-info">
              <div class="resource-header">
                <span class="resource-name">{res.name}</span>
                <span class="resource-quantity">{res.value}</span>
              </div>
              {#if res.details && res.details.trim()}
                <div class="resource-details" class:expanded={expandedResourceDetails[res.key]}>
                  <p>{res.details}</p>
                </div>
              {/if}
            </div>
            {#if res.details && res.details.trim()}
              <button class="resource-details-toggle" on:click|stopPropagation={() => toggleResourceDetails(res.key)}>
                📝
              </button>
            {/if}
          </div>
        {/if}
      </div>
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

  .resource-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
    transition: opacity 0.2s ease;
    position: relative;
  }

  .resource-item.dragging {
    opacity: 0.7;
  }

  .resource-display {
    background: #ffffff;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    border: 1px solid #d4af37;
    border-radius: 8px;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
    position: relative;
  }

  .resource-display:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .resource-display:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .drag-handle {
    position: absolute;
    top: 8px;
    left: 8px;
    width: 24px;
    height: 24px;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid #6b7280;
    border-radius: 50%;
    color: #f9fafb;
    font-size: 12px;
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    transition: all 0.2s ease;
  }

  .drag-handle:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: scale(1.1);
  }

  .resource-item.dragging .drag-handle {
    cursor: grabbing;
  }

  .drop-zone {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
    background: rgba(59, 130, 246, 0.3);
    border: 2px dashed #3b82f6;
    border-radius: 8px;
    z-index: 10;
    display: none;
    align-items: center;
    justify-content: center;
    color: #3b82f6;
    font-weight: bold;
    font-size: 12px;
    pointer-events: none;
    backdrop-filter: blur(2px);
  }

  .drop-zone-left {
    left: 0;
    background: rgba(255, 165, 0, 0.3);
    border-color: #ffa500;
    color: #ffa500;
  }

  .drop-zone-right {
    right: 0;
    background: rgba(34, 197, 94, 0.3);
    border-color: #22c55e;
    color: #22c55e;
  }

  .resource-item:not(.dragging) .drop-zone.show {
    display: flex;
    pointer-events: all;
  }

  .resource-image {
    background: #000000;
    width: 100%;
    height: 56px;
    object-fit: cover;
    border-radius: 8px 8px 0 0;
    flex-shrink: 0;
    border-bottom: 2px solid #d4af37;
  }

  .resource-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    align-items: center;
    padding: 0.75rem;
  }

  .resource-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 0.5rem;
  }

 .resource-name {
    font-family: "Eveleth";
    font-size: 1rem;
    color: #000000;
    line-height: 1.4;
  }


  .resource-quantity {
    background: #374151;
    color: #d1d5db;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: bold;
    font-size: 0.8rem;
    border: 1px solid #6b7280;
    min-width: 2rem;
    text-align: center;
    font-family: 'Overpass', Arial, sans-serif;
  }

  .resource-details-toggle {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid #6b7280;
    border-radius: 50%;
    color: #f9fafb;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    transition: all 0.2s ease;
  }

  .resource-details-toggle:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: scale(1.1);
  }

  .resource-details {
    margin-bottom: 0.5rem;
    font-family: "Overpass", sans-serif;
    font-size: 14px;
    line-height: 1.4;
    color: #000000;
    width: 100%;
    transition: all 0.3s ease;
    position: relative;
  }

  .resource-details:not(.expanded) {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .resource-details.expanded {
    display: block;
  }

  .resource-details p {
    margin: 0;
    min-height: 60px;
  }

  /* Edit Mode Styles */
  .resource-edit {
    background: white;

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    border: 1px solid #6b7280;
    border-radius: 8px;
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
    width: 100%;
    height: 56px;
  }

  .resource-image-edit {
    background: #000000;
    height: 56px;
    object-fit: cover;
    width: 100%;
  }

  .res-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
    justify-content: center;
    margin-bottom: 0.5rem;
  }

  .resource-edit input[type="number"] {
    width: 80px;
  }

  .res-actions button {
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    transition: background 0.2s ease;
    font-family: 'Overpass', Arial, sans-serif;
    font-weight: bold;
  }

  .res-actions button:hover {
    background: #b91c1c;
  }

  .resource-image-button {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.2s ease;
  }

  .resource-image-button:hover {
    transform: scale(1.05);
  }

  .resource-image-button img {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 8px;
    border: 2px solid #6b7280;
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

  .add-resource-form .resource-image-button:hover img {
    border-color: #9ca3af;
  }

  .resource-edit-text-container {
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    gap: 0.5rem;
    width: 100%;
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
