<script lang="ts">
  import type { GuardReputation } from '@/guard/stats';
  import { createEventDispatcher } from 'svelte';

  export let reputation: GuardReputation[] = [];
  export let editingReputation = false;
  export let expandedReputationDetails: Record<string, boolean> = {};

  const dispatch = createEventDispatcher();

  let addingReputation = false;
  let newReputation: GuardReputation = {
    key: '',
    name: '',
    value: 0,
    img: 'icons/svg/aura.svg',
    details: ''
  };

  function toggleEditingReputation() {
    dispatch('toggleEditingReputation');
  }

  function openAddReputation() {
    newReputation = {
      key: crypto.randomUUID(),
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

  function confirmAddReputation() {
    dispatch('addReputation', { ...newReputation });
    addingReputation = false;
  }

  function removeReputation(index: number) {
    dispatch('removeReputation', index);
  }

  function updateReputation() {
    dispatch('updateReputation');
  }

  function onRepImageClick(rep: GuardReputation) {
    dispatch('repImageClick', rep);
  }

  function onNewRepImageClick() {
    dispatch('newRepImageClick', newReputation);
  }

  function onRepFileChange(rep: GuardReputation, event: Event) {
    dispatch('repFileChange', { rep, event });
  }

  function showReputationInChat(rep: GuardReputation) {
    dispatch('showReputationInChat', rep);
  }

  function toggleReputationDetails(repKey: string) {
    dispatch('toggleReputationDetails', repKey);
  }

  // Drag and drop functionality
  let draggedIndex: number | null = null;
  let dropZoneVisible: Record<number, boolean> = {};

  function handleDragStart(event: DragEvent, index: number) {
    console.log('🚀 DRAG START - Reputation index:', index);
    draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', '');
    }
  }

  function handleDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    event.stopPropagation();
    console.log('👆 DRAG OVER - Reputation target index:', index, 'dragged:', draggedIndex);
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
    console.log('👈 DRAG LEAVE - Reputation index:', index);
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
    console.log('🎯 DROP EVENT - Reputation from:', draggedIndex, 'to:', dropIndex);
    event.preventDefault();
    event.stopPropagation();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      console.log('✅ DISPATCHING REORDER - dragIndex:', draggedIndex, 'dropIndex:', dropIndex);
      // Dispatch with the correct parameters (dragIndex, dropIndex)
      dispatch('reorderReputation', { dragIndex: draggedIndex, dropIndex });
    } else {
      console.log('❌ NO REORDER - same index or null draggedIndex');
    }
    draggedIndex = null;
    dropZoneVisible = {};
  }

  function handleDragEnd() {
    console.log('🏁 DRAG END - Reputation');
    draggedIndex = null;
    dropZoneVisible = {};
  }
</script>

