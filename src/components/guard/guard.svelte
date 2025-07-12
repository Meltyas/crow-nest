<script context="module" lang="ts">
  // FilePicker is provided by Foundry at runtime
  declare const FilePicker: any;
</script>

<script lang="ts">
  import { getAdmins, saveAdmins } from '@/admin/admins';
  import Groups from '@/components/groups/groups.svelte';
  import Tooltip from '@/components/tooltip.svelte';
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

  // Props for controlling the popup
  export let showPopup = false;

  const dispatch = createEventDispatcher();

  interface Stat extends GuardStat {}

  let stats: Stat[] = [];
  let log: LogEntry[] = [];
  let showLog = false;
  let addingStat = false;
  let editing = false;
  let newStat: Stat = { key: '', name: '', value: 0 };

  let modifiers: GuardModifier[] = [];
  let addingModifier = false;
  let editingMods = false;
  let newModifier: GuardModifier = { key: '', name: '', description: '', mods: {}, state: 'neutral', img: 'icons/svg/upgrade.svg' };

  let resources: GuardResource[] = [];
  let addingResource = false;
  let editingResources = false;
  let newResource: GuardResource = { key: '', name: '', value: 0 };

  let reputation: GuardReputation[] = [];
  let addingReputation = false;
  let editingReputation = false;
  let newReputation: GuardReputation = { key: '', name: '', value: 0, img: 'icons/svg/aura.svg', details: '' };
  let collapsedReputation = false;
  let collapsedResources = false;
  let expandedReputationDetails: Record<string, boolean> = {};

  // Tab system - Load last active tab from localStorage
  let activeTab: 'guardia' | 'patrullas' | 'admins' = (localStorage.getItem('crow-nest-active-tab') as 'guardia' | 'patrullas' | 'admins') || 'guardia';

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
    console.log("👂 Guard: Setting up sync subscriptions");
    syncManager.subscribe('stats', handleStatsSync);
    syncManager.subscribe('modifiers', handleModifiersSync);
    syncManager.subscribe('resources', handleResourcesSync);
    syncManager.subscribe('reputation', handleReputationSync);
    syncManager.subscribe('patrols', handlePatrolsSync);
    syncManager.subscribe('admins', handleAdminsSync);

    // Also listen for direct game settings changes as backup
    console.log("👂 Guard: Setting up game settings listener");
    Hooks.on('updateSetting', (setting: any) => {
      console.log("⚙️ Guard: Game setting changed", setting.key, setting.value);

      if (setting.key === `${MODULE_ID}.${SETTING_STATS}`) {
        console.log("📊 Guard: Stats setting changed, updating UI");
        stats = setting.value || [];
      }

      if (setting.key === `${MODULE_ID}.${SETTING_LOG}`) {
        console.log("📋 Guard: Log setting changed, updating UI");
        log = setting.value || [];
      }

      if (setting.key === `${MODULE_ID}.${SETTING_MODIFIERS}`) {
        console.log("🔧 Guard: Modifiers setting changed, updating UI");
        modifiers = setting.value || [];
        sortModifiersByState(); // Sort modifiers when loaded from settings
      }

      if (setting.key === `${MODULE_ID}.${SETTING_RESOURCES}`) {
        console.log("📦 Guard: Resources setting changed, updating UI");
        resources = setting.value || [];
      }

      if (setting.key === `${MODULE_ID}.${SETTING_REPUTATION}`) {
        console.log("🏆 Guard: Reputation setting changed, updating UI");
        reputation = setting.value || [];
      }

      if (setting.key === `${MODULE_ID}.patrols`) {
        console.log("👥 Guard: Patrols setting changed, updating UI");
        patrols = setting.value || [];
      }

      if (setting.key === `${MODULE_ID}.admins`) {
        console.log("⚙️ Guard: Admins setting changed, updating UI");
        admins = setting.value || [];
      }
    });

    console.log("✅ Guard: All sync setup complete");
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
    console.log("📊 Guard: Stats sync event received", event);
    if (event.type === 'stats' && event.data) {
      stats = event.data.stats || getStats();
      log = event.data.log || getLog();
      console.log("✅ Guard: Stats updated", stats.length, "stats,", log.length, "log entries");
    }
  }

  function handleModifiersSync(event: SyncEvent) {
    console.log("🔧 Guard: Modifiers sync event received", event);
    if (event.type === 'modifiers') {
      modifiers = event.data || getModifiers();
      sortModifiersByState(); // Sort modifiers when received from sync
      console.log("✅ Guard: Modifiers updated", modifiers.length, "modifiers");
    }
  }

  function handleResourcesSync(event: SyncEvent) {
    console.log("📦 Guard: Resources sync event received", event);
    if (event.type === 'resources') {
      resources = event.data || getResources();
      console.log("✅ Guard: Resources updated", resources.length, "resources");
    }
  }

  function handleReputationSync(event: SyncEvent) {
    console.log("🏆 Guard: Reputation sync event received", event);
    if (event.type === 'reputation') {
      reputation = event.data || getReputation();
      console.log("✅ Guard: Reputation updated", reputation.length, "reputation entries");
    }
  }

  function handlePatrolsSync(event: SyncEvent) {
    console.log("👥 Guard: Patrols sync event received", event);
    if (event.type === 'patrols') {
      patrols = event.data || getPatrols();
      console.log("✅ Guard: Patrols updated", patrols.length, "patrols");
    }
  }

  function handleAdminsSync(event: SyncEvent) {
    console.log("⚙️ Guard: Admins sync event received", event);
    if (event.type === 'admins') {
      admins = event.data || getAdmins();
      console.log("✅ Guard: Admins updated", admins.length, "admins");
    }
  }

  async function persist() {
    if (game.user?.isGM) {
      console.log("💾 Guard: Persisting stats as GM");
      await saveStats(stats, log);
    } else {
      console.log("🚫 Guard: Skipping stats persist - not GM");
    }
  }

  async function persistMods() {
    if (game.user?.isGM) {
      console.log("💾 Guard: Persisting modifiers as GM");
      await saveModifiers(modifiers);
    } else {
      console.log("🚫 Guard: Skipping modifiers persist - not GM");
    }
  }

  async function persistRes() {
    if (game.user?.isGM) {
      console.log("💾 Guard: Persisting resources as GM");
      await saveResources(resources);
    } else {
      console.log("🚫 Guard: Skipping resources persist - not GM");
    }
  }

  async function persistRep() {
    if (game.user?.isGM) {
      console.log("💾 Guard: Persisting reputation as GM");
      await saveReputation(reputation);
    } else {
      console.log("🚫 Guard: Skipping reputation persist - not GM");
    }
  }

  function getTotalStatValue(stat: Stat): number {
    const modifierBonus = modifiers.reduce((acc, m) => acc + (m.mods[stat.key] || 0), 0);
    return stat.value + modifierBonus;
  }

  function openAddStat() {
    newStat = { key: crypto.randomUUID(), name: '', value: 0 };
    addingStat = true;
  }

  async function confirmAddStat() {
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
    await persist();
    addingStat = false;
  }

  function cancelAddStat() {
    addingStat = false;
  }

  async function removeStat(index: number) {
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
    await persist();
  }

  async function updateStat() {
    log = [
      ...log,
      {
        user: game.user?.name ?? 'unknown',
        time: Date.now(),
        action: 'edit',
      },
    ];
    stats = [...stats];
    await persist();
  }

  function openAddModifier() {
    newModifier = { key: crypto.randomUUID(), name: '', description: '', mods: {}, state: 'neutral', img: 'icons/svg/upgrade.svg' };
    addingModifier = true;
  }

  function cancelAddModifier() {
    addingModifier = false;
  }

  function sortModifiersByState() {
    // Sort modifiers by state: positive -> neutral -> negative
    const stateOrder = { 'positive': 0, 'neutral': 1, 'negative': 2 };
    modifiers.sort((a, b) => {
      const stateA = stateOrder[a.state] ?? 1; // Default to neutral if state is undefined
      const stateB = stateOrder[b.state] ?? 1;
      return stateA - stateB;
    });
  }

  async function confirmAddModifier() {
    newModifier.mods = Object.fromEntries(
      Object.entries(newModifier.mods).filter(([, v]) => Number(v) !== 0)
    );
    modifiers = [...modifiers, { ...newModifier }];
    sortModifiersByState();
    await persistMods();
    addingModifier = false;
  }

  async function removeModifier(index: number) {
    modifiers.splice(index, 1);
    modifiers = [...modifiers];
    await persistMods();
  }

  async function updateModifier() {
    modifiers = modifiers.map((m) => ({
      ...m,
      state: m.state || 'neutral', // Ensure all modifiers have a state
      mods: Object.fromEntries(
        Object.entries(m.mods).filter(([, v]) => Number(v) !== 0)
      ),
    }));
    sortModifiersByState();
    await persistMods();
  }

  function modTooltip(mod: GuardModifier): string {
    const header = `<p><strong>${mod.name}:</strong> ${mod.description ?? ''}</p>`;
    const mods = Object.entries(mod.mods)
      .map(([k, v]) => {
        const stat = stats.find((s) => s.key === k);
        if (!stat) return '';
        const val = Number(v) > 0 ? `+${v}` : `${v}`;
        return `<div style="display:flex;align-items:center;gap:0.25rem;">
          <img src="${stat.img || 'icons/svg/shield.svg'}" alt="${stat.name}" width="16" height="16" />
          <span>${val}</span>
        </div>`;
      })
      .filter(Boolean)
      .join('');
    return header + mods;
  }

  function toggleEditingMods() {
    editingMods = !editingMods;
    // If we're stopping editing, sort the modifiers
    if (!editingMods) {
      sortModifiersByState();
    }
  }

  function toggleLog() {
    showLog = !showLog;
  }

  function toggleEditing() {
    editing = !editing;
  }

  function toggleEditingResources() {
    editingResources = !editingResources;
  }

  function onImageClick(stat: Stat) {
    if (editing) {
      if (typeof FilePicker !== 'undefined') {
        // @ts-ignore - FilePicker is provided by Foundry at runtime
        new FilePicker({
          type: 'image',
          current: stat.img,
          callback: (path: string) => {
            stat.img = path;
            updateStat();
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

  function onFileChange(stat: Stat, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      stat.img = String(reader.result);
      updateStat();
    };
    reader.readAsDataURL(input.files[0]);
  }

  function onModImageClick(mod: GuardModifier) {
    if (editingMods) {
      // Prefer Foundry's file picker when available
      if (typeof FilePicker !== 'undefined') {
        // @ts-ignore - FilePicker is provided by Foundry at runtime
        new FilePicker({
          type: 'image',
          current: mod.img,
          callback: (path: string) => {
            mod.img = path;
            updateModifier();
          },
        }).render(true);
      } else {
        // Fallback to file input
        const input = document.getElementById(`mod-file-${mod.key}`) as HTMLInputElement | null;
        input?.click();
      }
    }
  }

  function onModFileChange(mod: GuardModifier, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      mod.img = String(reader.result);
      updateModifier();
    };
    reader.readAsDataURL(input.files[0]);
  }

  function onNewModImageClick() {
    // Prefer Foundry's file picker when available
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

  function openAddResource() {
    newResource = { key: crypto.randomUUID(), name: '', value: 0 };
    addingResource = true;
  }

  function cancelAddResource() {
    addingResource = false;
  }

  async function confirmAddResource() {
    resources = [...resources, { ...newResource }];
    await persistRes();
    addingResource = false;
  }

  async function removeResource(index: number) {
    resources.splice(index, 1);
    resources = [...resources];
    await persistRes();
  }

  async function updateResource() {
    resources = [...resources];
    await persistRes();
  }

  function onResImageClick(res: GuardResource) {
    const input = document.getElementById(`res-file-${res.key}`) as HTMLInputElement | null;
    input?.click();
  }

  function onResFileChange(res: GuardResource, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      res.img = String(reader.result);
      updateResource();
    };
    reader.readAsDataURL(input.files[0]);
  }

  function toggleEditingReputation() {
    editingReputation = !editingReputation;
  }

  function openAddReputation() {
    newReputation = { key: crypto.randomUUID(), name: '', value: 0, img: 'icons/svg/aura.svg', details: '' };
    addingReputation = true;
  }

  function toggleReputationDetails(repKey: string) {
    expandedReputationDetails[repKey] = !expandedReputationDetails[repKey];
    expandedReputationDetails = { ...expandedReputationDetails }; // Trigger reactivity
  }

  function cancelAddReputation() {
    addingReputation = false;
  }

  async function confirmAddReputation() {
    reputation = [...reputation, { ...newReputation }];
    await persistRep();
    addingReputation = false;
  }

  async function removeReputation(index: number) {
    reputation.splice(index, 1);
    reputation = [...reputation];
    await persistRep();
  }

  async function updateReputation() {
    reputation = [...reputation];
    await persistRep();
  }

  function onRepImageClick(rep: GuardReputation) {
    if (editingReputation) {
      // Prefer Foundry's file picker when available
      if (typeof FilePicker !== 'undefined') {
        // @ts-ignore - FilePicker is provided by Foundry at runtime
        new FilePicker({
          type: 'image',
          current: rep.img,
          callback: (path: string) => {
            rep.img = path;
            updateReputation();
          },
        }).render(true);
      }
    } else {
      showReputationInChat(rep);
    }
  }

  function onNewRepImageClick() {
    // Prefer Foundry's file picker when available
    if (typeof FilePicker !== 'undefined') {
      // @ts-ignore - FilePicker is provided by Foundry at runtime
      new FilePicker({
        type: 'image',
        current: newReputation.img,
        callback: (path: string) => {
          newReputation.img = path;
          newReputation = { ...newReputation }; // Trigger reactivity
        },
      }).render(true);
    }
  }

  function onRepFileChange(rep: GuardReputation, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      rep.img = String(reader.result);
      updateReputation();
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

<style>
  .custom-popup {
    position: fixed;
    border-radius: 12px;
    overflow: hidden;
    z-index: 80;
  }

  .image-button {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .image-button:hover {
    opacity: 0.8;
  }

  .drag-handle {
    position: absolute;
    top: 0;
    left: 60px;
    right: 0;
    height: 40px;
    cursor: move;
    background: transparent;
    z-index: 82;
  }

  .resize-handle {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 20px;
    height: 20px;
    cursor: se-resize;
    background: rgba(212, 175, 55, 0.3);
    border-top-left-radius: 12px;
    z-index: 82;
    transition: background 0.3s ease;
  }

  .resize-handle:hover {
    background: rgba(212, 175, 55, 0.6);
  }

  .resize-handle::before {
    content: '';
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-bottom: 8px solid rgba(212, 175, 55, 0.8);
  }

  .app-container {
    display: flex;
    height: 100%;
    min-height: 400px;
    position: relative;
  }

  .close-button {
    position: absolute;
    top: 15px;
    right: 15px;
    width: 40px;
    height: 40px;
    background: rgba(139, 105, 20, 0.9);
    border: 2px solid #d4af37;
    border-radius: 50%;
    color: #f4f1e8;
    font-size: 1.4rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    z-index: 81;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
  }

  .close-button:hover {
    background: rgba(212, 175, 55, 0.9);
    color: #1a0f08;
    transform: scale(1.1);
  }

  .tab-navigation {
    display: flex;
    flex-direction: column;
    min-width: 60px;
    border-right: 2px solid #d4af37;
  }

  .tab {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(30, 40, 60, 0.8);
    border-bottom: 1px solid #8b6914;
    color: #f4f1e8;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    min-height: 50px;
  }

  .tab:hover {
    background: rgba(40, 50, 70, 0.9);
    color: #d4af37;
  }

  .tab.active {
    background: rgba(50, 60, 80, 1);
    color: #d4af37;
    border-left: 4px solid #d4af37;
  }

  .content-area {
    border-top: 2px solid #d4af37;
    border-right: 2px solid #d4af37;
    border-bottom: 2px solid #d4af37;
    flex: 1;
    padding: 1rem;
    background: linear-gradient(135deg, rgba(11, 10, 19, 0.95) 0%, rgba(20, 30, 50, 0.9) 50%, rgba(11, 10, 19, 0.95) 100%);
    backdrop-filter: blur(10px);
    color: #f4f1e8;
    overflow-y: auto;
    border-radius: 0 8px 8px 0;
    box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5);
    font-family: "Cinzel", serif;
  }

  .guard-container {
    padding: 0.5rem;
    color: white;
    overflow-y: auto;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.25rem;
    flex: 1 1 0;
    min-width: 0;
    max-width: none;
    box-sizing: border-box;
  }

  .stat img {
    height: 42px;
    width: 42px;
  }

  .stat-img {
    background: none;
    border: none;
    padding: 0;
    height: 42px;
    width: 42px;
    cursor: pointer;
  }

  .stat-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    flex-wrap: wrap;
  }

  .stats-and-modifiers-container {
    display: flex;
    gap: 1rem;
    width: 100%;
  }

  .stats-section {
    flex: 0 0 60%;
    min-width: 60%;
  }

  .modifiers-section {
    flex: 1;
    min-width: 35%;
  }

  .modifiers-section h4 {
    margin-top: 0;
    margin-bottom: 0.5rem;
  }

  /* Responsive design for smaller screens */
  @media (max-width: 768px) {
    .stats-and-modifiers-container {
      flex-direction: column;
    }

    .stats-section,
    .modifiers-section {
      flex: 1;
      min-width: 100%;
    }
  }

  .log {
    background: #333;
    padding: 0.25rem;
    margin-top: 0.5rem;
    max-height: 150px;
    overflow-y: auto;
  }

  .add-stat-form {
    display: flex;
    gap: 0.25rem;
    margin: 0.5rem 0;
  }
  .add-mod-form {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0.5rem 0;
  }

  .add-mod-form textarea {
    min-height: 60px;
    resize: vertical;
    padding: 0.25rem;
    border: 1px solid #6b7280;
    border-radius: 3px;
    font-family: inherit;
    background: rgba(0, 0, 0, 0.1);
    color: #f9fafb;
  }

  .add-mod-form textarea::placeholder {
    color: #9ca3af;
  }

  /* General input and textarea styling for edit forms */
  .add-stat-form input,
  .add-mod-form input,
  .add-resource-form input,
  .modifier-edit input,
  .modifier-edit textarea {
    background: rgba(0, 0, 0, 0.1);
    color: #f9fafb;
    border: 1px solid #6b7280;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
  }

  .add-stat-form input::placeholder,
  .add-mod-form input::placeholder,
  .add-resource-form input::placeholder,
  .modifier-edit input::placeholder,
  .modifier-edit textarea::placeholder {
    color: #9ca3af;
  }

  .add-stat-form input:focus,
  .add-mod-form input:focus,
  .add-resource-form input:focus,
  .modifier-edit input:focus,
  .modifier-edit textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .modifier-image-section {
    display: flex;
    justify-content: center;
    margin-bottom: 0.5rem;
  }

  .modifier-image-button {
    background: none;
    border: 2px solid #666;
    border-radius: 4px;
    padding: 0;
    cursor: pointer;
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modifier-image-button:hover {
    border-color: #4a90e2;
  }

  .modifier-image-button img {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 2px;
  }

  .modifier-stats-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
    margin: 0.5rem 0;
  }

  .form-buttons {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    margin-top: 0.5rem;
  }
  .modifier {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    border: 2px solid transparent;
    border-radius: 4px;
    padding: 0.25rem;
  }

  .modifier-positive {
    border-color: #22c55e; /* Green border for positive */
  }

  .modifier-neutral {
    border-color: #ffffff; /* White border for neutral */
  }

  .modifier-negative {
    border-color: #ef4444; /* Red border for negative */
  }

  .state-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.5rem 0;
  }

  .state-selector label {
    font-weight: bold;
    min-width: 50px;
  }

  .state-selector select {
    padding: 0.25rem;
    border: 1px solid #ccc;
    border-radius: 3px;
    background: white;
    font-size: 0.9em;
  }
  .modifier-values {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .modifier-values input {
    width: 32px;
    height: 32px;
    text-align: center;
    border: 1px solid #ccc;
    border-radius: 3px;
  }
  .modifier-values-edit {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;

    & input {
      height: 32px;
      width: 32px;
    }
  }
  .modifier-edit {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .stats-editables {
    display: flex;
    gap: 0.25rem;
  }

  .stat-name-input {
    max-width: 100px;
    text-align: center;
  }

  .stat-number {
    display: flex;
  }

  .stat-number-input {
    width: 30px;
    text-align: center;
  }

  .stat-number-close {
    width: 24px;
    text-align: center;
  }

  .stat-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-weight: bold;
  }

  .add-resource-form {
    display: flex;
    gap: 0.25rem;
    margin: 0.5rem 0;
  }

  .resource {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.25rem;
  }
  .modifier-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .standard-image {
    width: 32px;
    height: 32px;
  }
  .resource-container {
    display: flex;
    gap: 0.25rem;
  }
  .button-holder {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .stat-value {
    display: flex;
    align-items: center;
    height: 32px;
    font-size: 24px;
    font-weight: bold;
  }
  .stat-name {
    margin-bottom: 0.25rem;
  }
  .modifier-values-contain {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  /* Reputation Styles */
  .reputation-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .reputation-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }

  .reputation-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #374151;
    border-radius: 8px;
    background: transparent;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
  }

  .reputation-display:hover {
    transform: translateY(-2px);
    border-color: #6b7280;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  .reputation-display:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .reputation-image {
    width: 100%;
    height: 56px;
    object-fit: cover;
    border-radius: 8px;
    flex-shrink: 0;
    border: 2px solid #6b7280;
  }

  .reputation-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    align-items: center;
  }

  .reputation-name {
    font-weight: bold;
    font-size: 1em;
    color: #f9fafb;
    text-align: center;
    line-height: 1.2;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  }

  .reputation-bar-container {
    position: relative;
    width: 100%;
  }

  .reputation-bar {
    width: 100%;
    height: 24px;
    background: #000000;
    border: 2px solid #374151;
    border-radius: 12px;
    position: relative;
    overflow: hidden;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .reputation-fill {
    height: 100%;
    transition: width 0.4s ease;
    border-radius: 0;
    position: relative;
    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.2);
  }

  .reputation-tick {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: linear-gradient(to bottom,
      rgba(0, 0, 0, 0.8) 0%,
      rgba(0, 0, 0, 0.6) 50%,
      rgba(0, 0, 0, 0.8) 100%);
    z-index: 1;
    border-radius: 1px;
  }

  .reputation-tick:first-child,
  .reputation-tick:last-child {
    opacity: 0; /* Hide first and last ticks */
  }

  .reputation-edit {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #6b7280;
    border-radius: 8px;
    background: transparent;
  }

  .rep-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
    justify-content: center;
  }

  .reputation-edit input {
    flex: 1;
    background: rgba(0, 0, 0, 0.1);
    color: #f9fafb;
    border: 1px solid #6b7280;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
  }

  .reputation-edit input::placeholder {
    color: #9ca3af;
  }

  .reputation-edit input[type="number"] {
    width: 80px;
  }

  .add-reputation-form {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    padding: 0.75rem;
    border: 2px solid #6b7280;
    border-radius: 8px;
    background: transparent;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .add-reputation-form input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #6b7280;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.1);
    color: #f9fafb;
  }

  .add-reputation-form input::placeholder {
    color: #9ca3af;
  }

  .add-reputation-form textarea {
    flex: 1;
    min-height: 60px;
    padding: 0.5rem;
    border: 1px solid #6b7280;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.1);
    color: #f9fafb;
    resize: vertical;
    font-family: inherit;
  }

  .add-reputation-form textarea::placeholder {
    color: #9ca3af;
  }

  .collapse-button {
    font-size: 0.8em;
    padding: 0.25rem 0.5rem;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .collapse-button:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.5);
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

  .edit-button {
    font-size: 0.85em;
    padding: 0.25rem 0.5rem;
  }

  .reputation-image-button {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.2s ease;
  }

  .reputation-image-button:hover {
    transform: scale(1.05);
  }

  .reputation-image-button img {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 8px;
    border: 2px solid #6b7280;
  }

  .reputation-image-edit{
    height: 56px;
    object-fit: cover;
    width: 100%;
  }

  .reputation-edit-image-button {
    width: 100%;
    height: 56px;
  }

  /* Reputation details styles */
  .reputation-details-toggle {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid #6b7280;
    border-radius: 50%;
    color: #f9fafb;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    transition: all 0.2s ease;
  }

  .reputation-details-toggle:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: scale(1.1);
  }

  .reputation-details {
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid #374151;
    border-radius: 6px;
    font-size: 0.85em;
    line-height: 1.4;
    color: #d1d5db;
  }

  .reputation-details p {
    margin: 0;
  }

  .reputation-display {
    position: relative;
  }

  .reputation-edit textarea {
    min-height: 60px;
    resize: vertical;
    background: rgba(0, 0, 0, 0.1);
    color: #f9fafb;
    border: 1px solid #6b7280;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-family: inherit;
  }

  .reputation-edit textarea::placeholder {
    color: #9ca3af;
  }
</style>
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
                <div class="stats-section">
                  <div class="button-holder">
                    {#if editing}
                      <button on:click={openAddStat}>Añadir Stat</button>
                    {/if}
                    <button on:click={toggleEditing}>{editing ? 'Stop Editing' : 'Edit Stats'}</button>
                  </div>

                  {#if addingStat}
                    <div class="add-stat-form">
                      <input placeholder="Nombre" bind:value={newStat.name} />
                      <input type="number" placeholder="Valor" bind:value={newStat.value} />
                      <button on:click={confirmAddStat}>Agregar</button>
                      <button on:click={cancelAddStat}>Cancelar</button>
                    </div>
                  {/if}

                  <div class="stat-container">
                    {#each stats as stat, i}
                      <div class="stat">
                        <button class="stat-img" on:click={() => onImageClick(stat)}>
                          <img class="standard-image" src={stat.img || 'icons/svg/shield.svg'} alt="stat" />
                        </button>
                        <input
                          id={`file-${stat.key}`}
                          type="file"
                          accept="image/*"
                          on:change={(e) => onFileChange(stat, e)}
                          style="display: none;"
                        />
                        {#if editing}
                          <div class="stats-editables">
                            <input
                              class="stat-name-input"
                              placeholder="Nombre"
                              bind:value={stat.name}
                              on:change={updateStat}
                            />
                          </div>
                          <div class="stat-number">
                            <input
                              class="stat-number-input"
                              type="number"
                              placeholder="Valor"
                              bind:value={stat.value}
                              on:change={updateStat}
                            />
                            <button class="stat-number-close" on:click={() => removeStat(i)}>X</button>
                          </div>
                        {:else}
                          <div class="stat-view">
                            <div class="stat-name">{stat.name}</div>
                            <div class="stat-value">{stat.value} ({getTotalStatValue(stat)})</div>
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>

                  <button on:click={toggleLog}>{showLog ? 'Ocultar Log' : 'Mostrar Log'}</button>
                  {#if showLog}
                    <div class="log">
                      {#each log as entry}
                        <div>{new Date(entry.time).toLocaleString()} - {entry.user}: {entry.action}</div>
                      {/each}
                    </div>
                  {/if}
                </div>

                <div class="modifiers-section">
                  <h4>Modificaciones Situacionales</h4>
                  {#if editingMods}
                    <button on:click={openAddModifier}>Añadir Modificador</button>
                  {/if}
                  <button on:click={toggleEditingMods}>{editingMods ? 'Stop Edit Mods' : 'Edit Mods'}</button>
                  {#if addingModifier}
                    <div class="add-mod-form">
                      <div class="modifier-image-section">
                        <button type="button" class="modifier-image-button" on:click={onNewModImageClick}>
                          <img src={newModifier.img} alt="Modifier Image" />
                        </button>
                      </div>
                      <input placeholder="Nombre" bind:value={newModifier.name} />
                      <textarea placeholder="Descripción" bind:value={newModifier.description}></textarea>
                      <div class="state-selector">
                        <label for="new-modifier-state">Estado:</label>
                        <select id="new-modifier-state" bind:value={newModifier.state}>
                          <option value="positive">Positive</option>
                          <option value="neutral">Neutral</option>
                          <option value="negative">Negative</option>
                        </select>
                      </div>
                      <div class="modifier-stats-container">
                        {#each stats as stat}
                          <div class="modifier-values">
                            <img class="standard-image" src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} width="32" height="32" />
                            <input type="number" bind:value={newModifier.mods[stat.key]} />
                          </div>
                        {/each}
                      </div>
                      <div class="form-buttons">
                        <button on:click={confirmAddModifier}>Agregar</button>
                        <button on:click={cancelAddModifier}>Cancelar</button>
                      </div>
                    </div>
                  {/if}
                  <div class="modifier-container">
                    {#each modifiers as mod, i}
                      <div class="modifier modifier-{mod.state || 'neutral'}">
                        <Tooltip content={editingMods ? `<p><strong>${mod.name}:</strong> ${mod.description ?? ''}</p>` : modTooltip(mod)}>
                          <button type="button" class="image-button" on:click={() => onModImageClick(mod)}>
                            <img class="standard-image" src={mod.img || 'icons/svg/upgrade.svg'} alt="mod" />
                          </button>
                        </Tooltip>
                        <input id={`mod-file-${mod.key}`} type="file" accept="image/*" style="display:none" on:change={(e)=>onModFileChange(mod,e)} />
                        {#if editingMods}
                          <div class="modifier-edit">
                            <input placeholder="Nombre" bind:value={mod.name} on:change={updateModifier} />
                            <textarea placeholder="Descripción" bind:value={mod.description} on:change={updateModifier} />
                            <div class="state-selector">
                              <label for="edit-modifier-state-{i}">Estado:</label>
                              <select id="edit-modifier-state-{i}" bind:value={mod.state} on:change={updateModifier}>
                                <option value="positive">Positive</option>
                                <option value="neutral">Neutral</option>
                                <option value="negative">Negative</option>
                              </select>
                            </div>
                            <div class="modifier-values-contain">
                              {#each stats as stat}
                                <div class="modifier-values modifier-values-edit">
                                  <img class="standard-image" src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} width="16" height="16" />
                                  <input type="number" bind:value={mod.mods[stat.key]} on:change={updateModifier} />
                                </div>
                              {/each}
                            </div>
                            <button on:click={() => removeModifier(i)}>X</button>
                          </div>
                        {:else}
                          <!-- content moved into tooltip -->
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              </div>

              <hr />
              <h3 style="display: flex; justify-content: space-between; align-items: center;">
                Reputación
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  <button class="edit-button" on:click={toggleEditingReputation}>
                    {editingReputation ? 'Finalizar Edición' : 'Editar Reputación'}
                  </button>
                  <button class="collapse-button" on:click={() => collapsedReputation = !collapsedReputation}>
                    {collapsedReputation ? '▼' : '▲'}
                  </button>
                </div>
              </h3>

              {#if !collapsedReputation}
                {#if editingReputation}
                  <div class="button-holder">
                    <button on:click={openAddReputation}>Añadir Reputación</button>
                  </div>
                {/if}

                {#if addingReputation}
                  <div class="add-reputation-form">
                    <button type="button" class="reputation-image-button" on:click={onNewRepImageClick}>
                      <img src={newReputation.img || 'icons/svg/aura.svg'} alt="reputation" />
                    </button>
                    <input placeholder="Nombre de la facción" bind:value={newReputation.name} />
                    <input type="number" min="0" max="10" placeholder="Reputación (0-10)" bind:value={newReputation.value} />
                    <textarea placeholder="Detalles sobre tu relación con esta facción..." bind:value={newReputation.details}></textarea>
                    <button on:click={confirmAddReputation}>Agregar</button>
                    <button on:click={cancelAddReputation}>Cancelar</button>
                  </div>
                {/if}

                <div class="reputation-container">
                  {#each reputation as rep, i}
                    <div class="reputation-item">
                      {#if editingReputation}

                        <div class="reputation-edit">
                          <button type="button" class="image-button reputation-edit-image-button" on:click={() => onRepImageClick(rep)}>
                            <img class="reputation-image-edit" src={rep.img || 'icons/svg/aura.svg'} alt="reputation" />
                          </button>
                          <input id={`rep-file-${rep.key}`} type="file" accept="image/*" style="display:none" on:change={(e)=>onRepFileChange(rep,e)} />
                          <input placeholder="Nombre" bind:value={rep.name} on:change={updateReputation} />
                          <textarea placeholder="Detalles sobre la relación..." bind:value={rep.details} on:change={updateReputation}></textarea>
                          <div class="rep-actions">
                            <input type="number" min="0" max="10" bind:value={rep.value} on:change={updateReputation} />
                            <button on:click={() => removeReputation(i)}>✕</button>
                          </div>
                        </div>
                      {:else}
                        <div class="reputation-display" role="button" tabindex="0"
                             on:click={() => showReputationInChat(rep)}
                             on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showReputationInChat(rep); } }}>
                          <img class="reputation-image" src={rep.img || 'icons/svg/aura.svg'} alt="reputation" />
                          <div class="reputation-info">
                            <div class="reputation-name">{rep.name}</div>
                            <div class="reputation-bar-container">
                              <div class="reputation-bar">
                                <div class="reputation-fill" style="width: {rep.value * 10}%; background: linear-gradient(90deg,
                                  hsl({(rep.value / 10) * 120}, 70%, 40%) 0%,
                                  hsl({(rep.value / 10) * 120}, 80%, 50%) 50%,
                                  hsl({(rep.value / 10) * 120}, 70%, 60%) 100%);">
                                </div>
                                {#each Array(11) as _, j}
                                  <div class="reputation-tick" style="left: {j * 10}%;"></div>
                                {/each}
                              </div>
                            </div>
                          </div>
                          {#if rep.details && rep.details.trim()}
                            <button class="reputation-details-toggle" on:click|stopPropagation={() => toggleReputationDetails(rep.key)}>
                              📝
                            </button>
                          {/if}
                        </div>
                        {#if rep.details && rep.details.trim() && expandedReputationDetails[rep.key]}
                          <div class="reputation-details">
                            <p>{rep.details}</p>
                          </div>
                        {/if}
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}

              <hr />
              <h3 style="display: flex; justify-content: space-between; align-items: center;">
                Recursos
                <div style="display: flex, gap: 0.5rem, align-items: center;">
                  <button class="edit-button" on:click={toggleEditingResources}>
                    {editingResources ? 'Finalizar Edición' : 'Editar Recursos'}
                  </button>
                  <button class="collapse-button" on:click={() => collapsedResources = !collapsedResources}>
                    {collapsedResources ? '▼' : '▲'}
                  </button>
                </div>
              </h3>

              {#if !collapsedResources}
                {#if editingResources}
                  <div class="button-holder">
                    <button on:click={openAddResource}>Añadir Recurso</button>
                  </div>
                {/if}

                {#if addingResource}
                  <div class="add-resource-form">
                    <input placeholder="Nombre" bind:value={newResource.name} />
                    <input type="number" bind:value={newResource.value} />
                    <button on:click={confirmAddResource}>Agregar</button>
                    <button on:click={cancelAddResource}>Cancelar</button>
                  </div>
                {/if}

                <div class="resource-container">
                  {#each resources as res, i}
                    <div class="resource">
                      <button type="button" class="image-button" on:click={() => editingResources ? onResImageClick(res) : null}>
                        <img class="standard-image" src={res.img || 'icons/svg/item-bag.svg'} alt="res" />
                      </button>
                      <input id={`res-file-${res.key}`} type="file" accept="image/*" style="display:none" on:change={(e)=>onResFileChange(res,e)} />

                      {#if editingResources}
                        <input placeholder="Nombre" bind:value={res.name} on:change={updateResource} />
                        <input type="number" bind:value={res.value} on:change={updateResource} />
                        <button on:click={() => removeResource(i)}>✕</button>
                      {:else}
                        <div>
                          <span>{res.name}</span>
                          <span>{res.value}</span>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

          {:else if activeTab === 'patrullas'}
            <h3>Patrullas</h3>
            <Groups
              groups={patrols}
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
              groups={admins}
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
