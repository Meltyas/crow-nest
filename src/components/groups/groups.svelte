<script context="module" lang="ts">
  declare const FilePicker: any;
  declare const game: any;
</script>

<script lang="ts">
  import { patrolSheetManager } from '@/components/patrol-sheet/patrol-sheet';
  import Tooltip from '@/components/tooltip.svelte';
  import type { GuardModifier, GuardStat } from '@/guard/stats';
  import { getModifiers, getStats } from "@/guard/stats";
  import type { Group, GroupMember, GroupSkill } from "@/shared/group";
  import { groupsStore, persistGroups } from '@/stores/groups';
  import { SyncManager, type SyncEvent } from '@/utils/sync';
  import { onDestroy, onMount } from 'svelte';

  // Access game through global window object to avoid declaration issues
  const game = (globalThis as any).game;
  const FilePicker = (globalThis as any).FilePicker;

  export const saveGroups: (groups: Group[]) => Promise<void> = async () => {}; // Legacy prop, not used anymore
  export let labels = {
    groupSingular: 'Patrol',
    addGroup: 'Add Patrol',
    removeGroup: 'Remove Patrol',
    officerDrop: 'Drag an officer here',
    soldierDrop: 'Drag soldiers here',
  };

  // Use store instead of prop
  $: groups = $groupsStore;

  let stats: GuardStat[] = [];
  let modifiers: GuardModifier[] = [];
  let editing: Record<string, boolean> = {};
  let collapsed: Record<string, boolean> = {};

  // Sync manager
  let syncManager: SyncManager;

  onMount(() => {
    stats = getStats() as GuardStat[];
    modifiers = getModifiers();

    // Setup real-time synchronization only for stats and modifiers
    syncManager = SyncManager.getInstance();

    // Listen for stats and modifiers updates (for UI updates)
    syncManager.subscribe('stats', handleStatsSync);
    syncManager.subscribe('modifiers', handleModifiersSync);

    // Groups sync is handled globally, no need to subscribe here
  });

  onDestroy(() => {
    if (syncManager) {
      syncManager.unsubscribe('stats', handleStatsSync);
      syncManager.unsubscribe('modifiers', handleModifiersSync);
      // No need to unsubscribe from groups - it's global
    }
  });

  // Sync event handlers
  function handleStatsSync(event: SyncEvent) {
    if (event.type === 'stats' && event.data?.stats) {
      stats = event.data.stats;
    }
  }

  function handleModifiersSync(event: SyncEvent) {
    if (event.type === 'modifiers') {
      modifiers = event.data || getModifiers();
    }
  }

  async function persist() {
    await persistGroups(groups);
  }

  // Helper function to update groups and sync
  function updateGroups(newGroups: Group[]) {
    groups = newGroups;
    groupsStore.set(groups); // Update store immediately for reactive UI
    persist();
  }

  function addGroup() {
    groups = [
      ...groups,
      {
        id: crypto.randomUUID(),
        name: '',
        officer: null,
        soldiers: [],
        mods: {},
        skills: [],
      },
    ];
    persist();
  }

  function removeGroup(index: number) {
    groups.splice(index, 1);
    groups = [...groups];
    persist();
  }

  function toggleEditing(group: Group) {
    editing[group.id] = !editing[group.id];
    editing = { ...editing }; // Trigger reactivity
  }

  function toggleCollapsed(group: Group) {
    collapsed[group.id] = !collapsed[group.id];
    collapsed = { ...collapsed }; // Trigger reactivity
  }

  function removeOfficer(group: Group) {
    group.officer = null;
    groups = [...groups];
    persist();
  }

  function removeSoldier(group: Group, soldier: GroupMember) {
    const index = group.soldiers.indexOf(soldier);
    if (index > -1) {
      group.soldiers.splice(index, 1);
      group.soldiers = [...group.soldiers];
      groups = [...groups];
      persist();
    }
  }

  function onDragMember(event: DragEvent, member: GroupMember | null) {
    if (!member) return;
    const payload = {
      type: 'Actor',
      uuid: `Actor.${member.id}`,
    };
    event.dataTransfer?.setData('text/plain', JSON.stringify(payload));
  }

  function onDragDeploy(event: DragEvent, group: Group) {
    const payload = {
      type: 'CrowPatrol',
      patrolId: group.id,
    };
    event.dataTransfer?.setData('text/plain', JSON.stringify(payload));
  }

  function openActorSheet(memberId: string) {
    const actor = game.actors?.get(memberId);
    if (actor) {
      actor.sheet.render(true);
    }
  }

  async function actorFromDrop(event: DragEvent): Promise<Actor | null> {
    event.preventDefault();
    const raw = event.dataTransfer?.getData("text/plain");
    if (!raw) return null;

    try {
      const data = JSON.parse(raw);
      if (data?.uuid) {
        const droppedActor = await fromUuid(data.uuid);
        if (droppedActor instanceof Actor) {
          return droppedActor;
        }
      }
    } catch (err) {
      console.error("Failed to parse drop data:", err);
    }

    return null;
  }

  async function onDropOfficer(event: DragEvent, group: Group) {
    const actor = await actorFromDrop(event);
    if (!actor) return;

    group.officer = {
      id: actor.id || '',
      name: actor.name || '',
      img: actor.img || '',
    };

    if (!group.name) {
      group.name = `${labels.groupSingular} de ${actor.name}`;
    }

    groups = [...groups];
    persist();
  }

  async function onDropSoldier(event: DragEvent, group: Group) {
    const actor = await actorFromDrop(event);
    if (!actor) return;

    group.soldiers = [
      ...group.soldiers,
      { id: actor.id || '', name: actor.name || '', img: actor.img || '' },
    ];
    groups = [...groups];
    persist();
  }

  function addSkill(group: Group) {
    const skill: GroupSkill = { name: '', description: '', img: 'icons/svg/book.svg' };
    group.skills = [...group.skills, skill];
    groups = [...groups];
    persist();
  }

  function removeSkill(group: Group, index: number) {
    group.skills.splice(index, 1);
    group.skills = [...group.skills];
    groups = [...groups];
    persist();
  }

  function chooseSkillImage(skill: GroupSkill) {
    // Prefer Foundry's file picker when available
    if (typeof FilePicker !== 'undefined') {
      // @ts-ignore - FilePicker is provided by Foundry at runtime
      new FilePicker({
        type: 'image',
        current: skill.img,
        callback: (path: string) => {
          skill.img = path;
          groups = [...groups];
          persist();
        },
      }).render(true);
    }
  }

  function showSkillInChat(skill: GroupSkill, group: Group) {
    if (editing[group.id]) return; // No mostrar en modo edición

    const groupName = group.name || (group.officer ? `${labels.groupSingular} de ${group.officer.name}` : 'Grupo');
    const groupColor = '#4a90e2'; // Color azul para las habilidades de patrulla

    const content = `
      <div style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem; border: 2px solid ${groupColor}; border-radius: 8px; background: rgba(0,0,0,0.1);">
        <img src="${skill.img || 'icons/svg/book.svg'}" alt="${skill.name}" style="width: 64px; height: 64px; object-fit: cover; border-radius: 8px; border: 2px solid ${groupColor};" />
        <div style="flex: 1;">
          <h3 style="margin: 0 0 0.5rem 0; color: ${groupColor}; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${skill.name}</h3>
          <div style="color: #000; font-size: 0.9em; line-height: 1.4;">${skill.description || 'Sin descripción disponible'}</div>
          <div style="margin-top: 0.5rem; font-size: 0.8em; color: #666; font-style: italic;">— ${groupName}</div>
        </div>
      </div>
    `;

    // Enviar mensaje al chat
    ChatMessage.create({
      speaker: { alias: `${groupName} - Habilidad` },
      content: content,
      whisper: null // Mensaje público
    });
  }

  function showPatrolSheet(group: Group) {
    // Usar el sistema independiente de fichas de patrulla (individual)
    patrolSheetManager.showPatrolSheet(group, labels);
  }

  function forceShowPatrolSheetToAll(group: Group) {
    // Solo GM puede forzar la ficha a todos
    if (!game.user?.isGM) return;
    patrolSheetManager.forceShowPatrolSheetToAll(group, labels);
  }

  function guardBonus(key: string): number {
    return modifiers.reduce((acc, m) => acc + (m.mods[key] || 0), 0);
  }

  function totalStat(stat: GuardStat, group: Group): number {
    return stat.value + guardBonus(stat.key) + (group.mods[stat.key] || 0);
  }

  function roll(stat: GuardStat, group: Group) {
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

    const alias =
      group.name || (group.officer ? `The Patrol of ${group.officer.name}` : 'The Patrol');
    const headerImg = group.officer
      ? `<img src="${group.officer.img}" alt="${group.officer.name}" width="32" height="32" style="vertical-align:middle;margin-right:0.5rem;"/>`
      : '';
    const header = `<div style="display:flex;align-items:center;gap:0.5rem;">${headerImg}<strong>${alias}</strong></div>`;

    const flavor = `${header}<br/>${lines.join('<br/>')}`;
    r.toMessage({ speaker: { alias }, flavor });
  }

  async function deployGroup(group: Group) {
    if (!group.officer && (!group.soldiers || group.soldiers.length === 0)) {
      ui.notifications?.warn("No members in the group to deploy");
      return;
    }

    const members = [] as GroupMember[];
    if (group.officer) members.push(group.officer);
    members.push(...group.soldiers);

    // Get canvas position (center of canvas view)
    const canvas = game.canvas as any;
    if (!canvas) {
      ui.notifications?.error("Cannot access canvas");
      return;
    }

    const viewPosition = canvas.stage.pivot;
    const grid = canvas.grid.size;
    let offsetX = 0;
    let offsetY = 0;
    const tokensToCreate = [] as any[];
    const tokensToMove = [] as any[];
    const movedTokenIds = new Set<string>(); // Track which specific tokens we've already moved

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const actor = game.actors?.get(member.id);
      if (!actor) continue;

      // Find ALL tokens of this actor on canvas that we haven't moved yet
      const existingTokens = canvas.tokens.placeables.filter(
        (token: any) => token.document.actorId === actor.id && !movedTokenIds.has(token.document.id)
      );

      const newX = viewPosition.x + offsetX;
      const newY = viewPosition.y + offsetY;

      if (existingTokens.length > 0) {
        // Move only the first token we haven't moved yet
        const token = existingTokens[0];
        movedTokenIds.add(token.document.id); // Mark this specific token as moved

        tokensToMove.push({
          _id: token.document.id,
          x: newX,
          y: newY,
        });
      } else {
        // No unmoved tokens found, create new token
        const doc = await actor.getTokenDocument({
          x: newX,
          y: newY,
        });
        tokensToCreate.push(doc.toObject());
      }

      offsetX += grid;
      if ((i + 1) % 5 === 0) {
        offsetX = 0;
        offsetY += grid;
      }
    }

    // Execute operations
    if (tokensToMove.length) {
      for (const tokenUpdate of tokensToMove) {
        const token = canvas.tokens.get(tokenUpdate._id);
        if (token) {
          await token.document.update({ x: tokenUpdate.x, y: tokenUpdate.y });
        }
      }
    }

    if (tokensToCreate.length) {
      await canvas.scene.createEmbeddedDocuments("Token", tokensToCreate);
    }

    const groupName = group.name || (group.officer ? `${labels.groupSingular} of ${group.officer.name}` : 'Group');
    ui.notifications?.info(`${groupName} deployed on the map (${members.length} members, ${tokensToMove.length} moved, ${tokensToCreate.length} created)`);
  }
