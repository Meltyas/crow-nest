<script lang="ts">
  import type { GuardReputation } from '@/guard/stats';
  import { generateUUID } from '@/utils/log';
  import { createEventDispatcher } from 'svelte';
  import AddItemForm from './add-item-form.svelte';
  import ItemCard from './item-card.svelte';

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

  // Drag and drop functionality - Drop zones within items
  let draggedIndex: number | null = null;
  let dropZoneVisible: Record<string, 'left' | 'right' | null> = {};

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

    if (draggedIndex !== null && draggedIndex !== index) {
      const rect = (event.currentTarget as Element).getBoundingClientRect();
      const x = event.clientX;
      const centerX = rect.left + rect.width / 2;
      const side = x < centerX ? 'left' : 'right';

      console.log('👆 DRAG OVER - Reputation index:', index, 'side:', side, 'dragged:', draggedIndex);

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
    console.log('👈 DRAG LEAVE - Reputation index:', index);
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
      dispatch('reorderReputation', { dragIndex: draggedIndex, dropIndex: newIndex });
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
      <button class="edit-button standard-button" on:click={toggleEditingReputation}>
        ✏️ {editingReputation ? 'Finalizar' : 'Editar'}
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
    {#each reputation as rep, i}
      <ItemCard
        item={rep}
        index={i}
        type="reputation"
        editing={editingReputation}
        expandedDetails={expandedReputationDetails}
        editingQuantity={{}}
        {draggedIndex}
        {dropZoneVisible}
        on:imageClick={(e) => onRepImageClick(e.detail)}
        on:fileChange={(e) => onRepFileChange(e.detail.item, e.detail.event)}
        on:update={updateReputation}
        on:remove={(e) => removeReputation(e.detail)}
        on:showInChat={(e) => showReputationInChat(e.detail)}
        on:toggleDetails={(e) => toggleReputationDetails(e.detail)}
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
  .add-reputation-form {
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

  /* Reputation Styles */
  .reputation-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .reputation-image {
    width: 100%;
    height: 56px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid #d4af37;
  }

  .reputation-image-button {
    align-self: center;
    width: 100%;
    height: 56px;
  }

  .reputation-image-button:hover {
    transform: scale(1.05);
  }

  .reputation-input {
    background: transparent;
    border: solid 1px #000000;
    color: #000000;
  }

  .reputation-input.number {
    width: 32px;
  }

  .reputation-textarea {
    background: transparent;
    border: solid 1px #000000;
    margin-bottom: 0.5rem;
    font-family: "Overpass", sans-serif;
    font-size: 14px;
    line-height: 1.4;
    color: #000000;
    width: 100%;
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
