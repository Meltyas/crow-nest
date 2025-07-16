<script context="module" lang="ts">
  declare const FilePicker: any;
  declare const game: any;
  declare const Dialog: any;
</script>

<script lang="ts">
  import { patrolSheetManager } from '@/components/patrol-sheet/patrol-sheet';
  import RollDialogStandalone from '@/components/roll-dialog/roll-dialog-standalone.svelte';
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
  const Dialog = (globalThis as any).Dialog;

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
  let patrolExtraInfo: Record<string, boolean> = {}; // Track which extra info containers are floating

  // Roll dialog state
  let rollDialogOpen = false;
  let rollDialogStat: GuardStat | null = null;
  let rollDialogGroup: Group | null = null;
  let rollDialogBaseValue = 0;
  let rollDialogTotalModifier = 0;

  // Sync manager
  let syncManager: SyncManager;

  onMount(() => {
    stats = getStats() as GuardStat[];
    modifiers = getModifiers();

    // Migrate existing groups to have maxSoldiers, hope and maxHope if they don't have them
    let needsUpdate = false;
    const currentGroups = [...groups];
    for (const group of currentGroups) {
      if (group.maxSoldiers === undefined) {
        group.maxSoldiers = 5;
        needsUpdate = true;
      }
      if (group.hope === undefined) {
        group.hope = 0;
        needsUpdate = true;
      }
      if (group.maxHope === undefined) {
        group.maxHope = 3;
        needsUpdate = true;
      }
      if (group.experiences === undefined) {
        group.experiences = [];
        needsUpdate = true;
      } else {
        // Migrate experiences to include value if missing
        let experiencesUpdated = false;
        group.experiences = group.experiences.map(exp => {
          if (exp.value === undefined) {
            experiencesUpdated = true;
            return { name: exp.name, value: 0 };
          }
          return exp;
        });
        if (experiencesUpdated) {
          needsUpdate = true;
        }
      }
    }
    if (needsUpdate) {
      groupsStore.set(currentGroups);
      persist();
    }

    // Setup real-time synchronization only for stats and modifiers
    syncManager = SyncManager.getInstance();

    // Listen for stats and modifiers updates (for UI updates)
    syncManager.subscribe('stats', handleStatsSync);
    syncManager.subscribe('modifiers', handleModifiersSync);

    // Add global click listener to close floating containers
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as Element;
      if (target && !target.closest('.floating-extra-info-container') && !target.closest('.header-button') && !target.closest('.skill-delete-floating')) {
        // Close any open floating containers
        let hasOpenContainers = false;
        for (const groupId in patrolExtraInfo) {
          if (patrolExtraInfo[groupId]) {
            patrolExtraInfo[groupId] = false;
            hasOpenContainers = true;
          }
        }
        if (hasOpenContainers) {
          patrolExtraInfo = { ...patrolExtraInfo };
        }
      }
    };

    document.addEventListener('click', handleGlobalClick);

    // Cleanup function
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };

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
        experiences: [],
        maxSoldiers: 5,
        hope: 0,
        maxHope: 3,
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

    const maxSoldiers = group.maxSoldiers || 5;

    // Find the first empty slot in the formation
    let targetIndex = -1;
    for (let i = 0; i < maxSoldiers; i++) {
      if (!group.soldiers[i]) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) {
      // All slots are occupied, replace the last one
      targetIndex = maxSoldiers - 1;
    }

    // Ensure soldiers array has the correct number of slots
    while (group.soldiers.length < maxSoldiers) {
      group.soldiers.push(null);
    }

    group.soldiers[targetIndex] = {
      id: actor.id || '',
      name: actor.name || '',
      img: actor.img || '',
    };

    groups = [...groups];
    persist();
  }

  async function onDropSoldierAtPosition(event: DragEvent, group: Group, position: number) {
    event.preventDefault();
    const actor = await actorFromDrop(event);
    if (!actor) return;

    const maxSoldiers = group.maxSoldiers || 5;

    // Ensure soldiers array has the correct number of slots
    while (group.soldiers.length < maxSoldiers) {
      group.soldiers.push(null);
    }

    // Always allow placing the actor in the target position (allow duplicates)
    group.soldiers[position] = {
      id: actor.id || '',
      name: actor.name || '',
      img: actor.img || '',
    };

    groups = [...groups];
    persist();
  }

  function removeSoldierAtPosition(group: Group, position: number) {
    if (position >= 0 && position < group.soldiers.length) {
      group.soldiers[position] = null;
      groups = [...groups];
      persist();
    }
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
    rollDialogStat = stat;
    rollDialogGroup = group;
    rollDialogBaseValue = stat.value;
    rollDialogTotalModifier = guardBonus(stat.key) + (group.mods[stat.key] || 0);
    rollDialogOpen = true;
  }

  function closeRollDialog() {
    rollDialogOpen = false;
    rollDialogStat = null;
    rollDialogGroup = null;
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

  function toggleSkillsFloating(group: Group) {
    patrolExtraInfo[group.id] = !patrolExtraInfo[group.id];
    patrolExtraInfo = { ...patrolExtraInfo }; // Trigger reactivity
  }

  function handleMaxSoldiersChange(group: Group) {
    const maxSoldiers = group.maxSoldiers || 5;

    // Adjust soldiers array to match the new max
    if (group.soldiers.length < maxSoldiers) {
      // Add null slots if we need more
      while (group.soldiers.length < maxSoldiers) {
        group.soldiers.push(null);
      }
    } else if (group.soldiers.length > maxSoldiers) {
      // When reducing from 6 to 5, remove the 6th soldier (index 5)
      // This will free up the soldier that was in the 6th position
      group.soldiers = group.soldiers.slice(0, maxSoldiers);
    }

    groups = [...groups];
    persist();
  }

  function setHopeLevel(group: Group, level: number) {
    const maxHope = group.maxHope || 3;
    group.hope = Math.min(level, maxHope); // Ensure hope doesn't exceed maxHope
    groups = [...groups];
    persist();
  }

  function handleMaxHopeChange(group: Group) {
    const maxHope = group.maxHope || 3;

    // If current hope exceeds new max, reduce it to new max
    if (group.hope > maxHope) {
      group.hope = maxHope;
    }

    groups = [...groups];
    persist();
  }

  function addExperience(group: Group) {
    // Use Foundry's Dialog system instead of prompt()
    if (!Dialog) {
      console.error("Dialog not available");
      return;
    }

    new Dialog({
      title: "Añadir Experiencia",
      content: `
        <form>
          <div class="form-group">
            <label>Nombre de la experiencia:</label>
            <input type="text" name="experienceName" placeholder="Introduce el nombre" autofocus />
          </div>
          <div class="form-group">
            <label>Valor de la experiencia:</label>
            <input type="number" name="experienceValue" placeholder="Introduce el valor (+/-)" value="0" />
            <small>Valores positivos dan bonificaciones, valores negativos dan penalizaciones</small>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          icon: '<i class="fas fa-check"></i>',
          label: "Añadir",
          callback: (html: any) => {
            const form = html[0].querySelector("form");
            const experienceName = form.experienceName.value.trim();
            const experienceValue = parseInt(form.experienceValue.value) || 0;
            if (experienceName) {
              group.experiences = group.experiences || [];
              group.experiences.push({ 
                name: experienceName, 
                value: experienceValue 
              });
              groups = [...groups]; // Trigger reactivity
              persist();
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar"
        }
      },
      default: "ok"
    }).render(true);
  }

  function removeExperience(group: Group, index: number) {
    group.experiences.splice(index, 1);
    persist();
  }
</script>

<style>
  .group {
    border: 1px solid #666;
    padding: 0.5rem;
    margin-bottom: 0;
    position: relative;
    min-height: 120px;
    width: calc(50% - 0.5rem);
    flex: 0 0 calc(50% - 0.5rem);
    overflow: visible; /* Allow floating container to extend outside */
  }

  .group-header {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    right: 0.5rem;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2;
    background: rgba(0, 0, 0, 0.7);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .group-header-left {
    flex: 1;
    min-width: 0;
    text-align: center;
  }

  .group-header-buttons {
    position: absolute;
    top: 2.5rem;
    left: 0.5rem;
    right: 0.5rem;
    display: flex;
    gap: 0.25rem;
    justify-content: center;
    flex-wrap: wrap;
    z-index: 2;
    background: rgba(0, 0, 0, 0.5);
    padding: 0.25rem;
    border-radius: 4px;
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
    padding-top: 4.5rem; /* Space for the header and buttons */
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

  .skills {
    border-radius: 8px;
    padding-top: .25rem;
  }

  .skill {
    display: flex;
    align-items: flex-start;
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
    position: relative;
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

  .skill-delete-floating {
    position: absolute;
    bottom: -26px;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    height: 20px;
    background: #ff4444;
    color: white;
    border: none;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 40;
  }

  .skill-delete-floating:hover {
    background: #ff0000;
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
    width: 100%;
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

  .group-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    min-width: 60px;
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
    width: 36px;
    height: 36px;
  }

  .group-stat-container {
    align-self: center;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex: 0 0 auto;
    justify-content: center;
    flex-wrap: wrap;
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

  .groups {
    padding: 0.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    overflow: visible; /* Allow floating containers to extend outside */
  }

  /* Dynamic Formation Styles - Pentagon/Hexagon */
  .formation-and-stats-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: .5rem;
    margin: .25rem 0 0 0;
  }

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

  .pentagon-point {
    position: absolute;
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
    display: flex
;
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

  /* Floating Extra Info Container */
  .floating-extra-info-container {
    position: absolute;
    top: 0;
    width: 100%; /* Same width as parent group */
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    border: 2px solid #d4af37;
    border-radius: 8px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }

  .floating-extra-info-container.open-right {
    left: 100%;
  }

  .floating-extra-info-container.open-left {
    right: 100%;
  }

  .floating-extra-info-content {
    flex: 1;
    padding: 0.5rem;
    overflow-y: auto;
    max-height: 100%;
  }

  .floating-extra-info-content .skill {
    background: rgba(255, 255, 255, 0.95);
  }

  /* Hope Meter Styles */
  .hope-meter {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .hope-label {
    font-weight: bold;
    color: #d4af37;
    font-size: 1rem;
    margin-right: 0.5rem;
  }

  .hope-circles {
    display: flex;
    gap: 0.25rem;
  }

  .hope-circle {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    padding: 0;
    width: 20px;
    height: 20px;
    position: relative;
  }

  .hope-circle:hover {
    transform: scale(1.1);
  }

  .hope-circle-shape {
    width: 14px;
    height: 14px;
    transition: all 0.2s ease;
  }

  /* Empty circle */
  .hope-circle-empty {
    height: 16px;
    width: 16px;
    border-radius: 50%;
    border: 2px solid #d4af37;
    background: transparent;
  }

  /* Filled diamond */
  .hope-circle-filled {
    background: #d4af37;
    transform: rotate(45deg);
    border-radius: 2px;
  }

  .hope-circle:hover .hope-circle-empty {
    border-color: #ffd700;
  }

  .hope-circle:hover .hope-circle-filled {
    background: #ffd700;
  }
</style>

<div class="groups">
  {#each groups as group, i}
    <div
      class="group {group.officer ? 'has-officer' : ''}"
    >

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
            <strong>{group.name || (group.officer ? `${labels.groupSingular} de ${group.officer.name}` : 'New ' + labels.groupSingular)}</strong>
          {/if}
        </div>
      </div>

      <!-- Group Buttons (below title) -->
      <div class="group-header-buttons">
        {#if i % 2 === 0}
          <!-- Even patrols: arrow on the right, opens to the right -->
          {#if editing[group.id]}
            <button class="header-button" on:click={() => removeGroup(i)} >
              X
            </button>
          {/if}

          <button class="header-button" on:click={() => toggleEditing(group)}>
            {editing[group.id] ? 'Save' : 'Edit'}
          </button>
          {#if game.user?.isGM}
            <button class="header-button" on:click={() => showPatrolSheet(group)}  title="Abrir ficha para mí">
              Ficha
            </button>
            <button class="header-button" on:click={() => forceShowPatrolSheetToAll(group)} title="Mostrar ficha a todos los jugadores">
              Ficha→All
            </button>
          {:else}
            <button class="header-button" on:click={() => showPatrolSheet(group)}>
              Ficha
            </button>
          {/if}
          <button
            class="header-button"
            draggable="true"
            on:click={() => deployGroup(group)}
            on:dragstart={(e) => onDragDeploy(e, group)}
          >
            Deploy
          </button>
          <button class="header-button" on:click={() => toggleSkillsFloating(group)}>
            {patrolExtraInfo[group.id] ? '◀' : '▶'}
          </button>
        {:else}
          <!-- Odd patrols: arrow on the left, opens to the left -->
          <button class="header-button" on:click={() => toggleSkillsFloating(group)}>
            {patrolExtraInfo[group.id] ? '▶' : '◀'}
          </button>
          {#if editing[group.id]}
            <button class="header-button" on:click={() => removeGroup(i)} >
              X
            </button>
          {/if}

          <button class="header-button" on:click={() => toggleEditing(group)}>
            {editing[group.id] ? 'Save' : 'Edit'}
          </button>
          {#if game.user?.isGM}
            <button class="header-button" on:click={() => showPatrolSheet(group)}  title="Abrir ficha para mí">
              Ficha
            </button>
            <button class="header-button" on:click={() => forceShowPatrolSheetToAll(group)} title="Mostrar ficha a todos los jugadores">
              Ficha→All
            </button>
          {:else}
            <button class="header-button" on:click={() => showPatrolSheet(group)}>
              Ficha
            </button>
          {/if}
          <button
            class="header-button"
            draggable="true"
            on:click={() => deployGroup(group)}
            on:dragstart={(e) => onDragDeploy(e, group)}
          >
            Deploy
          </button>
        {/if}
      </div>

      <!-- Main Content Area -->
      <div class="group-content">
        <!-- Officer Info (moved above soldiers) -->


        <!-- Formation and Stats Container -->
        <div class="formation-and-stats-container">
          <!-- Hope Meter -->
          <div class="hope-meter">
            <span class="hope-label">HOPE</span>
            <div class="hope-circles">
              {#each Array(group.maxHope || 3) as _, index}
                <button
                  class="hope-circle"
                  on:click={() => setHopeLevel(group, index + 1)}
                  title="Hope level {index + 1}"
                >
                  <div class="hope-circle-shape {(group.hope || 0) > index ? 'hope-circle-filled' : 'hope-circle-empty'}"></div>
                </button>
              {/each}
            </div>
          </div>

          <!-- Dynamic Formation (Officer + Soldiers) -->
          <div class="formation-container">
            <!-- Officer Center Position -->
            <div class="formation-center officer-position">
              <div
                class="formation-slot officer-slot {group.officer ? 'occupied' : 'empty'}"
                role="button"
                tabindex="0"
                aria-label={labels.officerDrop}
                on:dragover|preventDefault
                on:drop={(e) => onDropOfficer(e, group)}
                on:dblclick={() => group.officer ? openActorSheet(group.officer.id) : null}
                title={group.officer ? `${group.officer.name} - Double-click to open` : labels.officerDrop}
              >
                {#if group.officer}
                  <img src={group.officer.img} alt={group.officer.name} class="formation-avatar" />
                  <div class="formation-name">{group.officer.name}</div>
                  {#if editing[group.id]}
                    <button class="formation-remove" on:click={() => removeOfficer(group)}>×</button>
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
                  on:dragover|preventDefault
                  on:drop={(e) => onDropSoldierAtPosition(e, group, slotIndex)}
                  on:dblclick={() => soldier ? openActorSheet(soldier.id) : null}
                  title={soldier ? `${soldier.name} - Double-click to open` : `Soldier position ${slotIndex + 1}`}
                >
                  {#if soldier}
                    <img
                      src={soldier.img}
                      alt={soldier.name}
                      class="formation-avatar"
                      draggable="true"
                      on:dragstart={(e) => onDragMember(e, soldier)}
                    />
                    <div class="formation-name">{soldier.name}</div>
                    {#if editing[group.id]}
                      <button class="formation-remove" on:click={() => removeSoldierAtPosition(group, slotIndex)}>×</button>
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

          <!-- Group Stats (below pentagon) -->
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
        </div>

        <!-- Content when not collapsed - currently only skills are in floating container -->
      </div>

      <!-- Floating Extra Info Container (inside group) -->
      {#if patrolExtraInfo[group.id]}
        <div class="floating-extra-info-container {i % 2 === 0 ? 'open-right' : 'open-left'}"
             role="dialog"
             aria-label="Extra information panel">
          <div class="floating-extra-info-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <strong style="margin: 0;">Skills</strong>
              {#if editing[group.id]}
                <button on:click={() => addSkill(group)}>+</button>
              {/if}
            </div>
            {#each group.skills as sk, j}
              <div class="skill">
                {#if editing[group.id]}
                  <div style="position: relative;">
                    <button type="button" class="skill-image-button" on:click={() => chooseSkillImage(sk)}>
                      <img src={sk.img} alt="" />
                    </button>
                    <button class="skill-delete-floating" on:click={() => removeSkill(group, j)}>×</button>
                  </div>
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

            <!-- Soldados Máximos Section -->
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #d4af37;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <label for="maxSoldiers-{group.id}" style="color: #d4af37; font-weight: bold;">Soldados Máximos:</label>
                <select id="maxSoldiers-{group.id}" bind:value={group.maxSoldiers} on:change={() => handleMaxSoldiersChange(group)} style="background: rgba(255, 255, 255, 0.9); border: 1px solid #d4af37; border-radius: 4px; padding: 0.25rem; color: #000;">
                  <option value={5}>5</option>
                  <option value={6}>6</option>
                </select>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <label for="maxHope-{group.id}" style="color: #d4af37; font-weight: bold;">Hope Máximo:</label>
                <select id="maxHope-{group.id}" bind:value={group.maxHope} on:change={() => handleMaxHopeChange(group)} style="background: rgba(255, 255, 255, 0.9); border: 1px solid #d4af37; border-radius: 4px; padding: 0.25rem; color: #000;">
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                  <option value={6}>6</option>
                </select>
              </div>
            </div>

            <!-- Experiences Section -->
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #d4af37;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <strong style="margin: 0;">Experiences</strong>
                {#if editing[group.id]}
                  <button on:click={() => addExperience(group)}>+</button>
                {/if}
              </div>
              {#each group.experiences as exp, expIndex}
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                  {#if editing[group.id]}
                    <input
                      type="text"
                      bind:value={exp.name}
                      placeholder="Experience name"
                      style="flex: 1; padding: 0.25rem; border: 1px solid #d4af37; border-radius: 4px; background: rgba(255, 255, 255, 0.9); color: #000;"
                      on:change={persist}
                    />
                    <input
                      type="number"
                      bind:value={exp.value}
                      placeholder="Value"
                      style="width: 60px; padding: 0.25rem; border: 1px solid #d4af37; border-radius: 4px; background: rgba(255, 255, 255, 0.9); color: #000;"
                      on:change={persist}
                    />
                    <button
                      on:click={() => removeExperience(group, expIndex)}
                      style="padding: 0.25rem 0.5rem; background: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer;"
                    >
                      ×
                    </button>
                  {:else}
                    <div style="flex: 1; padding: 0.25rem; background: rgba(255, 255, 255, 0.9); border-radius: 4px; color: #000; display: flex; align-items: center; justify-content: space-between;">
                      <span>{exp.name}</span>
                      <span style="font-weight: bold; color: {exp.value >= 0 ? '#28a745' : '#dc3545'};">
                        {exp.value >= 0 ? '+' : ''}{exp.value || 0}
                      </span>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/each}
  <div style="width: 100%; display: flex; justify-content: center; margin-top: 1rem;">
    <button on:click={addGroup} style="padding: 0.5rem 1rem;">{labels.addGroup}</button>
  </div>
</div>

<!-- Roll Dialog Component -->
<RollDialogStandalone
  bind:isOpen={rollDialogOpen}
  stat={rollDialogStat}
  group={rollDialogGroup}
  baseValue={rollDialogBaseValue}
  totalModifier={rollDialogTotalModifier}
  guardModifiers={modifiers}
  on:close={closeRollDialog}
/>
