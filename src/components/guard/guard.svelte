<script context="module" lang="ts">
  // FilePicker is provided by Foundry at runtime
  declare const FilePicker: any;
</script>

<script lang="ts">
  import { getAdmins, saveAdmins } from '@/admin/admins';
  import Groups from '@/components/groups/groups.svelte';
  import StatsSection from './stats-section.svelte';
  import ModifiersSection from './modifiers-section.svelte';
  import ReputationSection from './reputation-section.svelte';
  import ResourcesSection from './resources-section.svelte';
  import { MODULE_ID, SETTING_LOG, SETTING_MODIFIERS, SETTING_REPUTATION, SETTING_RESOURCES, SETTING_STATS } from '@/constants';
  import type { GuardModifier, GuardReputation, GuardResource, GuardStat, LogEntry } from '@/guard/stats';
  import {
    getLog,
    getModifiers,
    getReputation,
    getResources,
    getStats,
    saveModifiers,
    saveReputation,
    saveResources,
    saveStats,
  } from '@/guard/stats';
  import { getPatrols, savePatrols } from '@/patrol/patrols';
  import { SyncManager, type SyncEvent } from '@/utils/sync';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import './guard.css';

  // Props for controlling the popup
  export let showPopup = false;

  const dispatch = createEventDispatcher();

  interface Stat extends GuardStat {}

  let stats: Stat[] = [];
  let log: LogEntry[] = [];
  let showLog = false;
  let editing = false;

  let modifiers: GuardModifier[] = [];
  let editingMods = false;

  let resources: GuardResource[] = [];
  let editingResources = false;

  let reputation: GuardReputation[] = [];
  let editingReputation = false;
  let expandedReputationDetails: Record<string, boolean> = {};

  // Tab system - Load last active tab from localStorage
  let activeTab: 'guardia' | 'patrullas' | 'admins' = (localStorage.getItem('crow-nest-active-tab') as 'guardia' | 'patrullas' | 'admins') || 'guardia';
  
  // Guard sub-tab system - Load last active guard sub-tab from localStorage
  let activeGuardTab: 'reputation' | 'resources' = (localStorage.getItem('crow-nest-guard-subtab') as 'reputation' | 'resources') || 'reputation';

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
    log = getLog();
    modifiers = getModifiers();
    sortModifiersByState(); // Sort modifiers on initial load
    resources = getResources();
    reputation = getReputation();
    patrols = getPatrols();
    admins = getAdmins();

    // Setup real-time synchronization
    syncManager = SyncManager.getInstance();

    // Listen for different types of updates
    syncManager.subscribe('stats', handleStatsSync);
    syncManager.subscribe('modifiers', handleModifiersSync);
    syncManager.subscribe('resources', handleResourcesSync);
    syncManager.subscribe('reputation', handleReputationSync);
    syncManager.subscribe('patrols', handlePatrolsSync);
    syncManager.subscribe('admins', handleAdminsSync);

    // Also listen for direct game settings changes as backup
    Hooks.on('updateSetting', (setting: any) => {
      if (setting.key === `${MODULE_ID}.${SETTING_STATS}`) {
        stats = setting.value || [];
      }

      if (setting.key === `${MODULE_ID}.${SETTING_LOG}`) {
        log = setting.value || [];
      }

      if (setting.key === `${MODULE_ID}.${SETTING_MODIFIERS}`) {
        modifiers = setting.value || [];
        sortModifiersByState(); // Sort modifiers when loaded from settings
      }

      if (setting.key === `${MODULE_ID}.${SETTING_RESOURCES}`) {
        resources = setting.value || [];
      }

      if (setting.key === `${MODULE_ID}.${SETTING_REPUTATION}`) {
        reputation = setting.value || [];
      }

      if (setting.key === `${MODULE_ID}.patrols`) {
        patrols = setting.value || [];
      }

      if (setting.key === `${MODULE_ID}.admins`) {
        admins = setting.value || [];
      }
    });
  });

  onDestroy(() => {
    if (syncManager) {
      syncManager.unsubscribe('stats', handleStatsSync);
      syncManager.unsubscribe('modifiers', handleModifiersSync);
      syncManager.unsubscribe('resources', handleResourcesSync);
      syncManager.unsubscribe('reputation', handleReputationSync);
      syncManager.unsubscribe('patrols', handlePatrolsSync);
      syncManager.unsubscribe('admins', handleAdminsSync);
    }
  });

  // Sync event handlers
  function handleStatsSync(event: SyncEvent) {
    if (event.type === 'stats' && event.data) {
      stats = event.data.stats || getStats();
      log = event.data.log || getLog();
    }
  }

  function handleModifiersSync(event: SyncEvent) {
    if (event.type === 'modifiers') {
      modifiers = event.data || getModifiers();
      sortModifiersByState(); // Sort modifiers when received from sync
    }
  }

  function handleResourcesSync(event: SyncEvent) {
    if (event.type === 'resources') {
      resources = event.data || getResources();
    }
  }

  function handleReputationSync(event: SyncEvent) {
    if (event.type === 'reputation') {
      reputation = event.data || getReputation();
    }
  }

  function handlePatrolsSync(event: SyncEvent) {
    if (event.type === 'patrols') {
      patrols = event.data || getPatrols();
    }
  }

  function handleAdminsSync(event: SyncEvent) {
    if (event.type === 'admins') {
      admins = event.data || getAdmins();
    }
  }

  async function persist() {
    if (game.user?.isGM) {
      await saveStats(stats, log);
    }
  }

  async function persistMods() {
    if (game.user?.isGM) {
      await saveModifiers(modifiers);
    }
  }

  async function persistRes() {
    if (game.user?.isGM) {
      await saveResources(resources);
    }
  }

  async function persistRep() {
    if (game.user?.isGM) {
      await saveReputation(reputation);
    }
  }

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

  // Event handlers for child components
  function handleAddStat(event: CustomEvent) {
    const newStat = event.detail;
    stats = [...stats, { ...newStat }];
    log = [
      ...log,
      {
        user: game.user?.name ?? 'unknown',
        time: Date.now(),
        action: `create ${newStat.key}`,
        next: { ...newStat },
      },
    ];
    persist();
  }

  function handleRemoveStat(event: CustomEvent) {
    const index = event.detail;
    const [removed] = stats.splice(index, 1);
    stats = [...stats];
    log = [
      ...log,
      {
        user: game.user?.name ?? 'unknown',
        time: Date.now(),
        action: `delete ${removed.key}`,
        previous: removed,
      },
    ];
    persist();
  }

  function handleUpdateStat() {
    log = [
      ...log,
      {
        user: game.user?.name ?? 'unknown',
        time: Date.now(),
        action: 'edit',
      },
    ];
    stats = [...stats];
    persist();
  }

  function handleToggleEditing() {
    editing = !editing;
  }

  function handleToggleLog() {
    showLog = !showLog;
  }

  function handleImageClick(event: CustomEvent) {
    const stat = event.detail;
    if (editing) {
      if (typeof FilePicker !== 'undefined') {
        // @ts-ignore - FilePicker is provided by Foundry at runtime
        new FilePicker({
          type: 'image',
          current: stat.img,
          callback: (path: string) => {
            stat.img = path;
            handleUpdateStat();
          },
        }).render(true);
      }
    } else {
      const bonus = modifiers.reduce(
        (acc, m) => acc + (m.mods[stat.key] || 0),
        0
      );
      const r = new Roll(`1d20 + ${stat.value + bonus}`);
      r.evaluate();

      const lines: string[] = [];
      for (const m of modifiers) {
        const v = m.mods[stat.key];
        if (v) lines.push(`${m.name} ${v > 0 ? '+' : ''}${v}`);
      }

      const flavor = [stat.name, ...lines].join('<br/>');
      r.toMessage({ speaker: { alias: 'La Guardia' }, flavor });
    }
  }

  function handleFileChange(event: CustomEvent) {
    const { stat, event: fileEvent } = event.detail;
    const input = fileEvent.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      stat.img = String(reader.result);
      handleUpdateStat();
    };
    reader.readAsDataURL(input.files[0]);
  }

  // Modifier event handlers
  function handleAddModifier(event: CustomEvent) {
    const newModifier = event.detail;
    newModifier.mods = Object.fromEntries(
      Object.entries(newModifier.mods).filter(([, v]) => Number(v) !== 0)
    );
    modifiers = [...modifiers, { ...newModifier }];
    sortModifiersByState();
    persistMods();
  }

  function handleRemoveModifier(event: CustomEvent) {
    const index = event.detail;
    modifiers.splice(index, 1);
    modifiers = [...modifiers];
    persistMods();
  }

  function handleUpdateModifier() {
    modifiers = modifiers.map((m) => ({
      ...m,
      state: m.state || 'neutral',
      mods: Object.fromEntries(
        Object.entries(m.mods).filter(([, v]) => Number(v) !== 0)
      ),
    }));
    sortModifiersByState();
    persistMods();
  }

  function handleToggleEditingMods() {
    editingMods = !editingMods;
    if (!editingMods) {
      sortModifiersByState();
    }
  }

  function handleModImageClick(event: CustomEvent) {
    const mod = event.detail;
    if (editingMods) {
      if (typeof FilePicker !== 'undefined') {
        // @ts-ignore - FilePicker is provided by Foundry at runtime
        new FilePicker({
          type: 'image',
          current: mod.img,
          callback: (path: string) => {
            mod.img = path;
            handleUpdateModifier();
          },
        }).render(true);
      }
    }
  }

  function handleNewModImageClick(event: CustomEvent) {
    const newModifier = event.detail;
    if (typeof FilePicker !== 'undefined') {
      // @ts-ignore - FilePicker is provided by Foundry at runtime
      new FilePicker({
        type: 'image',
        current: newModifier.img,
        callback: (path: string) => {
          newModifier.img = path;
        },
      }).render(true);
    }
  }

  function handleModFileChange(event: CustomEvent) {
    const { mod, event: fileEvent } = event.detail;
    const input = fileEvent.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      mod.img = String(reader.result);
      handleUpdateModifier();
    };
    reader.readAsDataURL(input.files[0]);
  }

  // Reputation event handlers
  function handleToggleEditingReputation() {
    editingReputation = !editingReputation;
  }

  function handleAddReputation(event: CustomEvent) {
    const newReputation = event.detail;
    reputation = [...reputation, { ...newReputation }];
    persistRep();
  }

  function handleRemoveReputation(event: CustomEvent) {
    const index = event.detail;
    reputation.splice(index, 1);
    reputation = [...reputation];
    persistRep();
  }

  function handleUpdateReputation() {
    reputation = [...reputation];
    persistRep();
  }

  function handleRepImageClick(event: CustomEvent) {
    const rep = event.detail;
    if (editingReputation) {
      if (typeof FilePicker !== 'undefined') {
        // @ts-ignore - FilePicker is provided by Foundry at runtime
        new FilePicker({
          type: 'image',
          current: rep.img,
          callback: (path: string) => {
            rep.img = path;
            handleUpdateReputation();
          },
        }).render(true);
      }
    } else {
      showReputationInChat(rep);
    }
  }

  function handleNewRepImageClick(event: CustomEvent) {
    const newReputation = event.detail;
    if (typeof FilePicker !== 'undefined') {
      // @ts-ignore - FilePicker is provided by Foundry at runtime
      new FilePicker({
        type: 'image',
        current: newReputation.img,
        callback: (path: string) => {
          newReputation.img = path;
        },
      }).render(true);
    }
  }

  function handleRepFileChange(event: CustomEvent) {
    const { rep, event: fileEvent } = event.detail;
    const input = fileEvent.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      rep.img = String(reader.result);
      handleUpdateReputation();
    };
    reader.readAsDataURL(input.files[0]);
  }

  function handleShowReputationInChat(event: CustomEvent) {
    showReputationInChat(event.detail);
  }

  function handleToggleReputationDetails(event: CustomEvent) {
    const repKey = event.detail;
    expandedReputationDetails[repKey] = !expandedReputationDetails[repKey];
    expandedReputationDetails = { ...expandedReputationDetails };
  }

  // Resource event handlers
  function handleToggleEditingResources() {
    editingResources = !editingResources;
  }

  function handleAddResource(event: CustomEvent) {
    const newResource = event.detail;
    resources = [...resources, { ...newResource }];
    persistRes();
  }

  function handleRemoveResource(event: CustomEvent) {
    const index = event.detail;
    resources.splice(index, 1);
    resources = [...resources];
    persistRes();
  }

  function handleUpdateResource() {
    resources = [...resources];
    persistRes();
  }

  function handleResImageClick(event: CustomEvent) {
    const res = event.detail;
    const input = document.getElementById(`res-file-${res.key}`) as HTMLInputElement | null;
    input?.click();
  }

  function handleResFileChange(event: CustomEvent) {
    const { res, event: fileEvent } = event.detail;
    const input = fileEvent.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      res.img = String(reader.result);
      handleUpdateResource();
    };
    reader.readAsDataURL(input.files[0]);
  }

  function showReputationInChat(rep: GuardReputation) {
    if (editingReputation) return; // No mostrar en modo edición

    // Calcular el color basado en el valor de reputación (0-10)
    const hue = (rep.value / 10) * 120; // De rojo (0) a verde (120)
    const reputationColor = `hsl(${hue}, 70%, 50%)`;

    // Crear barras de progreso visual
    const totalBars = 10;
    const filledBars = Math.floor(rep.value);
    const progressBars = Array(totalBars).fill(0).map((_, i) => {
      if (i < filledBars) {
        return `<span style="color: ${reputationColor};">█</span>`;
      } else {
        return `<span style="color: #444;">█</span>`;
      }
    }).join('');

    // Agregar detalles si existen
    const detailsSection = rep.details && rep.details.trim()
      ? `<div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid ${reputationColor}; font-style: italic; color: #000;">${rep.details}</div>`
      : '';

    const content = `
      <div style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem; border: 2px solid ${reputationColor}; border-radius: 8px; background: rgba(0,0,0,0.1);">
        <img src="${rep.img || 'icons/svg/aura.svg'}" alt="${rep.name}" style="width: 64px; height: 64px; object-fit: cover; border-radius: 8px; border: 2px solid ${reputationColor};" />
        <div style="flex: 1;">
          <h3 style="margin: 0 0 0.5rem 0; color: ${reputationColor}; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${rep.name}</h3>
          <div style="font-family: monospace; font-size: 1.2em; letter-spacing: 1px; color: #000;">${progressBars}</div>
          ${detailsSection}
        </div>
      </div>
    `;

    // Enviar mensaje al chat
    ChatMessage.create({
      speaker: { alias: 'Los Cuervos - Reputación' },
      content: content,
      whisper: null // Mensaje público
    });
  }
