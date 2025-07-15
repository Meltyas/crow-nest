<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  // ChatMessage is provided by Foundry at runtime
  declare const ChatMessage: any;

  export let item: any; // GuardReputation | GuardResource
  export let index: number;
  export let type: 'reputation' | 'resource'; // Para determinar el comportamiento específico
  export let editing = false;
  export let expandedDetails: Record<string, boolean> = {};
  export let editingQuantity: Record<string, boolean> = {};
  export let draggedIndex: number | null = null;
  export let dropZoneVisible: Record<string, 'left' | 'right' | null> = {};

  const dispatch = createEventDispatcher();

  // Configuración específica por tipo
  $: config = {
    reputation: {
      imageDefault: 'icons/svg/aura.svg',
      detailsProperty: 'details',
      valueProperty: 'value',
      nameProperty: 'name',
      showQuantity: false,
      showBar: true,
      barMax: 10,
      valueLabel: 'Reputación (0-10)',
      placeholder: 'Detalles sobre tu relación con esta facción...',
      nameLabel: 'Nombre de la facción'
    },
    resource: {
      imageDefault: 'icons/svg/item-bag.svg',
      detailsProperty: 'details',
      valueProperty: 'value',
      nameProperty: 'name',
      showQuantity: true,
      showBar: false,
      barMax: null,
      valueLabel: 'Cantidad',
      placeholder: 'Descripción del recurso...',
      nameLabel: 'Nombre del recurso'
    }
  }[type];

  // Eventos
  function handleImageClick() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.click();
    fileInput.addEventListener('change', (event: Event) => {
      dispatch('fileChange', { item, event });
    });
    dispatch('imageClick', item);
  }

  function handleUpdate() {
    dispatch('update', item);
  }

  function handleRemove() {
    dispatch('remove', index);
  }

  function handleShowInChat() {
    dispatch('showInChat', index);
  }

  function handleToggleDetails() {
    dispatch('toggleDetails', index);
  }

  function handleToggleQuantityEdit() {
    dispatch('toggleQuantityEdit', index);
  }

  function handleFinishQuantityEdit() {
    dispatch('finishQuantityEdit', index);
  }

  // Drag and Drop
  function handleDragStart(event: DragEvent) {
    dispatch('dragStart', { event, index });
  }

  function handleDragOver(event: DragEvent) {
    dispatch('dragOver', { event, index });
  }

  function handleDragLeave(event: DragEvent) {
    dispatch('dragLeave', { event, index });
  }

  function handleDrop(event: DragEvent) {
    dispatch('drop', { event, index });
  }

  function handleDragEnd() {
    dispatch('dragEnd');
  }
</script>

