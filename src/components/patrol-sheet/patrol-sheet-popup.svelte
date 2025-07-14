<script lang="ts">
  import type { GuardStat } from "@/guard/stats";
  import type { Group } from "@/shared/group";
  import { createEventDispatcher, onMount } from 'svelte';
  import { PatrolHandlers } from './patrol-handlers';
  import './patrol-sheet.css';

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

  // Handlers instance
  let handlers: PatrolHandlers;

  // Data
  let stats: GuardStat[] = [];
  let groupName: string = '';

  // Initialize handlers and data
  function updateComponentData() {
    if (handlers) {
      const data = handlers.getData();
      stats = data.stats;
      groupName = data.groupName;
    }
  }

  onMount(() => {
    handlers = new PatrolHandlers(group, labels, updateComponentData);
    updateComponentData();
  });

  // Update handlers when props change
  $: if (handlers) {
    handlers.updateGroup(group);
    handlers.updateLabels(labels);
    updateComponentData();
  }

  function close() {
    visible = false;
    dispatch('close');
  }

  function deployPatrol() {
    dispatch('deploy', handlers.handleDeployPatrol());
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
</script>

{#if visible}
  <div class="crow-nest-patrol">
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
                <button class="stat-button" on:click={() => handlers.handleRollStat(stat)} title="Hacer tirada de {stat.name}">
                  <img src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} class="stat-icon" />
                  <div class="stat-total">{handlers.totalStat(stat, group)}</div>
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
              on:dragstart={handlers.handleDragDeploy}
              title="Deploy patrol - Click to deploy at center or drag to canvas"
            >↓</button>
          </div>
        </div>

      </div>
    </div>
  </div>
{/if}
