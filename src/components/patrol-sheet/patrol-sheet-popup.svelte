<script lang="ts">
  import type { GuardStat } from "@/guard/stats";
  import { getModifiers, getStats } from "@/guard/stats";
  import type { Group } from "@/shared/group";
  import { createEventDispatcher } from 'svelte';

  export let group: Group;
  export let labels: any;
  export let visible = true;
  export let initialPosition: { x: number; y: number } | null = null;

  const dispatch = createEventDispatcher();

  // Drag functionality
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let position = { x: 0, y: 0 };
  let popupElement: HTMLElement;
  let initialized = false;

  // Initialize position when popup becomes visible
  $: if (visible && popupElement && !initialized) {
    if (initialPosition) {
      // Use saved position
      position.x = initialPosition.x;
      position.y = initialPosition.y;

      // Keep popup within viewport bounds
      const maxX = window.innerWidth - popupElement.offsetWidth;
      const maxY = window.innerHeight - popupElement.offsetHeight;

      position.x = Math.max(0, Math.min(position.x, maxX));
      position.y = Math.max(0, Math.min(position.y, maxY));
    } else {
      // Center the popup on screen
      const rect = popupElement.getBoundingClientRect();
      position.x = (window.innerWidth - rect.width) / 2;
      position.y = (window.innerHeight - rect.height) / 2;
    }
    initialized = true;
  }

  // Reset initialization when popup is hidden
  $: if (!visible) {
    initialized = false;
  }

  let stats: GuardStat[] = [];
  let modifiers: any[] = [];

  $: {
    stats = getStats() as GuardStat[];
    modifiers = getModifiers();
  }

  function close() {
    visible = false;
    dispatch('close');
  }

  // Drag functions
  function handleMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    // Only allow dragging from officer image, placeholder, or patrol name area
    if (target.closest('.left-column') || target.closest('.patrol-info')) {
      isDragging = true;
      const rect = popupElement.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      e.preventDefault();
    }
  }
  function handleMouseMove(e: MouseEvent) {
    if (isDragging) {
      position.x = e.clientX - dragOffset.x;
      position.y = e.clientY - dragOffset.y;

      // Keep popup within viewport bounds
      const maxX = window.innerWidth - popupElement.offsetWidth;
      const maxY = window.innerHeight - popupElement.offsetHeight;

      position.x = Math.max(0, Math.min(position.x, maxX));
      position.y = Math.max(0, Math.min(position.y, maxY));
    }
  }

  function handleMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    // Emit position change event for persistence
    dispatch('positionChange', { x: position.x, y: position.y });
  }

  function guardBonus(key: string): number {
    return modifiers.reduce((acc, m) => acc + (m.mods[key] || 0), 0);
  }

  function totalStat(stat: GuardStat, group: Group): number {
    return stat.value + guardBonus(stat.key) + (group.mods[stat.key] || 0);
  }

  function rollStat(stat: GuardStat) {
    const total = totalStat(stat, group);
    const r = new Roll(`1d20 + ${total}`);
    r.evaluate();

    const lines: string[] = [stat.name, `Guard base value ${stat.value}`];
    const guardMod = guardBonus(stat.key);
    if (guardMod) {
      lines.push(`Guard modifier ${guardMod > 0 ? '+' : ''}${guardMod}`);
    }
    const groupMod = group.mods[stat.key];
    if (groupMod) {
      lines.push(`Patrol modifier ${groupMod > 0 ? '+' : ''}${groupMod}`);
    }

    const groupName = group.name || (group.officer ? `${labels.groupSingular} de ${group.officer.name}` : 'Grupo');
    const headerImg = group.officer
      ? `<img src="${group.officer.img}" alt="${group.officer.name}" width="32" height="32" style="vertical-align:middle;margin-right:0.5rem;"/>`
      : '';
    const header = `<div style="display:flex;align-items:center;gap:0.5rem;">${headerImg}<strong>${groupName}</strong></div>`;

    const flavor = `${header}<br/>${lines.join('<br/>')}`;
    r.toMessage({ speaker: { alias: groupName }, flavor });
  }

  function deployPatrol() {
    dispatch('deploy', group);
  }

  // Función para manejar el drag del deploy
  function onDragDeploy(event: DragEvent) {
    const payload = {
      type: 'CrowPatrol',
      patrolId: group.id,
    };
    event.dataTransfer?.setData('text/plain', JSON.stringify(payload));
  }

  $: groupName = group.name || (group.officer ? `${labels.groupSingular} de ${group.officer.name}` : 'Grupo');
</script>