<div class="item item-card {type === 'reputation' ? 'reputation-type' : ''}"
     role="listitem"
     draggable="true"
     on:dragstart={handleDragStart}
     on:dragover={handleDragOver}
     on:dragleave={handleDragLeave}
     on:drop={handleDrop}
     on:dragend={handleDragEnd}
     class:dragging={draggedIndex === index}>

  <!-- Drop zones overlays -->
  <div class="drop-zone drop-zone-left" class:show={dropZoneVisible[index] === 'left'}>
    ← Insertar aquí
  </div>
  <div class="drop-zone drop-zone-right" class:show={dropZoneVisible[index] === 'right'}>
    Insertar aquí →
  </div>

  {#if editing}
    <div class="item-edit">
      <button type="button" class="image-button item-edit-image-button" on:click={handleImageClick}>
        <img class="item-image-edit" src={item.img || config.imageDefault} alt={type} />
      </button>
      <div class="item-edit-text-container">
        <!-- Nombre del item -->
        <input class="item-input item-name" placeholder={config.nameLabel} bind:value={item[config.nameProperty]} on:change={handleUpdate} />
        <textarea class="item-textarea" placeholder={config.placeholder} bind:value={item[config.detailsProperty]} on:change={handleUpdate}></textarea>
        <div class="item-actions">
          {#if config.showBar}
            <input class="item-input number {type === 'reputation' ? 'reputation-type' : ''}" type="number" min="0" max={config.barMax} bind:value={item[config.valueProperty]} on:change={handleUpdate} />
          {:else}
            <input class="item-input number {type === 'reputation' ? 'reputation-type' : ''}" type="number" min="0" bind:value={item[config.valueProperty]} on:change={handleUpdate} />
          {/if}
          <button class="remove-button" on:click={handleRemove}>✕</button>
        </div>
      </div>
    </div>
  {:else}
    <div class="item-display {type === 'reputation' ? 'reputation-type' : ''}" role="button" tabindex="0"
         on:click={handleShowInChat}
         on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleShowInChat(); } }}>
      <div class="drag-handle">🖱️</div>
      <img class="item-image {type === 'reputation' ? 'reputation-type' : ''}" src={item.img || config.imageDefault} alt={type} />
      <div class="item-info {type === 'reputation' ? 'reputation-type' : ''}">
        <!-- Item name (same for both types) -->
        <div class="item-name">{item[config.nameProperty]}</div>

        {#if item[config.detailsProperty] && item[config.detailsProperty].trim()}
          <div class="item-details" class:expanded={expandedDetails[item.key]}>
            <p>{item[config.detailsProperty]}</p>
          </div>
          <button class="details-toggle" on:click|stopPropagation={handleToggleDetails}>
            {expandedDetails[item.key] ? '−' : '+'}
          </button>
        {/if}

        <!-- Valor/Cantidad con edición inline -->
        <div class="item-value-container">
          {#if editingQuantity[item.key]}
            <input
              class="item-input number {type === 'reputation' ? 'reputation-type' : ''}"
              type="number"
              min="0"
              max={config.barMax}
              bind:value={item[config.valueProperty]}
              on:blur={handleFinishQuantityEdit}
              on:keydown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleFinishQuantityEdit();
                }
              }}
              on:change={handleUpdate}
              autofocus
            />
          {:else}
            <span class="item-quantity" on:click|stopPropagation={handleToggleQuantityEdit}>
              {item[config.valueProperty]}
            </span>
          {/if}
          {#if config.showBar}
            <div class="value-bar">
              <div class="value-fill" style="width: {(item[config.valueProperty] / config.barMax) * 100}%"></div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .item-card {
    position: relative;
    background: transparent;
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.2s ease;
  }

  .item-info {
    align-items: flex-start;
  }

  .item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 0.5rem;
  }

  .item-name {
    font-family: "Eveleth";
    font-size: 1rem;
    color: #000000;
    line-height: 1.4;
  }

  .item-edit {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    border: 1px solid #6b7280;
  }

  .item-edit-image-button {
    flex-shrink: 0;
    width: 60px;
    height: 60px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.2s ease;
  }

  .item-edit-image-button:hover {
    transform: scale(1.05);
  }

  .item-image-edit {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 8px;
    border: 2px solid #6b7280;
  }

  .item-edit-image-button:hover .item-image-edit {
    border-color: #9ca3af;
  }

  .item-edit-text-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .item-input {
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 0.5rem;
    font-family: "Overpass", sans-serif;
    font-size: 14px;
    color: #374151;
  }

  .item-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .item-input.number {
    width: 48px;
  }

  .item-input.number.reputation-type {
    width: 32px;
  }

  .item-textarea {
    background: transparent;
    border: solid 1px #000000;
    margin-bottom: 0.5rem;
    font-family: "Overpass", sans-serif;
    font-size: 14px;
    line-height: 1.4;
    color: #000000;
    width: 100%;
    resize: vertical;
    min-height: 60px;
  }

  .item-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: auto;
  }

  .remove-button {
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-family: 'Overpass', Arial, sans-serif;
    font-weight: bold;
    cursor: pointer;
    font-size: 12px;
    height: 32px;
    width: 32px;
    border: 1px solid #000000;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .remove-button:hover {
    background: #b91c1c;
  }

  .item-value-container {
    position: absolute;
    bottom: 8px;
    right: 8px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
  }

  .item-quantity {
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-family: "Eveleth", "Overpass", Arial, sans-serif;
    font-weight: bold;
    font-size: 0.9rem;
    cursor: pointer;
    min-width: 2rem;
    text-align: center;
    transition: all 0.2s ease;
  }

  .item-quantity:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: scale(1.05);
  }

  .value-bar {
    width: 60px;
    height: 6px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.3);
  }

  .value-fill {
    height: 100%;
    background: linear-gradient(90deg, #dc2626 0%, #fbbf24 50%, #10b981 100%);
    transition: width 0.3s ease;
    border-radius: 2px;
  }

  .details-toggle {
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

  .details-toggle:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: scale(1.1);
  }
</style>
