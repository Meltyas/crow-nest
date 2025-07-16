<script context="module" lang="ts">
  // FilePicker is provided by Foundry at runtime
  declare const FilePicker: any;
</script>

<script lang="ts">
  import { getAdmins, saveAdmins } from '@/admin/admins';
  import Groups from '@/components/groups/groups.svelte';
  import { MODULE_ID, SETTING_MODIFIERS, SETTING_REPUTATION, SETTING_RESOURCES, SETTING_STATS } from '@/constants';
  import type { GuardModifier, GuardReputation, GuardResource, GuardStat } from '@/guard/stats';
  import {
    getModifiers,
    getReputation,
    getResources,
    getStats,
  } from '@/guard/stats';
  import { getPatrols, savePatrols } from '@/patrol/patrols';
  import { SyncManager } from '@/utils/sync';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { GuardHandlers } from './guard-handlers';
  import './guard.css';
  import ModifiersSection from './modifiers-section.svelte';
  import ReputationSection from './reputation-section.svelte';
  import ResourcesSection from './resources-section.svelte';
  import StatsSection from './stats-section.svelte';

  // Props for controlling the popup
  export let showPopup = false;

  const dispatch = createEventDispatcher();

  interface Stat extends GuardStat {}

  let stats: Stat[] = [];
  let editing = false;

  let modifiers: GuardModifier[] = [];
  let editingMods = false;

  let resources: GuardResource[] = [];
  let editingResources = false;

  let reputation: GuardReputation[] = [];
  let editingReputation = false;
  let expandedReputationDetails: Record<string, boolean> = {};
  let expandedResourceDetails: Record<string, boolean> = {};

  // Tab system - Load last active tab from localStorage
  let activeTab: 'guardia' | 'patrullas' | 'admins' = (localStorage.getItem('crow-nest-active-tab') as 'guardia' | 'patrullas' | 'admins') || 'guardia';

  // Guard sub-tab system - Load last active guard sub-tab from localStorage
  let activeGuardTab: 'reputation' | 'resources' = (localStorage.getItem('crow-nest-guard-subtab') as 'reputation' | 'resources') || 'reputation';

  // Header title and subtitle
  let headerTitle = localStorage.getItem('crow-nest-title') || 'Los Cuervos';
  let headerSubtitle = localStorage.getItem('crow-nest-subtitle') || 'Guardianes del Reino';

  // Data for tabs
  let patrols: any[] = [];
  let admins: any[] = [];

  // Draggable popup state
  let popupPosition = { x: 100, y: 100 };
  let popupSize = { width: 800, height: 600 };
  let isDragging = false;
  let isResizing = false;
  let dragOffset = { x: 0, y: 0 };
  let resizeStartPos = { x: 0, y: 0 };
  let resizeStartSize = { width: 0, height: 0 };

  // Sync manager
  let syncManager: SyncManager;

  // Handlers instance
  let handlers: GuardHandlers;

  function switchTab(tab: 'guardia' | 'patrullas' | 'admins') {
    activeTab = tab;
    // Save the active tab to localStorage
    localStorage.setItem('crow-nest-active-tab', tab);
  }

  function switchGuardTab(tab: 'reputation' | 'resources') {
    activeGuardTab = tab;
    // Save the active guard sub-tab to localStorage
    localStorage.setItem('crow-nest-guard-subtab', tab);
  }

  function closePopup() {
    dispatch('close');
  }

  function onDragStart(event: MouseEvent) {
    isDragging = true;
    dragOffset = {
      x: event.clientX - popupPosition.x,
      y: event.clientY - popupPosition.y,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      popupPosition = {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      };
    };

    const handleMouseUp = () => {
      isDragging = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function onResizeStart(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    isResizing = true;
    resizeStartPos = { x: event.clientX, y: event.clientY };
    resizeStartSize = { width: popupSize.width, height: popupSize.height };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - resizeStartPos.x;
      const deltaY = e.clientY - resizeStartPos.y;

      popupSize = {
        width: Math.max(400, resizeStartSize.width + deltaX),
        height: Math.max(300, resizeStartSize.height + deltaY),
      };
    };

    const handleMouseUp = () => {
      isResizing = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  onMount(() => {
    stats = getStats() as Stat[];
    modifiers = getModifiers();
    sortModifiersByState(); // Sort modifiers on initial load
    resources = getResources();
    reputation = getReputation();
    patrols = getPatrols();
    admins = getAdmins();

    // Initialize handlers
    handlers = new GuardHandlers(updateComponentData);

    // Setup real-time synchronization
    syncManager = SyncManager.getInstance();

    // Listen for different types of updates
    syncManager.subscribe('stats', handlers.handleStatsSync);
    syncManager.subscribe('modifiers', handlers.handleModifiersSync);
    syncManager.subscribe('resources', handlers.handleResourcesSync);
    syncManager.subscribe('reputation', handlers.handleReputationSync);
    syncManager.subscribe('patrols', handlers.handlePatrolsSync);
    syncManager.subscribe('admins', handlers.handleAdminsSync);

    // Update handlers with initial data
    updateHandlersData();

    // Also listen for direct game settings changes as backup
    Hooks.on('updateSetting', (setting: any) => {
      if (setting.key === `${MODULE_ID}.${SETTING_STATS}`) {
        stats = setting.value || [];
        updateHandlersData();
      }

      if (setting.key === `${MODULE_ID}.${SETTING_MODIFIERS}`) {
        modifiers = setting.value || [];
        sortModifiersByState(); // Sort modifiers when loaded from settings
        updateHandlersData();
      }

      if (setting.key === `${MODULE_ID}.${SETTING_RESOURCES}`) {
        resources = setting.value || [];
        updateHandlersData();
      }

      if (setting.key === `${MODULE_ID}.${SETTING_REPUTATION}`) {
        reputation = setting.value || [];
        updateHandlersData();
      }

      if (setting.key === `${MODULE_ID}.patrols`) {
        patrols = setting.value || [];
        updateHandlersData();
      }

      if (setting.key === `${MODULE_ID}.admins`) {
        admins = setting.value || [];
        updateHandlersData();
      }
    });
  });

  onDestroy(() => {
    if (syncManager && handlers) {
      syncManager.unsubscribe('stats', handlers.handleStatsSync);
      syncManager.unsubscribe('modifiers', handlers.handleModifiersSync);
      syncManager.unsubscribe('resources', handlers.handleResourcesSync);
      syncManager.unsubscribe('reputation', handlers.handleReputationSync);
      syncManager.unsubscribe('patrols', handlers.handlePatrolsSync);
      syncManager.unsubscribe('admins', handlers.handleAdminsSync);
    }
  });

  function getTotalStatValue(stat: Stat): number {
    const modifierBonus = modifiers.reduce((acc, m) => acc + (m.mods[stat.key] || 0), 0);
    return stat.value + modifierBonus;
  }

  function sortModifiersByState() {
    // Sort modifiers by state: positive -> neutral -> negative
    const stateOrder = { 'positive': 0, 'neutral': 1, 'negative': 2 };
    modifiers.sort((a, b) => {
      const stateA = stateOrder[a.state || 'neutral'] ?? 1; // Default to neutral if state is undefined
      const stateB = stateOrder[b.state || 'neutral'] ?? 1;
      return stateA - stateB;
    });
  }

  // Update handlers with current component data
  function updateHandlersData() {
    if (handlers) {
      handlers.updateData({
        stats,
        modifiers,
        resources,
        reputation,
        patrols,
        admins,
        editing,
        editingMods,
        editingResources,
        editingReputation,
        expandedReputationDetails,
        expandedResourceDetails,
      });
    }
  }

  // Update component data from handlers
  function updateComponentData() {
    if (handlers) {
      const data = handlers.getData();
      stats = data.stats;
      modifiers = data.modifiers;
      resources = data.resources;
      reputation = data.reputation;
      patrols = data.patrols;
      admins = data.admins;
      expandedReputationDetails = data.expandedReputationDetails;
      expandedResourceDetails = data.expandedResourceDetails;
    }
  }

  // Toggle state handlers (these stay local as they're simple state changes)
  function handleToggleEditing() {
    editing = !editing;
    updateHandlersData();
  }

  function handleToggleEditingMods() {
    editingMods = !editingMods;
    if (!editingMods) {
      sortModifiersByState();
    }
    updateHandlersData();
  }

  function handleToggleEditingReputation() {
    editingReputation = !editingReputation;
    updateHandlersData();
  }

  function handleToggleEditingResources() {
    editingResources = !editingResources;
    updateHandlersData();
  }

  // Handle title and subtitle changes
  function handleTitleChange(event: Event, type: 'title' | 'subtitle') {
    const target = event.target as HTMLElement;
    const newText = target.textContent?.trim() || '';

    // Update the reactive variables and save to localStorage
    if (type === 'title') {
      headerTitle = newText;
      localStorage.setItem('crow-nest-title', newText);
    } else {
      headerSubtitle = newText;
      localStorage.setItem('crow-nest-subtitle', newText);
    }
  }

  // ...existing code...
</script>

{#if showPopup}
  <div class="crow-nest-guard">
    <div
      class="custom-popup"
      style="transform: translate({popupPosition.x}px, {popupPosition.y}px); width: {popupSize.width}px; height: {popupSize.height}px;"
    >
    <!-- Drag Handle -->
    <div class="drag-handle" role="button" tabindex="0" on:mousedown={onDragStart}></div>

    <!-- Resize Handle -->
    <div class="resize-handle" role="button" tabindex="0" on:mousedown={onResizeStart}></div>

    <div class="app-container">
      <!-- Close Button -->
      <button class="close-button" on:click={closePopup} title="Cerrar">
        ✕
      </button>

        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button
            class="tab {activeTab === 'guardia' ? 'active' : ''}"
            on:click={() => switchTab('guardia')}
          >
            G
          </button>
          <button
            class="tab {activeTab === 'patrullas' ? 'active' : ''}"
            on:click={() => switchTab('patrullas')}
          >
            P
          </button>
          <button
            class="tab {activeTab === 'admins' ? 'active' : ''}"
            on:click={() => switchTab('admins')}
          >
            A
          </button>
        </div>

        <!-- Content Area -->
        <div class="content-area">
          {#if activeTab === 'guardia'}
            <div class="header-banner">
              <h3
                class="title-editable"
                contenteditable="true"
                on:dblclick={(e) => e.target.focus()}
                on:blur={(e) => handleTitleChange(e, 'title')}
                bind:textContent={headerTitle}
              >
                {headerTitle}
              </h3>
              <p
                class="subtitle-editable"
                contenteditable="true"
                on:dblclick={(e) => e.target.focus()}
                on:blur={(e) => handleTitleChange(e, 'subtitle')}
                bind:textContent={headerSubtitle}
              >
                {headerSubtitle}
              </p>
            </div>
            <div class="guard-container">
              <div class="stats-and-modifiers-container">
                <StatsSection
                  {stats}
                  {editing}
                  {getTotalStatValue}
                  on:addStat={handlers.handleAddStat}
                  on:removeStat={handlers.handleRemoveStat}
                  on:updateStat={handlers.handleUpdateStat}
                  on:toggleEditing={handleToggleEditing}
                  on:imageClick={handlers.handleImageClick}
                  on:fileChange={handlers.handleFileChange}
                />

                <ModifiersSection
                  {modifiers}
                  {stats}
                  {editingMods}
                  on:addModifier={handlers.handleAddModifier}
                  on:removeModifier={handlers.handleRemoveModifier}
                  on:updateModifier={handlers.handleUpdateModifier}
                  on:toggleEditingMods={handleToggleEditingMods}
                  on:modImageClick={handlers.handleModImageClick}
                  on:newModImageClick={handlers.handleNewModImageClick}
                  on:modFileChange={handlers.handleModFileChange}
                />
              </div>

              <!-- Guard Sub-tabs -->
              <div class="guard-sub-tabs">
                <button
                  class="guard-sub-tab {activeGuardTab === 'reputation' ? 'active' : ''}"
                  on:click={() => switchGuardTab('reputation')}
                >
                  Reputación
                </button>
                <button
                  class="guard-sub-tab {activeGuardTab === 'resources' ? 'active' : ''}"
                  on:click={() => switchGuardTab('resources')}
                >
                  Recursos
                </button>
              </div>

              <!-- Reputation Tab -->
              {#if activeGuardTab === 'reputation'}
                <ReputationSection
                  {reputation}
                  {editingReputation}
                  {expandedReputationDetails}
                  on:toggleEditingReputation={handleToggleEditingReputation}
                  on:addReputation={handlers.handleAddReputation}
                  on:removeReputation={handlers.handleRemoveReputation}
                  on:updateReputation={handlers.handleUpdateReputation}
                  on:repImageClick={handlers.handleRepImageClick}
                  on:newRepImageClick={handlers.handleNewRepImageClick}
                  on:repFileChange={handlers.handleRepFileChange}
                  on:showReputationInChat={handlers.handleShowReputationInChat}
                  on:toggleReputationDetails={handlers.handleToggleReputationDetails}
                  on:reorderReputation={(e) => { console.log('🔗 GUARD INTERCEPTED reorderReputation:', e.detail); handlers.reorderReputation(e); }}
                />

              <!-- Resources Tab -->
              {:else if activeGuardTab === 'resources'}
                <ResourcesSection
                  {resources}
                  {editingResources}
                  {expandedResourceDetails}
                  on:toggleEditingResources={handleToggleEditingResources}
                  on:addResource={handlers.handleAddResource}
                  on:removeResource={handlers.handleRemoveResource}
                  on:updateResource={handlers.handleUpdateResource}
                  on:resImageClick={handlers.handleResImageClick}
                  on:newResImageClick={handlers.handleNewResImageClick}
                  on:resFileChange={handlers.handleResFileChange}
                  on:showResourceInChat={handlers.showResourceInChat}
                  on:reorderResources={(e) => { console.log('🔗 GUARD INTERCEPTED reorderResources:', e.detail); handlers.reorderResources(e); }}
                />
              {/if}
            </div>

          {:else if activeTab === 'patrullas'}
            <h3>Patrullas</h3>
            <Groups
              saveGroups={savePatrols}
              labels={{
                groupSingular: 'Patrol',
                addGroup: 'Add Patrol',
                removeGroup: 'Remove Patrol',
                officerDrop: 'Drag an officer here',
                soldierDrop: 'Drag soldiers here',
              }}
            />

          {:else if activeTab === 'admins'}
            <h3>Administración</h3>
            <Groups
              saveGroups={saveAdmins}
              labels={{
                groupSingular: 'Admin',
                addGroup: 'Add Admin',
                removeGroup: 'Remove Admin',
                officerDrop: 'Drag a leader here',
                soldierDrop: 'Drag members here',
              }}
            />
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