</script>

{#if showPopup}
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
            <h3>Los Cuervos</h3>
            <div class="guard-container">
              <div class="stats-and-modifiers-container">
                <StatsSection 
                  {stats} 
                  {log} 
                  {editing} 
                  {showLog} 
                  {getTotalStatValue}
                  on:addStat={handleAddStat}
                  on:removeStat={handleRemoveStat}
                  on:updateStat={handleUpdateStat}
                  on:toggleEditing={handleToggleEditing}
                  on:toggleLog={handleToggleLog}
                  on:imageClick={handleImageClick}
                  on:fileChange={handleFileChange}
                />

                <ModifiersSection 
                  {modifiers} 
                  {stats} 
                  {editingMods}
                  on:addModifier={handleAddModifier}
                  on:removeModifier={handleRemoveModifier}
                  on:updateModifier={handleUpdateModifier}
                  on:toggleEditingMods={handleToggleEditingMods}
                  on:modImageClick={handleModImageClick}
                  on:newModImageClick={handleNewModImageClick}
                  on:modFileChange={handleModFileChange}
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
                  on:addReputation={handleAddReputation}
                  on:removeReputation={handleRemoveReputation}
                  on:updateReputation={handleUpdateReputation}
                  on:repImageClick={handleRepImageClick}
                  on:newRepImageClick={handleNewRepImageClick}
                  on:repFileChange={handleRepFileChange}
                  on:showReputationInChat={handleShowReputationInChat}
                  on:toggleReputationDetails={handleToggleReputationDetails}
                />

              <!-- Resources Tab -->
              {:else if activeGuardTab === 'resources'}
                <ResourcesSection 
                  {resources} 
                  {editingResources}
                  on:toggleEditingResources={handleToggleEditingResources}
                  on:addResource={handleAddResource}
                  on:removeResource={handleRemoveResource}
                  on:updateResource={handleUpdateResource}
                  on:resImageClick={handleResImageClick}
                  on:resFileChange={handleResFileChange}
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
{/if}
