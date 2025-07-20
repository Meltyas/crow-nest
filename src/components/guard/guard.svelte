<script context="module" lang="ts">
  // FilePicker and game are provided by Foundry at runtime
  declare const FilePicker: any;
  declare const game: any;
</script>

<script lang="ts">
  // FilePicker and game are provided by Foundry at runtime
  declare const FilePicker: any;
  declare const game: any;

  import { getAdmins, saveAdmins } from '@/admin/admins';
  import Groups from '@/components/groups/groups.svelte';
  import RollDialogStandalone from '@/components/roll-dialog/roll-dialog-standalone.svelte';
  import UnifiedReputation from '@/components/unified/unified-reputation.svelte';
  import UnifiedResources from '@/components/unified/unified-resources.svelte';
  import UnifiedSituationalModifiers from '@/components/unified/unified-situational-modifiers.svelte';
  import { MODULE_ID, SETTING_REPUTATION, SETTING_RESOURCES, SETTING_STATS } from '@/constants';
  import type { GuardReputation, GuardResource, GuardStat } from '@/guard/stats';
  import {
    getReputation,
    getResources,
    getStats,
  } from '@/guard/stats';
  import { getPatrols, savePatrols } from '@/patrol/patrols';
  import { presetsStore } from '@/stores/presets';
  import { openResourceEditDialog } from '@/utils/dialog-manager';
  import PopupFocusManager from '@/utils/popup-focus';
  import { SyncManager } from '@/utils/sync';
  import { Subject } from 'rxjs';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { GuardHandlers } from './guard-handlers';
  import './guard.css';
  import StatsSection from './stats-section.svelte';

  // Foundry globals
  const game = (globalThis as any).game;

  // Props for controlling the popup
  export let showPopup = false;

  const dispatch = createEventDispatcher();

  interface Stat extends GuardStat {}

  let stats: Stat[] = [];
  let editing = false;

  let resources: GuardResource[] = [];
  let editingResources = false;

  let reputation: GuardReputation[] = [];
  let editingReputation = false;
  let expandedReputationDetails: Record<string, boolean> = {};
  let expandedResourceDetails: Record<string, boolean> = {};
  let expandedSituationalModifierDetails: Record<string, boolean> = {};

  // Roll dialog state
  let rollDialogOpen = false;
  let rollDialogStat: GuardStat | null = null;
  let rollDialogBaseValue = 0;
  let rollDialogTotalModifier = 0;

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

  // RxJS cleanup subject
  const destroy$ = new Subject<void>();
  const componentId = 'guard-' + Math.random().toString(36).substr(2, 9);

  // Focus manager
  let focusManager: PopupFocusManager;

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

  async function openPresets() {
    // Import and use preset manager dynamically to open preset popup
    const { presetManager } = await import('@/components/presets/preset-manager');
    presetManager.showPresetPopup();
  }

  function handleUsePreset(event: Event) {
    const customEvent = event as CustomEvent;
    const preset = customEvent.detail;

    switch (preset.type) {
      case 'resource':
        applyResourcePreset(preset);
        break;
      case 'reputation':
        applyReputationPreset(preset);
        break;
      case 'situationalModifier':
        // Situational modifiers are now handled by the unified system
        console.log('Guard - Situational modifier preset applied via unified system:', preset.data.name);
        ui.notifications?.info(`Modificador situacional "${preset.data.name}" aplicado.`);
        break;
      default:
        console.warn('Unknown preset type:', preset.type);
    }
  }

  function handleApplySituationalModifier(event: Event) {
    const customEvent = event as CustomEvent;
    const { situationalModifier } = customEvent.detail;

    console.log('Guard - Situational modifier applied from preset manager:', situationalModifier);

    // The situational modifier is already active in the presets system,
    // so it should automatically appear in the UnifiedSituationalModifiers component
    // and affect the getTotalStatValue calculation

    // Show success notification
    if (typeof ui !== 'undefined' && ui.notifications) {
      ui.notifications.info(`Modificador situacional "${situationalModifier.name}" añadido al guard.`);
    }
  }

  function handleEditSituationalModifier(event: Event) {
    const customEvent = event as CustomEvent;
    const situationalModifier = customEvent.detail;

    console.log('Guard - Editing situational modifier:', situationalModifier);

    // Use the global dialog system for editing
    const modifierForDialog = {
      id: situationalModifier.id,
      name: situationalModifier.name || '',
      description: situationalModifier.description || '',
      statEffects: situationalModifier.statEffects || {},
      img: situationalModifier.img || 'icons/svg/upgrade.svg',
      sourceId: situationalModifier.sourceId || situationalModifier.id
    };

    // Import and open the global dialog
    import('@/utils/dialog-manager').then(({ openSituationalModifierEditDialog }) => {
      openSituationalModifierEditDialog(modifierForDialog, false); // Pass false for guard context
    });
  }

  function applyResourcePreset(preset: any) {
    const presetKey = preset.data.sourceId; // Usar el sourceId del preset en lugar de preset.id

    // Verificar si ya existe un recurso con este preset ID
    const existingResource = resources.find(r => r.key === presetKey);
    if (existingResource) {
      ui.notifications?.warn(`El recurso "${preset.data.name}" ya existe.`);
      return;
    }

    const newResource = {
      key: presetKey, // Usar el sourceId del preset para mantener consistencia
      name: preset.data.name,
      value: preset.data.value,
      img: preset.data.img || 'icons/svg/chest.svg',
      details: preset.data.description || '',
      sourceId: preset.data.sourceId // Mantener referencia al sourceId original
    };

    resources = [...resources, newResource];
    handlers.handleUpdateResource();
  }

  function applyReputationPreset(preset: any) {
    const presetKey = preset.data.sourceId; // Usar el sourceId del preset en lugar de preset.id

    // Verificar si ya existe una reputación con este preset ID
    const existingReputation = reputation.find(r => r.key === presetKey);
    if (existingReputation) {
      ui.notifications?.warn(`La reputación "${preset.data.name}" ya existe.`);
      return;
    }

    const newReputation = {
      key: presetKey, // Usar el sourceId del preset para mantener consistencia
      name: preset.data.name,
      value: preset.data.value,
      img: preset.data.img || 'icons/svg/tower.svg',
      details: preset.data.description || '',
      sourceId: preset.data.sourceId // Mantener referencia al sourceId original
    };

    reputation = [...reputation, newReputation];
    handlers.handleUpdateReputation();
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
    resources = getResources();
    reputation = getReputation();
    patrols = getPatrols();
    admins = getAdmins();

    // Initialize handlers
    handlers = new GuardHandlers(updateComponentData);

    // Setup real-time synchronization with RxJS
    syncManager = SyncManager.getInstance();

    // Initialize focus manager
    focusManager = PopupFocusManager.getInstance();

    // RxJS SUBSCRIPTIONS - Optimized subscription management
    console.log('Guard - Setting up RxJS subscriptions for componentId:', componentId);

    // Helper function to create sync handlers - DRY principle
    const createSyncHandler = (type: string, handlerMethod: Function) => (data: any) => {
      if (data && handlers) {
        handlerMethod.call(handlers, {
          type,
          action: 'update',
          data,
          timestamp: Date.now(),
          user: 'rxjs-sync'
        });
      }
    };

    // Batch subscription setup - more maintainable
    const subscriptions = [
      { type: 'stats', handler: handlers.handleStatsSync },
      { type: 'resources', handler: handlers.handleResourcesSync },
      { type: 'reputation', handler: handlers.handleReputationSync },
      { type: 'groups', handler: handlers.handlePatrolsSync },
      { type: 'adminData', handler: handlers.handleAdminsSync }
    ];

    // Note: 'modifiers' intentionally excluded - not in SyncManager dataType union
    subscriptions.forEach(({ type, handler }) => {
      syncManager.subscribeToDataType(type as any, componentId, createSyncHandler(type, handler));
    });

    // Update handlers with initial data
    updateHandlersData();

    // Also listen for direct game settings changes as backup
    Hooks.on('updateSetting', (setting: any) => {
      if (setting.key === `${MODULE_ID}.${SETTING_STATS}`) {
        stats = setting.value || [];
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

    // Listen for preset usage events
    window.addEventListener('crow-nest-use-preset', handleUsePreset);

    // Listen for situational modifier application from preset manager
    window.addEventListener('crow-nest-apply-situational-modifier', handleApplySituationalModifier);

    // Preset manager integration removed - now handled by unified components
  });

  onDestroy(() => {
    // RxJS CLEANUP - Single cleanup call
    console.log('Guard - Cleaning up RxJS subscriptions for componentId:', componentId);

    syncManager?.cleanupComponent(componentId);

    // Complete the destroy subject
    destroy$.next();
    destroy$.complete();

    // Remove preset listeners
    window.removeEventListener('crow-nest-use-preset', handleUsePreset);
    window.removeEventListener('crow-nest-apply-situational-modifier', handleApplySituationalModifier);
  });

  function getTotalStatValue(stat: Stat): number {
    // Get active situational modifiers for guard (global ones without groupId)
    const activeSituationalModifiers = $presetsStore.situationalModifiers.filter(m => !m.groupId && m.active);

    // Calculate bonus from active situational modifiers
    const modifierBonus = activeSituationalModifiers.reduce((acc, m) => {
      const statEffect = m.statEffects[stat.key];
      return acc + (statEffect ? Number(statEffect) : 0);
    }, 0);

    return stat.value + modifierBonus;
  }

  // Update handlers with current component data
  function updateHandlersData() {
    if (handlers) {
      handlers.updateData({
        stats,
        resources,
        reputation,
        patrols,
        admins,
        editing,
        editingResources,
        editingReputation,
        expandedReputationDetails,
        expandedResourceDetails,
        expandedSituationalModifierDetails,
      });
    }
  }

  // Update component data from handlers
  function updateComponentData() {
    if (handlers) {
      const data = handlers.getData();
      stats = data.stats;
      resources = data.resources;
      reputation = data.reputation;
      patrols = data.patrols;
      admins = data.admins;
      expandedReputationDetails = data.expandedReputationDetails;
      expandedResourceDetails = data.expandedResourceDetails;
      expandedSituationalModifierDetails = data.expandedSituationalModifierDetails;
    }
  }

  // Toggle state handlers (these stay local as they're simple state changes)
  function handleToggleEditing() {
    editing = !editing;
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

  // Roll dialog functions
  function openRollDialog(stat: GuardStat) {
    rollDialogStat = stat;
    rollDialogBaseValue = stat.value;
    rollDialogTotalModifier = getTotalStatValue(stat) - stat.value; // This gives us just the modifier part
    rollDialogOpen = true;
  }

  function closeRollDialog() {
    rollDialogOpen = false;
    rollDialogStat = null;
  }

  // Resource edit dialog functions - using global dialog manager
  function handleEditResource(event: CustomEvent) {
    const { resource } = event.detail;
    openResourceEditDialog(resource);
  }

  // Create a mock group for Guard stats (since Guard doesn't have experiences or hope)
  function createGuardGroup() {
    return {
      id: 'guard-mock',
      name: 'The Guard',
      hope: 0,
      fear: 0,
      experiences: [],
      mods: {},
      members: [],
      officer: null,
      skills: []
    };
  }
</script>

{#if showPopup}
  <div class="crow-nest-guard">
    <div
      class="custom-popup"
      style="transform: translate({popupPosition.x}px, {popupPosition.y}px); width: {popupSize.width}px; height: {popupSize.height}px;"
      on:focus={(e) => focusManager?.setFocus(e.currentTarget)}
      on:blur={(e) => {}}
      on:mousedown={(e) => focusManager?.setFocus(e.currentTarget)}
      tabindex="-1"
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
          {#if game?.user?.isGM}
            <button
              class="preset-button"
              on:click={openPresets}
              title="Abrir Presets"
            >
              📋
            </button>
          {/if}
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
                  on:rollStat={(e) => openRollDialog(e.detail)}
                />

                <UnifiedSituationalModifiers
                  title="Modificadores Situacionales"
                  groupId={undefined}
                  expandedSituationalModifierDetails={expandedSituationalModifierDetails}
                  inPresetManager={false}
                  displayMode="groups"
                  on:crow-nest-apply-situational-modifier={handleApplySituationalModifier}
                  on:editSituationalModifier={handleEditSituationalModifier}
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
                <UnifiedReputation
                  groupId={undefined}
                  title="Reputación"
                  expandedReputationDetails={expandedReputationDetails}
                  inPresetManager={false}
                  on:updateReputation={handlers.handleUpdateReputation}
                  on:repImageClick={handlers.handleRepImageClick}
                  on:newRepImageClick={handlers.handleNewRepImageClick}
                  on:repFileChange={handlers.handleRepFileChange}
                  on:showReputationInChat={handlers.handleShowReputationInChat}
                  on:reorderReputations={(e) => { handlers.reorderReputation(e); }}
                />

              <!-- Resources Tab -->
              {:else if activeGuardTab === 'resources'}
                <UnifiedResources
                  groupId={undefined}
                  title="Recursos"
                  expandedResourceDetails={expandedResourceDetails}
                  inPresetManager={false}
                  on:updateResource={handlers.handleUpdateResource}
                  on:resImageClick={handlers.handleResImageClick}
                  on:newResImageClick={handlers.handleNewResImageClick}
                  on:resFileChange={handlers.handleResFileChange}
                  on:showResourceInChat={handlers.showResourceInChat}
                  on:reorderResources={(e) => { handlers.reorderResources(e); }}
                  on:editResource={handleEditResource}
                />
              {/if}
            </div>

          {:else if activeTab === 'patrullas'}
            <Groups
              sectionTitle="PATRULLAS"
              sectionImage="icons/svg/pawprint.svg"
              saveGroups={savePatrols}
              labels={{
                groupSingular: 'Patrol',
                addGroup: 'Add Patrol',
                removeGroup: 'Remove Patrol',
                officerDrop: 'Drag an officer here',
                soldierDrop: 'Drag units here',
              }}
            />

          {:else if activeTab === 'admins'}
            <Groups
              sectionTitle="ADMINISTRACIÓN"
              sectionImage="icons/svg/castle.svg"
              isAdminMode={true}
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

<!-- Roll Dialog Component - Independent from popup -->
<RollDialogStandalone
  bind:isOpen={rollDialogOpen}
  stat={rollDialogStat}
  group={createGuardGroup()}
  baseValue={rollDialogBaseValue}
  totalModifier={rollDialogTotalModifier}
  guardModifiers={$presetsStore.situationalModifiers
    .filter(m => !m.groupId && m.active)
    .map(m => ({
      key: m.id,
      name: m.name,
      description: m.description,
      img: m.img,
      state: 'neutral',
      mods: m.statEffects || {},
      sourceId: m.sourceId
    }))}
  on:close={closeRollDialog}
/>

<!-- Global dialogs are managed by dialog-manager in main.ts -->
