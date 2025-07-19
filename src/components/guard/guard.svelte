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
  import { MODULE_ID, SETTING_MODIFIERS, SETTING_REPUTATION, SETTING_RESOURCES, SETTING_STATS } from '@/constants';
  import type { GuardModifier, GuardReputation, GuardResource, GuardStat } from '@/guard/stats';
  import {
    getModifiers,
    getReputation,
    getResources,
    getStats,
  } from '@/guard/stats';
  import { getPatrols, savePatrols } from '@/patrol/patrols';
  import { openResourceEditDialog } from '@/utils/dialog-manager';
  import PopupFocusManager from '@/utils/popup-focus';
  import { SyncManager } from '@/utils/sync';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { GuardHandlers } from './guard-handlers';
  import './guard.css';
  import ModifiersSection from './modifiers-section.svelte';
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
      case 'patrolEffect':
        applyPatrolEffectPreset(preset);
        break;
      case 'situationalModifier':
        applySituationalModifierPreset(preset);
        break;
      default:
        console.warn('Unknown preset type:', preset.type);
    }
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

  function applyPatrolEffectPreset(preset: any) {
    // Activar modo de aplicación de modificador temporal
    const event = new CustomEvent('crow-nest-apply-patrol-effect', {
      detail: {
        presetId: preset.data.sourceId || preset.id, // Use sourceId for consistency, fallback to id
        name: preset.data.name,
        description: preset.data.description || '',
        statEffects: preset.data.statEffects,
        sourceId: preset.data.sourceId // Also pass sourceId directly
      }
    });

    window.dispatchEvent(event);

    // Mostrar notificación para indicar que haga clic en un grupo
    ui.notifications?.info(`Modificador temporal "${preset.data.name}" listo. Haz clic en un grupo para aplicarlo.`);
  }

  function applySituationalModifierPreset(preset: any) {
    const presetKey = preset.data.sourceId; // Use the sourceId from the preset

    // Check if a modifier with this preset ID already exists
    const existingModifier = modifiers.find(m => m.key === presetKey || m.sourceId === presetKey);
    if (existingModifier) {
      // Update existing modifier instead of creating duplicate
      existingModifier.name = preset.data.name;
      existingModifier.description = preset.data.description || '';
      existingModifier.img = preset.data.img || 'icons/svg/upgrade.svg';
      existingModifier.mods = preset.data.statEffects || {};
      existingModifier.sourceId = preset.data.sourceId; // Preserve sourceId

      // Determine state based on stat effects
      const totalEffect = Object.values(existingModifier.mods).reduce((sum: number, value: number) => sum + value, 0);
      existingModifier.state = totalEffect > 0 ? 'positive' : totalEffect < 0 ? 'negative' : 'neutral';

      modifiers = [...modifiers]; // Trigger reactivity
      handlers.handleUpdateModifier();
      return;
    }

    // Create new modifier
    const newModifier = {
      key: presetKey, // Use the sourceId from the preset for consistency
      name: preset.data.name,
      description: preset.data.description || '',
      img: preset.data.img || 'icons/svg/upgrade.svg',
      mods: preset.data.statEffects || {},
      sourceId: preset.data.sourceId, // Preserve sourceId
      state: (() => {
        const totalEffect = Object.values(preset.data.statEffects || {}).reduce((sum: number, value) => sum + (Number(value) || 0), 0);
        return totalEffect > 0 ? 'positive' : totalEffect < 0 ? 'negative' : 'neutral';
      })() as 'positive' | 'neutral' | 'negative'
    };

    modifiers = [...modifiers, newModifier];
    handlers.handleUpdateModifier();
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

    // Initialize focus manager
    focusManager = PopupFocusManager.getInstance();

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

    // Listen for preset usage events
    window.addEventListener('crow-nest-use-preset', handleUsePreset);

    // Preset manager integration removed - now handled by unified components
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

    // Remove preset listeners
    window.removeEventListener('crow-nest-use-preset', handleUsePreset);
    // Preset manager integration removed - now handled by unified components
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
                <UnifiedReputation
                  title="Reputación"
                  editingReputations={editingReputation}
                  expandedReputationDetails={expandedReputationDetails}
                  on:toggleEditingReputations={handleToggleEditingReputation}
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
                  title="Recursos"
                  editingResources={editingResources}
                  expandedResourceDetails={expandedResourceDetails}
                  on:toggleEditingResources={handleToggleEditingResources}
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
  guardModifiers={modifiers}
  on:close={closeRollDialog}
/>

<!-- Global dialogs are managed by dialog-manager in main.ts -->
