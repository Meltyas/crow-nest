<script lang="ts">
  import RollDialogStandalone from '@/components/roll-dialog/roll-dialog-standalone.svelte';
  import type { GuardModifier, GuardStat } from "@/guard/stats";
  import type { Group } from "@/shared/group";
  import { groupsStore } from '@/stores/groups';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { PatrolHandlers } from './patrol-handlers';
  import './patrol-sheet.css';

  export let group: Group;
  export let labels: any;
  export let visible = true;
  export let initialPosition: { x: number; y: number } | null = null;

  const dispatch = createEventDispatcher();

  // Roll dialog state
  let rollDialogOpen = false;
  let rollDialogStat: GuardStat | null = null;
  let rollDialogGroup: Group | null = null;
  let rollDialogBaseValue = 0;
  let rollDialogTotalModifier = 0;
  let rollDialogGuardModifiers: GuardModifier[] = [];

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
  let showTemporaryModifiers = false;

  // Initialize handlers and data
  function updateComponentData() {
    if (handlers) {
      const data = handlers.getData();
      stats = data.stats;
      groupName = data.groupName;
    }
  }

  let unsubscribeFromStore: (() => void) | null = null;

  onMount(() => {
    handlers = new PatrolHandlers(group, labels, updateComponentData, openRollDialog);
    updateComponentData();

    // Subscribe to store changes to keep the group data in sync
    unsubscribeFromStore = groupsStore.subscribe(groups => {
      // Validate that groups is an array
      if (!Array.isArray(groups)) {
        console.warn('[PatrolSheet] Received invalid groups data:', groups);
        return;
      }

      const updatedGroup = groups.find(g => g.id === group.id);
      if (updatedGroup) {
        // Update the group data if it has changed
        if (JSON.stringify(updatedGroup) !== JSON.stringify(group)) {
          group = { ...updatedGroup };
          // Update handlers with the new group data
          if (handlers) {
            handlers.updateGroup(group);
            updateComponentData();
          }
        }
      }
    });
  });

  onDestroy(() => {
    // Cleanup store subscription
    if (unsubscribeFromStore) {
      unsubscribeFromStore();
    }
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

  function setHopeLevel(level: number) {
    const maxHope = group.maxHope || 3;
    group.hope = Math.min(level, maxHope); // Ensure hope doesn't exceed maxHope

    // Dispatch update to parent component
    dispatch('updateGroup', group);
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

  // Roll dialog functions
  function openRollDialog(stat: GuardStat, group: Group, baseValue: number, totalModifier: number, guardModifiers: GuardModifier[]) {
    rollDialogStat = stat;
    rollDialogGroup = group;
    rollDialogBaseValue = baseValue;
    rollDialogTotalModifier = totalModifier;
    rollDialogGuardModifiers = guardModifiers;
    rollDialogOpen = true;
  }

  function closeRollDialog() {
    rollDialogOpen = false;
    rollDialogStat = null;
    rollDialogGroup = null;
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
            <div class="officer-container">
              {#if group.officer}
                <img src={group.officer.img} alt={group.officer.name} class="officer-image" />
              {:else}
                <div class="no-officer-placeholder">
                  <span>No Officer</span>
                </div>
              {/if}

              <!-- Hope Meter - Compact version -->
              <div class="hope-meter-compact">
                <div class="hope-circles-compact">
                  {#each Array(group.maxHope || 3) as _, index}
                    <button
                      class="hope-circle-compact"
                      on:click={() => setHopeLevel(index + 1)}
                      title="Hope level {index + 1}"
                    >
                      <div class="hope-circle-shape-compact {(group.hope || 0) > index ? 'hope-circle-filled-compact' : 'hope-circle-empty-compact'}"></div>
                    </button>
                  {/each}
                </div>
              </div>
            </div>
          </div>

          <!-- Middle Column: Patrol name and stats -->
          <div class="middle-column">
            <div class="patrol-info" role="button" tabindex="0" on:mousedown={handleMouseDown}>
              <h2 class="patrol-name">{groupName}</h2>
            </div>

            <!-- Stats Grid with Toggle -->
            <div class="stats-row">
              <div class="stats-grid">
                {#each stats as stat}
                  <button class="stat-button" on:click={() => handlers.handleRollStat(stat)} title="Hacer tirada de {stat.name}">
                    <img src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} class="stat-icon" />
                    <div class="stat-total">{handlers.totalStat(stat, group)}</div>
                  </button>
                {/each}
              </div>

              <!-- Temporary Modifiers Toggle Button -->
              {#if group.temporaryModifiers && Object.keys(group.temporaryModifiers).length > 0}
                <div class="temp-modifiers-toggle">
                  <button class="toggle-button" on:click={() => showTemporaryModifiers = !showTemporaryModifiers}>
                    <span class="toggle-icon {showTemporaryModifiers ? 'expanded' : 'collapsed'}">▼</span>
                  </button>
                </div>
              {/if}
            </div>

            <!-- Temporary Modifiers Section -->
            {#if group.temporaryModifiers && Object.keys(group.temporaryModifiers).length > 0 && showTemporaryModifiers}
              <div class="temp-modifiers-section">
                <h4 class="temp-modifiers-title">Modificadores Temporales</h4>
                <div class="temp-modifiers-list">
                  {#each Object.entries(group.temporaryModifiers) as [modifierId, modifier]}
                    <div class="temp-modifier-item">
                      <div class="modifier-header">
                        <span class="modifier-name">{modifier.name}</span>
                      </div>

                      <!-- Show stat effects -->
                      {#if modifier.statEffects && Object.keys(modifier.statEffects).length > 0}
                        <div class="modifier-effects">
                          {#each Object.entries(modifier.statEffects) as [statKey, value]}
                            {@const stat = stats.find(s => s.key === statKey)}
                            {#if stat && value !== 0}
                              <div class="effect-item">
                                <img src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} class="effect-stat-icon" />
                                <span class="effect-stat-name">{stat.name}:</span>
                                <span class="effect-value {value > 0 ? 'positive' : 'negative'}">
                                  {value > 0 ? '+' : ''}{value}
                                </span>
                              </div>
                            {/if}
                          {/each}
                        </div>
                      {/if}

                      <!-- Description if exists -->
                      {#if modifier.description}
                        <div class="modifier-description">{modifier.description}</div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
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

<!-- Roll Dialog Component - Independent from popup -->
<RollDialogStandalone
  bind:isOpen={rollDialogOpen}
  stat={rollDialogStat}
  group={rollDialogGroup}
  baseValue={rollDialogBaseValue}
  totalModifier={rollDialogTotalModifier}
  guardModifiers={rollDialogGuardModifiers}
  on:close={closeRollDialog}
/>
