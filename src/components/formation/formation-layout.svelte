<script lang="ts">
  import type { GroupMember } from '@/shared/group';
  import { createEventDispatcher } from 'svelte';

  export let soldiers: (GroupMember | null)[] = [];
  export let maxSoldiers: number = 5;
  export let editing: boolean = false;
  export let labels = {
    soldierDrop: 'Drag soldiers here'
  };

  const dispatch = createEventDispatcher();

  // Ensure soldiers array has the correct number of slots
  $: {
    while (soldiers.length < maxSoldiers) {
      soldiers.push(null);
    }
    if (soldiers.length > maxSoldiers) {
      soldiers = soldiers.slice(0, maxSoldiers);
    }
  }

  function handleDrop(event: DragEvent, position: number) {
    event.preventDefault();
    dispatch('dropSoldier', { event, position });
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function removeSoldier(position: number) {
    dispatch('removeSoldier', { position });
  }

  // Formation layouts for different soldier counts
  function getFormationLayout(count: number) {
    switch (count) {
      case 0:
        return { rows: [], class: 'formation-empty' };
      case 1:
        return { 
          rows: [[0]], 
          class: 'formation-single' 
        };
      case 2:
        return { 
          rows: [[0, 1]], 
          class: 'formation-pair' 
        };
      case 3:
        return { 
          rows: [[0], [1, 2]], 
          class: 'formation-triangle' 
        };
      case 4:
        return { 
          rows: [[0, 1], [2, 3]], 
          class: 'formation-square' 
        };
      case 5:
        return { 
          rows: [[0, 1], [2], [3, 4]], 
          class: 'formation-diamond' 
        };
      case 6:
        return { 
          rows: [[0, 1], [2, 3], [4, 5]], 
          class: 'formation-rectangle' 
        };
      default:
        return { 
          rows: [[0, 1], [2, 3], [4, 5]], 
          class: 'formation-rectangle' 
        };
    }
  }

  $: formation = getFormationLayout(maxSoldiers);
</script>

<div class="formation-container {formation.class}">
  {#if maxSoldiers === 0}
    <div class="empty-formation">
      <i class="fas fa-user-slash"></i>
      <span>No soldiers</span>
    </div>
  {:else}
    {#each formation.rows as row, rowIndex}
      <div class="formation-row" data-row={rowIndex}>
        {#each row as position}
          <div 
            class="soldier-slot {soldiers[position] ? 'occupied' : 'empty'}"
            data-position={position}
            on:drop={(e) => handleDrop(e, position)}
            on:dragover={handleDragOver}
            role="button"
            tabindex="0"
            aria-label={soldiers[position] ? `Soldier: ${soldiers[position]?.name}` : labels.soldierDrop}
          >
            {#if soldiers[position]}
              <div class="soldier-card">
                <img 
                  src={soldiers[position]?.img || 'icons/svg/mystery-man.svg'} 
                  alt={soldiers[position]?.name || 'Soldier'} 
                  class="soldier-image"
                />
                <div class="soldier-name">{soldiers[position]?.name || 'Unknown'}</div>
                {#if editing}
                  <button 
                    class="remove-soldier-btn"
                    on:click={() => removeSoldier(position)}
                    type="button"
                    aria-label="Remove soldier"
                  >
                    <i class="fas fa-times"></i>
                  </button>
                {/if}
              </div>
            {:else}
              <div class="empty-slot">
                <i class="fas fa-plus"></i>
                <span class="drop-hint">{labels.soldierDrop}</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  {/if}
</div>

<style>
  .formation-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    border: 2px dashed #666;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.1);
    min-height: 120px;
    justify-content: center;
  }

  .empty-formation {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: #888;
    font-style: italic;
  }

  .empty-formation i {
    font-size: 2rem;
    opacity: 0.5;
  }

  .formation-row {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
  }

  .soldier-slot {
    width: 60px;
    height: 60px;
    border: 2px solid #666;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    position: relative;
    background: rgba(255, 255, 255, 0.05);
  }

  .soldier-slot.empty {
    border-style: dashed;
    cursor: pointer;
  }

  .soldier-slot.empty:hover {
    border-color: #4a90e2;
    background: rgba(74, 144, 226, 0.1);
  }

  .soldier-slot.occupied {
    border-color: #4a90e2;
    background: rgba(74, 144, 226, 0.2);
  }

  .soldier-card {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    gap: 2px;
  }

  .soldier-image {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid #666;
  }

  .soldier-name {
    font-size: 0.6rem;
    color: #fff;
    text-align: center;
    line-height: 1;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove-soldier-btn {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #dc3545;
    border: none;
    color: white;
    font-size: 0.6rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .remove-soldier-btn:hover {
    background: #c82333;
    transform: scale(1.1);
  }

  .empty-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: #888;
    font-size: 0.7rem;
    text-align: center;
  }

  .empty-slot i {
    font-size: 1rem;
    opacity: 0.5;
  }

  .drop-hint {
    font-size: 0.6rem;
    line-height: 1;
    max-width: 100%;
    word-wrap: break-word;
  }

  /* Formation-specific layouts */
  .formation-single .formation-row {
    justify-content: center;
  }

  .formation-pair .formation-row {
    justify-content: center;
  }

  .formation-triangle .formation-row:first-child {
    justify-content: center;
  }

  .formation-square {
    gap: 0.75rem;
  }

  .formation-diamond .formation-row:nth-child(2) {
    justify-content: center;
  }

  .formation-rectangle {
    gap: 0.5rem;
  }

  /* Drag and drop states */
  .soldier-slot[data-drag-over="true"] {
    border-color: #28a745;
    background: rgba(40, 167, 69, 0.2);
    transform: scale(1.05);
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .formation-container {
      padding: 0.5rem;
    }

    .soldier-slot {
      width: 50px;
      height: 50px;
    }

    .soldier-image {
      width: 24px;
      height: 24px;
    }

    .formation-row {
      gap: 0.5rem;
    }
  }
</style>