</script>

<style>
  .group {
    border: 1px solid #666;
    padding: 0.5rem;
    padding-left: 120px; /* Always reserve space for officer area */
    margin-bottom: 0.5rem;
    position: relative;
    min-height: 178px; /* Always use the larger height */
  }

  .officer-image {
    position: absolute;
    top: 46px;
    left: 0;
    width: 110px;
    height: 130px;
    object-fit: cover;
    border-radius: 4px;
    z-index: 1;
  }

  .group-header {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    right: 0.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 2;
    background: rgba(0, 0, 0, 0.7);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .group-header-left {
    flex: 1;
    min-width: 0;
  }

  .group-header-buttons {
    display: flex;
    gap: 0.25rem;
    margin-left: 0.5rem;
  }

  .header-button {
    padding: 0.25rem 0.5rem;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #666;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.8em;
    color: #000;
    min-width: auto;
  }

  .header-button:hover {
    background: rgba(255, 255, 255, 1);
  }

  .group-name-input {
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #666;
    border-radius: 3px;
    padding: 0.25rem 0.5rem;
    height: 24px;
    font-weight: bold;
    font-size: 1em;
    color: #000;
    flex: 1;
  }

  .group-name-input:focus {
    outline: none;
    border-color: #4a90e2;
    background: rgba(255, 255, 255, 1);
  }

  .group-content {
    padding-top: 2.5rem; /* Space for the header */
  }

  .officer-drop-zone {
    position: absolute;
    top: 0;
    left: 0;
    width: 110px;
    height: 100%;
    border: 2px dashed transparent;
    background: rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 1;
    transition: all 0.3s ease;
  }

  .officer-drop-zone:hover {
    border-color: #aaa;
    background: rgba(255, 255, 255, 0.1);
  }

  .officer-drop-zone.has-officer {
    border: none;
    background: transparent;
  }

  .officer-info-top {
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.9em;
    margin-bottom: 0.5rem;
  }

  .stats-and-edit-container {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.5rem;
    gap: 1rem;
  }

  .collapsed .stats-and-edit-container {
    margin-bottom: 0;
  }

  .drop-zone {
    border: 1px dashed #aaa;
    padding: 0.25rem;
    min-height: 1.5rem;
    margin-bottom: 0.25rem;
  }

  .drop-zone.soldiers {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-items: start;
    flex: 1 1 auto;
  }

  .drop-zone.soldiers em {
    width: 100%;
    text-align: center;
  }

  .drop-zone.soldiers .member {
    flex: 1 1 auto;
    min-width: 0;
    max-width: 49%;
    width: 100%;
  }

  .skills {
    border-radius: 8px;
    padding-top: .5rem;
  }

  .skills strong {
    color: #d4af37;
  }

  .skill {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #ffffff;
    border: 1px solid #d4af37;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    transition: all 0.3s ease;
  }

  .skill:hover {
    border-color: rgba(212, 175, 55, 0.4);
  }

  .skill-image-button {
    background: #000000;
    border: 2px solid rgba(212, 175, 55, 0.5);
    border-radius: 8px;
    padding: 0;
    cursor: pointer;
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    flex-shrink: 0;
  }

  .skill-image-button:hover {
    border-color: #d4af37;
    transform: scale(1.05);
  }

  .skill-image-button img {
    width: 68px;
    height: 68px;
    object-fit: cover;
    border-radius: 8px;
  }

  .skill-display {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.3s ease;
    align-items: flex-start;
  }

  .skill-image {
    flex-shrink: 0;
  }

  .skill-image img {
    background: #000000;
    width: 72px;
    height: 72px;
    object-fit: cover;
    border-radius: 8px;
    border: 2px solid rgba(212, 175, 55, 0.5);
  }

  .skill-info {
    flex: 1;
  }

  .skill-info strong {
    font-family: "Eveleth Dot", "Eveleth", "Overpass", Arial, sans-serif;
    display: block;
    color: #000000;
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }

  .skill-info p {
    font-family: "Overpass", Arial, sans-serif;
    margin: 0;
    color: #000000;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .skill input,
  .skill textarea {
    border: 1px solid rgba(212, 175, 55, 0.5);
    border-radius: 6px;
    color: #f4f1e8;
    padding: 0.5rem;
    background: white;
    color: black;
    border-color: black;
  }

  .skill input:focus,
  .skill textarea:focus {
    outline: none;
    border-color: #d4af37;
    box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.3);
  }

  .skill input::placeholder,
  .skill textarea::placeholder {
    color: rgba(244, 241, 232, 0.5);
  }

  .skill textarea {
    resize: vertical;
    min-height: 60px;
  }

  .skill .input-title {
    font-family: "Eveleth Dot", "Eveleth", "Overpass", Arial, sans-serif;
    color: #000000;
  }

  .skill .input-text {
    font-family: "Overpass", Arial, sans-serif;
    color: #000000;
  }

  .member {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding-left: 37px;
    background-repeat: no-repeat !important;
    background-size: 32px 32px !important;
    background-position: left center !important;
    min-height: 32px;
    font-size: 0.85em;
  }

  .member span {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .group-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-values {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-values input {
    width: 32px;
    text-align: center;
    background: rgba(0, 0, 0, 0.1);
    color: #f9fafb;
    border: 1px solid #6b7280;
    border-radius: 4px;
    padding: 0.125rem;
    font-weight: bold;
    font-size: 1.1em;
  }

  .stat-values input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .stat-mod {
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.1em;
  }

  .stat-total {
    font-size: 0.9em;
    color: #888;
  }

  .stat-separator {
    width: 2px;
    height: 60px;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      rgba(255, 255, 255, 0.3) 20%,
      rgba(255, 255, 255, 0.6) 50%,
      rgba(255, 255, 255, 0.3) 80%,
      transparent 100%
    );
    margin: 0 0.5rem;
    flex-shrink: 0;
  }

  .stat-icon {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: transform 0.2s ease;
    height: 100%;
  }

  .stat-icon:hover {
    transform: scale(1.1);
  }

  .stat-icon img {
    width: 48px;
    height: 48px;
  }

  .group-stat-container {
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex: 0 0 auto;
  }

  .delete-button {
    width: 20px;
    height: 20px;
    min-width: 20px;
    min-height: 20px;
    padding: 0;
    border: 1px solid #666;
    background: #ff4444;
    color: white;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    align-self: flex-start;
    margin-top: 2px;
  }

  .delete-button:hover {
    background: #ff6666;
  }
</style>

<div class="groups">
  {#each groups as group, i}
    <div
      class="group {group.officer ? 'has-officer' : ''} {collapsed[group.id] ? 'collapsed' : ''}"
    >
      <!-- Officer Image (visible element, not background) -->
      {#if group.officer}
        <img
          src={group.officer.img}
          alt={group.officer.name}
          class="officer-image"
        />
      {/if}
      <!-- Officer Drop Zone (left side where image is) -->
      <div
        class="officer-drop-zone {group.officer ? 'has-officer' : ''}"
        role="button"
        tabindex="0"
        aria-label={labels.officerDrop}
        on:dragover|preventDefault
        on:drop={(e) => onDropOfficer(e, group)}
        on:dblclick={() => group.officer ? openActorSheet(group.officer.id) : null}
        style="cursor: {group.officer ? 'pointer' : 'default'};"
        title={group.officer ? "Double-click to open character sheet" : labels.officerDrop}
      >
        {#if !group.officer}
          <em style="text-align: center; font-size: 0.8em; color: #999;">
            {labels.officerDrop}
          </em>
        {/if}
      </div>

      <!-- Group Header with editable name -->
      <div class="group-header">
        <div class="group-header-left">
          {#if editing[group.id]}
            <input
              type="text"
              bind:value={group.name}
              placeholder="Patrol name"
              class="group-name-input"
              on:change={persist}
            />
          {:else}
            <strong>{group.name || (group.officer ? `${labels.groupSingular} of ${group.officer.name}` : 'New ' + labels.groupSingular)}</strong>
          {/if}
        </div>
        <div class="group-header-buttons">
                    {#if editing[group.id]}

          <button class="standard-button" on:click={() => removeGroup(i)} >
            X
          </button>
                    {/if}

          <button class="standard-button" on:click={() => toggleEditing(group)}>
            {editing[group.id] ? 'Save' : 'Edit'}
          </button>
          {#if game.user?.isGM}
            <button class="standard-button" on:click={() => showPatrolSheet(group)}  title="Abrir ficha para mí">
              Ficha
            </button>
            <button class="standard-button" on:click={() => forceShowPatrolSheetToAll(group)} title="Mostrar ficha a todos los jugadores">
              Ficha→All
            </button>
          {:else}
            <button class="standard-button" on:click={() => showPatrolSheet(group)}>
              Ficha
            </button>
          {/if}
          <button
            class="standard-button"
            draggable="true"
            on:click={() => deployGroup(group)}
            on:dragstart={(e) => onDragDeploy(e, group)}
          >
            Deploy
          </button>
          <button class="standard-button" on:click={() => toggleCollapsed(group)}>
            {collapsed[group.id] ? '▼' : '▲'}
          </button>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="group-content">
        <!-- Officer Info (moved above soldiers) -->


        <!-- Group Stats and Edit Button -->
        <div class="stats-and-edit-container">
          <div class="group-stat-container">
            {#each stats as stat, index}
              <div class="group-stat">
                <Tooltip content={`<span>${stat.name}</span>`}>
                  <button class="stat-icon" on:click={() => roll(stat, group)}>
                    <img src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} />
                  </button>
                </Tooltip>
                <div class="stat-values">
                  {#if editing[group.id]}
                    <input type="number" bind:value={group.mods[stat.key]} on:change={persist} />
                    <div class="stat-total">({totalStat(stat, group)})</div>
                  {:else}
                    <div class="stat-mod">{group.mods[stat.key] || 0}</div>
                    <div class="stat-total">({totalStat(stat, group)})</div>
                  {/if}
                </div>
              </div>
              {#if index < stats.length - 1}
                <div class="stat-separator"></div>
              {/if}
            {/each}
          </div>

                <!-- Soldiers Section -->
        <div
          class="drop-zone soldiers"
          role="button"
          tabindex="0"
          aria-label={labels.soldierDrop}
          on:dragover|preventDefault
          on:drop={(e) => onDropSoldier(e, group)}
        >
          {#if group.soldiers && group.soldiers.length > 0}
            {#each group.soldiers as soldier}
              <div
                class="member"
                role="button"
                tabindex="0"
                draggable="true"
                on:dragstart={(e) => onDragMember(e, soldier)}
                on:dblclick={() => openActorSheet(soldier.id)}
                style={`background-image: url('${soldier.img}'); cursor: pointer;`}
                title="Double-click to open character sheet"
              >
                <span>{soldier.name}</span>
                {#if editing[group.id]}
                  <button class="delete-button" on:click={() => removeSoldier(group, soldier)}>X</button>
                {/if}
              </div>
            {/each}
          {:else}
            <em>{labels.soldierDrop}</em>
          {/if}
        </div>
        </div>

        {#if !collapsed[group.id]}

        <!-- Skills -->
        {#if group.skills.length > 0 || editing[group.id]}
          <div class="skills">
            <div style="display: flex; justify-content: space-between; align-items: center; height: 28px; margin-bottom: 0.5rem;">
              <strong style="margin: 0; line-height: 28px;">Skills</strong>
              {#if editing[group.id]}
                <button on:click={() => addSkill(group)}>Add Skill</button>
              {/if}
            </div>
            {#each group.skills as sk, j}
              <div class="skill">
                {#if editing[group.id]}
                  <button type="button" class="skill-image-button" on:click={() => chooseSkillImage(sk)}>
                    <img src={sk.img} alt="" />
                  </button>
                  <div style="display: flex; flex-direction: column; gap: 0.25rem; flex: 1;">
                    <input
                      class="input-title"
                      placeholder="Name"
                      bind:value={sk.name}
                      on:change={persist}
                      on:keydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); persist(); } }}
                    />
                    <textarea
                      class="input-text"
                      placeholder="Description"
                      bind:value={sk.description}
                      on:change={persist}
                      on:keydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); persist(); } }}
                    ></textarea>
                  </div>
                  <button class="delete-button" on:click={() => removeSkill(group, j)}>X</button>
                {:else}
                  <div class="skill-display" role="button" tabindex="0"
                       on:click={() => showSkillInChat(sk, group)}
                       on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showSkillInChat(sk, group); } }}>
                    <div class="skill-image">
                      <img src={sk.img} alt="" />
                    </div>
                    <div class="skill-info">
                      <strong>{sk.name}</strong>
                      <p>{sk.description}</p>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        {/if}
      </div>
    </div>
  {/each}
  <button on:click={addGroup}>{labels.addGroup}</button>
</div>
