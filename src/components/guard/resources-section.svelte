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

  // Drag and drop functionality
  let draggedIndex: number | null = null;
  let dropZoneVisible: Record<number, boolean> = {};
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
    console.log('👆 DRAG OVER - Resource target index:', index, 'dragged:', draggedIndex);
    if (event.dataTransfer && draggedIndex !== null && draggedIndex !== index) {
      event.dataTransfer.dropEffect = 'move';
      // Clear other drop zones first
      dropZoneVisible = {};
      dropZoneVisible[index] = true;
      dropZoneVisible = { ...dropZoneVisible };
      console.log('✨ DROP ZONE VISIBLE:', dropZoneVisible);
    }
  }

  function handleDragLeave(event: DragEvent, index: number) {
    console.log('👈 DRAG LEAVE - Resource index:', index);
    // Only hide if we're actually leaving the item, not just moving between child elements
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      dropZoneVisible[index] = false;
      dropZoneVisible = { ...dropZoneVisible };
      console.log('🚫 DROP ZONE HIDDEN:', dropZoneVisible);
    }
  }

  function handleDrop(event: DragEvent, dropIndex: number) {
    console.log('🎯 DROP EVENT - Resource from:', draggedIndex, 'to:', dropIndex);
    event.preventDefault();
    event.stopPropagation();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      console.log('✅ DISPATCHING REORDER - dragIndex:', draggedIndex, 'dropIndex:', dropIndex);
      // Dispatch with the correct parameters (dragIndex, dropIndex)
      dispatch('reorderResources', { dragIndex: draggedIndex, dropIndex });
    } else {
      console.log('❌ NO REORDER - same index or null draggedIndex');
    }
    draggedIndex = null;
    dropZoneVisible = {};
  }

  function handleDragEnd() {
    console.log('🏁 DRAG END - Resource');
    draggedIndex = null;
    dropZoneVisible = {};
  }
</script>

<div class="resources-section">
  <h3 style="display: flex; justify-content: space-between; align-items: center;">
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
      <button type="button" class="resource-image-button" on:click={onNewResImageClick}>
        <img src={newResource.img || 'icons/svg/item-bag.svg'} alt="resource" />
      </button>
      <input placeholder="Nombre del recurso" bind:value={newResource.name} />
      <input type="number" min="0" placeholder="Cantidad" bind:value={newResource.value} />
      <textarea placeholder="Descripción del recurso..." bind:value={newResource.details}></textarea>
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

        <!-- Drop zone overlay -->
        <div class="drop-zone" class:show={dropZoneVisible[i]}>
          Soltar aquí
        </div>
        {#if editingResources}
          <div class="resource-edit">
            <button type="button" class="image-button resource-edit-image-button" on:click={() => onResImageClick(res)}>
              <img class="resource-image-edit" src={res.img || 'icons/svg/item-bag.svg'} alt="resource" />
            </button>
            <input id={`res-file-${res.key}`} type="file" accept="image/*" style="display:none" on:change={(e)=>onResFileChange(res,e)} />
            <input placeholder="Nombre" bind:value={res.name} on:change={updateResource} />
            <textarea placeholder="Descripción del recurso..." bind:value={res.details} on:change={updateResource}></textarea>
            <div class="res-actions">
              <input type="number" min="0" bind:value={res.value} on:change={updateResource} />
              <button on:click={() => removeResource(i)}>✕</button>
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
            </div>
            {#if res.details && res.details.trim()}
              <button class="resource-details-toggle" on:click|stopPropagation={() => toggleResourceDetails(res.key)}>
                📝
              </button>
            {/if}
            {#if res.details && res.details.trim() && expandedResourceDetails[res.key]}
              <div class="resource-details">
                <p>{res.details}</p>
              </div>
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
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    border: 1px solid #d4af37;
    border-radius: 8px;
    background: transparent;
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
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(59, 130, 246, 0.2);
    border: 2px dashed #3b82f6;
    border-radius: 8px;
    z-index: 10;
    display: none;
    align-items: center;
    justify-content: center;
    color: #3b82f6;
    font-weight: bold;
    font-size: 14px;
    pointer-events: none;
  }

  .resource-item:not(.dragging) .drop-zone.show {
    display: flex;
    pointer-events: all;
  }

  .resource-image {
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
    font-weight: bold;
    font-size: 1em;
    color: #f9fafb;
    text-align: center;
    line-height: 1.2;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
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
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid #374151;
    border-radius: 6px;
    font-size: 0.85em;
    line-height: 1.4;
    color: #d1d5db;
    width: calc(100% - 1.5rem);
  }

  .resource-details p {
    margin: 0;
  }

  /* Edit Mode Styles */
  .resource-edit {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    border: 1px solid #6b7280;
    border-radius: 8px;
    background: transparent;
  }

  .resource-edit-image-button {
    align-self: center;
    width: 100%;
    height: 56px;
  }

  .resource-image-edit {
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
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid #6b7280;
    border-radius: 8px;
    background: rgba(31, 41, 55, 0.8);
    margin-bottom: 1rem;
  }

  .add-resource-form .resource-image-button {
    align-self: center;
  }

  .add-resource-form .resource-image-button img {
    width: 56px;
    height: 56px;
    border: 2px solid #6b7280;
    transition: border-color 0.2s ease;
  }

  .add-resource-form .resource-image-button:hover img {
    border-color: #9ca3af;
  }

  .add-resource-form input,
  .add-resource-form textarea {
    padding: 0.5rem;
    border: 1px solid #6b7280;
    border-radius: 4px;
    background: rgba(17, 24, 39, 0.8);
    color: #f9fafb;
  }

  .add-resource-form input:focus,
  .add-resource-form textarea:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .add-resource-form textarea {
    min-height: 80px;
    resize: vertical;
  }

  .add-resource-form button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .add-resource-form button:first-of-type {
    background: #059669;
    color: white;
  }

  .add-resource-form button:first-of-type:hover {
    background: #047857;
  }

  .add-resource-form button:last-of-type {
    background: #6b7280;
    color: white;
  }

  .add-resource-form button:last-of-type:hover {
    background: #4b5563;
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