<style>
  .patrol-sheet-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    z-index: 75;
    pointer-events: none;
  }

  .patrol-sheet-popup {
    background: rgba(0, 0, 0, 0.95);
    border: 2px solid #d4af37;
    border-radius: 12px;
    min-width: 400px;
    max-width: 600px;
    position: absolute;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
    user-select: none;
    pointer-events: auto;
  }

  .patrol-sheet-popup.dragging {
    pointer-events: auto;
  }

  .patrol-sheet-header {
    display: flex;
    gap: 0.25rem;
    position: relative;
    background: linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(212, 175, 55, 0.05));
  }

  .patrol-sheet-header:hover {
    background: linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.08));
  }

  .left-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 100px;
    z-index: 1;
    position: relative;
    cursor: move; /* Enable drag on officer image */
  }

  .middle-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    z-index: 1;
    position: relative;
  }

  .right-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 0.25rem;
    min-width: 40px;
    padding-right: 0.5rem;
    padding-top: 0.5rem;
    z-index: 3;
    position: relative;
  }

  .patrol-info {
    margin-bottom: 0.5rem;
    cursor: move; /* Enable drag on patrol name */
  }

  .drag-handle {
    /* Remove the drag handle overlay - drag will be handled by specific elements */
    display: none;
  }

  .close-button {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: rgba(239, 68, 68, 0.9);
    border: 2px solid #ffffff;
    border-radius: 50%;
    color: white;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 16px;
    font-weight: bold;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    z-index: 2;
    /* Hide the old floating button */
    display: none;
  }

  .close-button-inline {
    background: rgba(239, 68, 68, 0.9);
    border: 2px solid #ffffff;
    border-radius: 4px;
    color: white;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .close-button-inline:hover {
    background: rgba(239, 68, 68, 1);
    transform: scale(1.1);
  }

  .deploy-button-inline {
    background: #4a90e2;
    border: 2px solid #ffffff;
    border-radius: 4px;
    color: white;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .deploy-button-inline:hover {
    background: #357abd;
    transform: scale(1.1);
  }

  .officer-image {
    width: 100px;
    height: 75px;
    object-fit: cover;
    border-radius: 8px;
    border: 2px solid #d4af37;
  }

  .no-officer-placeholder {
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed #666;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.3);
    color: #999;
    font-size: 0.8em;
  }

  .patrol-name {
    margin: 0;
    color: #d4af37;
    font-size: 1.3em;
    font-weight: bold;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
    font-family: "Cinzel", serif;
    padding-top: 0.25rem;
  }

  .officer-name {
    color: #fff;
    font-size: 0.9em;
    margin-top: 0.25rem;
  }

  .stats-grid {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 0.25rem;
  }

  .stat-button {
    align-items: center;
    gap: 0.25rem;
    background: none;
    border: none;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.3s ease;
    min-width: 0;
    position: relative;
    padding: 0;
  }

  .stat-button:hover {
    background: rgba(212, 175, 55, 0.2);
    transform: translateY(-2px);
  }

  .stat-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 2px solid rgba(212, 175, 55, 0.5);
  }

  .stat-total {
    font-size: 0.9em;
    color: #d4af37;
    font-weight: bold;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  }

  .soldiers-section {
    padding: 1rem;
    border-top: 1px solid rgba(212, 175, 55, 0.3);
  }

  .soldiers-label {
    color: #d4af37;
    font-weight: bold;
    font-size: 0.9em;
    margin-bottom: 0.5rem;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  }

  .soldiers-list {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .soldier-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #666;
    transition: all 0.3s ease;
  }

  .soldier-avatar:hover {
    border-color: #d4af37;
    transform: scale(1.1);
  }
</style>

{#if visible}
  <div class="patrol-sheet-overlay">
    <div
      class="patrol-sheet-popup {isDragging ? 'dragging' : ''}"
      bind:this={popupElement}
      style="left: {position.x}px; top: {position.y}px;"
    >

      <!-- Header -->
      <div class="patrol-sheet-header">
        <!-- Left Column: Officer image -->
        <div class="left-column" role="button" tabindex="0" on:mousedown={handleMouseDown}>
          {#if group.officer}
            <img src={group.officer.img} alt={group.officer.name} class="officer-image" />
          {:else}
            <div class="no-officer-placeholder">
              <span>No Officer</span>
            </div>
          {/if}
        </div>

        <!-- Middle Column: Patrol name and stats -->
        <div class="middle-column">
          <div class="patrol-info" role="button" tabindex="0" on:mousedown={handleMouseDown}>
            <h2 class="patrol-name">{groupName}</h2>
          </div>

          <!-- Stats Grid -->
          <div class="stats-grid">
            {#each stats as stat}
              <button class="stat-button" on:click={() => rollStat(stat)} title="Hacer tirada de {stat.name}">
                <img src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} class="stat-icon" />
                <div class="stat-total">{totalStat(stat, group)}</div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Right Column: Close and Deploy buttons -->
        <div class="right-column">
          <button class="close-button-inline" on:click={close}>×</button>
          <button
            class="deploy-button-inline"
            draggable="true"
            on:click={deployPatrol}
            on:dragstart={onDragDeploy}
            title="Deploy patrol - Click to deploy at center or drag to canvas"
          >↓</button>
        </div>
      </div>

    </div>
  </div>
{/if}