<div class="reputation-section">
  <h3 style="display: flex; justify-content: space-between; align-items: center;">
    Reputación
    <div style="display: flex; gap: 0.5rem; align-items: center;">
      <button class="edit-button small-button" on:click={toggleEditingReputation}>
        ✏️ {editingReputation ? 'Finalizar' : 'Editar'}
      </button>
      <button class="add-button small-button" on:click={openAddReputation}>➕ Añadir</button>
    </div>
  </h3>

  {#if addingReputation}
    <div class="add-reputation-form">
      <button type="button" class="reputation-image-button" on:click={onNewRepImageClick}>
        <img src={newReputation.img || 'icons/svg/aura.svg'} alt="reputation" />
      </button>
      <input placeholder="Nombre de la facción" bind:value={newReputation.name} />
      <input type="number" min="0" max="10" placeholder="Reputación (0-10)" bind:value={newReputation.value} />
      <textarea placeholder="Detalles sobre tu relación con esta facción..." bind:value={newReputation.details}></textarea>
      <button on:click={confirmAddReputation}>Agregar</button>
      <button on:click={cancelAddReputation}>Cancelar</button>
    </div>
  {/if}

  <div class="reputation-container">
    {#each reputation as rep, i}
      <div class="reputation-item"
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
        {#if editingReputation}
          <div class="reputation-edit">
            <button type="button" class="image-button reputation-edit-image-button" on:click={() => onRepImageClick(rep)}>
              <img class="reputation-image-edit" src={rep.img || 'icons/svg/aura.svg'} alt="reputation" />
            </button>
            <input id={`rep-file-${rep.key}`} type="file" accept="image/*" style="display:none" on:change={(e)=>onRepFileChange(rep,e)} />
            <input placeholder="Nombre" bind:value={rep.name} on:change={updateReputation} />
            <textarea placeholder="Detalles sobre la relación..." bind:value={rep.details} on:change={updateReputation}></textarea>
            <div class="rep-actions">
              <input type="number" min="0" max="10" bind:value={rep.value} on:change={updateReputation} />
              <button on:click={() => removeReputation(i)}>✕</button>
            </div>
          </div>
        {:else}
          <div class="reputation-display" role="button" tabindex="0"
               on:click={() => showReputationInChat(rep)}
               on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showReputationInChat(rep); } }}>
            <div class="drag-handle">🖱️</div>
            <img class="reputation-image" src={rep.img || 'icons/svg/aura.svg'} alt="reputation" />
            <div class="reputation-info">
              <div class="reputation-name">{rep.name}</div>
              <div class="reputation-bar-container">
                <div class="reputation-bar">
                  <div class="reputation-fill" style="width: {rep.value * 10}%; background: linear-gradient(90deg,
                    hsl({(rep.value / 10) * 120}, 70%, 40%) 0%,
                    hsl({(rep.value / 10) * 120}, 80%, 50%) 50%,
                    hsl({(rep.value / 10) * 120}, 70%, 60%) 100%);">
                  </div>
                  {#each Array(11) as _, j}
                    <div class="reputation-tick" style="left: {j * 10}%;"></div>
                  {/each}
                </div>
              </div>
            </div>
            {#if rep.details && rep.details.trim()}
              <button class="reputation-details-toggle" on:click|stopPropagation={() => toggleReputationDetails(rep.key)}>
                📝
              </button>
            {/if}
                      {#if rep.details && rep.details.trim() && expandedReputationDetails[rep.key]}
            <div class="reputation-details">
              <p>{rep.details}</p>
            </div>
          {/if}
          </div>

        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  /* Reputation Styles */
  .reputation-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .reputation-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
    position: relative;
    transition: opacity 0.2s ease;
  }

  .reputation-item.dragging {
    opacity: 0.7;
  }

  .reputation-display {
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

  .reputation-display:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  .reputation-display:focus {
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

  .reputation-item.dragging .drag-handle {
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

  .reputation-item:not(.dragging) .drop-zone.show {
    display: flex;
    pointer-events: all;
  }

  .reputation-image {
    width: 100%;
    height: 56px;
    object-fit: cover;
    border-radius: 8px 8px 0 0;
    flex-shrink: 0;
    border-bottom: 2px solid #d4af37;
  }

  .reputation-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    align-items: center;
    padding: 0.75rem;
  }

  .reputation-name {
    font-weight: bold;
    font-size: 1em;
    color: #f9fafb;
    text-align: center;
    line-height: 1.2;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  }

  .reputation-bar-container {
    position: relative;
    width: 100%;
  }

  .reputation-bar {
    width: 100%;
    height: 24px;
    background: #000000;
    border: 2px solid #d4af37;
    border-radius: 12px;
    position: relative;
    overflow: hidden;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .reputation-fill {
    height: 100%;
    transition: width 0.4s ease;
    border-radius: 0;
    position: relative;
    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.2);
  }

  .reputation-tick {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: linear-gradient(to bottom,
      rgba(0, 0, 0, 0.8) 0%,
      rgba(0, 0, 0, 0.6) 50%,
      rgba(0, 0, 0, 0.8) 100%);
    z-index: 1;
    border-radius: 1px;
  }

  .reputation-tick:first-child,
  .reputation-tick:last-child {
    opacity: 0; /* Hide first and last ticks */
  }

  .reputation-edit {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    border: 1px solid #6b7280;
    border-radius: 8px;
    background: transparent;
  }

  .rep-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
    justify-content: center;
    margin-bottom: 0.5rem;
  }

  .reputation-edit input[type="number"] {
    width: 80px;
  }

  .reputation-image-button {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.2s ease;
  }

  .reputation-image-button:hover {
    transform: scale(1.05);
  }

  .reputation-image-button img {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 8px;
    border: 2px solid #6b7280;
  }

  .reputation-image-edit{
    height: 56px;
    object-fit: cover;
    width: 100%;
  }

  .reputation-edit-image-button {
    width: 100%;
    height: 56px;
  }

  /* Reputation details styles */
  .reputation-details-toggle {
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

  .reputation-details-toggle:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: scale(1.1);
  }

  .reputation-details {
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

  .reputation-details p {
    margin: 0;
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
