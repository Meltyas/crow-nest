<script lang="ts">
  import type { Group } from '@/shared/group';
  import { createEventDispatcher } from 'svelte';

  export let group: Group;
  export let editing: boolean = false;
  export let labels = {
    officerDrop: 'Drag an officer here',
    soldierDrop: 'Drag soldiers here',
  };

  const dispatch = createEventDispatcher();

  function handleOfficerDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function handleOfficerDrop(event: DragEvent) {
    dispatch('officerDrop', { event, group });
  }

  function handleOfficerDoubleClick() {
    if (group.officer) {
      dispatch('officerDoubleClick', group.officer.id);
    }
  }

  function handleRemoveOfficer() {
    dispatch('removeOfficer', group);
  }

  function handleSoldierDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function handleSoldierDrop(event: DragEvent, slotIndex: number) {
    dispatch('soldierDrop', { event, group, slotIndex });
  }

  function handleSoldierDoubleClick(soldier: any) {
    if (soldier) {
      dispatch('soldierDoubleClick', soldier.id);
    }
  }

  function handleSoldierDragStart(event: DragEvent, soldier: any) {
    dispatch('soldierDragStart', { event, soldier });
  }

  function handleRemoveSoldier(slotIndex: number) {
    dispatch('removeSoldier', { group, slotIndex });
  }
</script>

<div class="formation-container">
  <!-- Officer Center Position -->
  <div class="formation-center officer-position">
    <div
      class="formation-slot officer-slot {group.officer ? 'occupied' : 'empty'}"
      role="button"
      tabindex="0"
      aria-label={labels.officerDrop}
      on:dragover={handleOfficerDragOver}
      on:drop={handleOfficerDrop}
      on:dblclick={handleOfficerDoubleClick}
      title={group.officer ? `${group.officer.name} - Double-click to open` : labels.officerDrop}
    >
      {#if group.officer}
        <img src={group.officer.img} alt={group.officer.name} class="formation-avatar" />
        <div class="formation-name">{group.officer.name}</div>
        {#if editing}
          <button class="formation-remove" on:click={handleRemoveOfficer}>×</button>
        {/if}
      {:else}
        <div class="formation-placeholder">
          <div class="formation-icon">👤</div>
          <div class="formation-label">Officer</div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Soldier Positions (dynamic pentagon/hexagon) -->
  {#each Array(group.maxSoldiers || 5) as _, slotIndex}
    {@const soldier = group.soldiers[slotIndex]}
    <div class="formation-point formation-point-{slotIndex} formation-{group.maxSoldiers || 5}-sided">
      <div
        class="formation-slot soldier-slot {soldier ? 'occupied' : 'empty'}"
        role="button"
        tabindex="0"
        aria-label="Soldier position {slotIndex + 1}"
        on:dragover={handleSoldierDragOver}
        on:drop={(e) => handleSoldierDrop(e, slotIndex)}
        on:dblclick={() => handleSoldierDoubleClick(soldier)}
        title={soldier ? `${soldier.name} - Double-click to open` : `Soldier position ${slotIndex + 1}`}
      >
        {#if soldier}
          <img
            src={soldier.img}
            alt={soldier.name}
            class="formation-avatar"
            draggable="true"
            on:dragstart={(e) => handleSoldierDragStart(e, soldier)}
          />
          <div class="formation-name">{soldier.name}</div>
          {#if editing}
            <button class="formation-remove" on:click={() => handleRemoveSoldier(slotIndex)}>×</button>
          {/if}
        {:else}
          <div class="formation-placeholder">
            <div class="formation-icon">🛡️</div>
            <div class="formation-label">Soldier</div>
          </div>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .formation-container {
    position: relative;
    width: 100%;
    flex-shrink: 0;
    aspect-ratio: 1;
    max-width: 200px;
  }

  .formation-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
  }

  .formation-point {
    position: absolute;
  }

  /* Pentagon point positions (5 soldiers) */
  .formation-5-sided.formation-point-0 { /* Top */
    top: 0;
    left: 50%;
    transform: translateX(-50%);
  }

  .formation-5-sided.formation-point-1 { /* Top Right */
    top: 25%;
    right: 0;
  }

  .formation-5-sided.formation-point-2 { /* Bottom Right */
    bottom: 5%;
    right: 10%;
  }

  .formation-5-sided.formation-point-3 { /* Bottom Left */
    bottom: 5%;
    left: 10%;
  }

  .formation-5-sided.formation-point-4 { /* Top Left */
    top: 25%;
    left: 0;
  }

  /* Hexagon point positions (6 soldiers) - 2 top, 2 bottom, 1 each side */
  .formation-6-sided.formation-point-0 { /* Top Left */
    top: 10%;
    left: 25%;
    transform: translateX(-50%);
  }

  .formation-6-sided.formation-point-1 { /* Top Right */
    top: 10%;
    left: 75%;
    transform: translateX(-50%);
  }

  .formation-6-sided.formation-point-2 { /* Right Side */
    top: 50%;
    left: 90%;
    transform: translate(-50%, -50%);
  }

  .formation-6-sided.formation-point-3 { /* Bottom Right */
    top: 65%;
    left: 75%;
    transform: translateX(-50%);
  }

  .formation-6-sided.formation-point-4 { /* Bottom Left */
    top: 65%;
    left: 25%;
    transform: translateX(-50%);
  }

  .formation-6-sided.formation-point-5 { /* Left Side */
    top: 50%;
    left: 10%;
    transform: translate(-50%, -50%);
  }

  .formation-slot {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: 2px solid #d4af37;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    cursor: pointer;
    transition: all 0.3s ease;
    overflow: hidden;
  }

  .formation-slot.officer-slot {
    width: 85px;
    height: 85px;
    border-width: 3px;
    border-color: #ff6b35;
  }

  .formation-slot.empty:hover {
    border-color: #ffd700;
    background: rgba(255, 215, 0, 0.2);
    transform: scale(1.05);
  }

  .formation-slot.occupied:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  .formation-avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }

  .formation-name {
    position: absolute;
    bottom: -25px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.7rem;
    white-space: nowrap;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
    z-index: 20;
  }

  .formation-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: #666;
  }

  .formation-icon {
    font-size: 1.5rem;
  }

  .formation-label {
    font-size: 0.6rem;
    text-align: center;
    line-height: 1;
  }

  .formation-remove {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 50%;
    background: #ff4444;
    color: white;
    border: none;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 30;
    width: 100%;
    height: 100%;
    opacity: 0.5;
  }

  .formation-remove:hover {
    background: #ff0000;
  }
</style>
