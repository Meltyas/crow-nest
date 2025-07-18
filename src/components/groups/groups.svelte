<script context="module" lang="ts">
  declare const FilePicker: any;
  declare const game: any;
  declare const Dialog: any;
</script>

<script lang="ts">
  import { getAdmins } from '@/admin/admins';
  import PatrolLayout from '@/components/patrol-layout/patrol-layout.svelte';
  import { patrolSheetManager } from '@/components/patrol-sheet/patrol-sheet';
  import { presetManager } from '@/components/presets/preset-manager';
  import RollDialogStandalone from '@/components/roll-dialog/roll-dialog-standalone.svelte';
  import Tooltip from '@/components/tooltip.svelte';
  import type { GuardModifier, GuardStat } from '@/guard/stats';
  import { getModifiers, getStats } from "@/guard/stats";
  import type { Group, GroupMember, GroupSkill } from "@/shared/group";
  import { adminsStore, persistAdmins } from '@/stores/admins';
  import { groupsStore, persistGroups } from '@/stores/groups';
  import { presetsStore } from '@/stores/presets';
  import { generateUUID } from '@/utils/log';
  import { SyncManager, type SyncEvent } from '@/utils/sync';
  import { onDestroy, onMount } from 'svelte';

  // Access game through global window object to avoid declaration issues
  const game = (globalThis as any).game;
  const FilePicker = (globalThis as any).FilePicker;
  const Dialog = (globalThis as any).Dialog;

  export const saveGroups: (groups: Group[]) => Promise<void> = async () => {}; // Legacy prop, not used anymore
  export let labels = {
    groupSingular: 'Patrulla',
    addGroup: 'Add Patrol',
    removeGroup: 'Remove Patrol',
    officerDrop: 'Drag Officer here',
    unitDrop: 'Drag units here',
  };
  export let isAdminMode = false; // Flag to detect if we're in admin mode
  export let sectionTitle = ''; // Optional section title
  export const sectionImage = ''; // Optional decorative image for section title

  // Use appropriate store based on isAdminMode
  $: currentStore = isAdminMode ? adminsStore : groupsStore;

  // Migration function to ensure all groups have required properties
  function migrateGroups(groups: Group[]): Group[] {
    return groups.map(group => ({
      ...group,
      soldiers: group.soldiers || [], // Ensure soldiers array exists
      maxSoldiers: group.maxSoldiers || 5, // Ensure maxSoldiers exists
    }));
  }

  // Get groups with migration applied
  $: groups = migrateGroups($currentStore);

  let stats: GuardStat[] = [];
  let modifiers: GuardModifier[] = [];
  let editing: Record<string, boolean> = {};
  let patrolExtraInfo: Record<string, boolean> = {}; // Track which extra info containers are floating

  // Drag and drop state for group reordering
  let draggedGroupIndex: number | null = null;
  let dragOverIndex: number | null = null;

  // Roll dialog state
  let rollDialogOpen = false;
  let rollDialogStat: GuardStat | null = null;
  let rollDialogGroup: Group | null = null;
  let rollDialogBaseValue = 0;
  let rollDialogTotalModifier = 0;

  // Patrol Effect application state
  let pendingPatrolEffect: any = null;
  let applyingPatrolEffect = false;

  // Sync manager
  let syncManager: SyncManager;

  // Handler for preset updates to sync temporary modifiers
  function handlePresetUpdated(event: CustomEvent) {
    console.log('Groups.svelte - Recibiendo evento handlePresetUpdated:', event.detail);
    const { preset } = event.detail;

    // Validar que el preset tenga la estructura correcta
    if (!preset || !preset.type || !preset.data) {
      console.warn('Groups.svelte - Preset inválido:', preset);
      return;
    }

    // Solo procesar presets de efectos de patrulla
    if (preset.type === 'patrolEffect' && preset.data.sourceId) {
      console.log('Groups.svelte - Procesando preset de efecto de patrulla:', preset);

      // Use the preset's sourceId directly - no need to generate a new one
      const searchSourceId = preset.data.sourceId;

      console.log('Groups.svelte - Buscando modificadores con sourceId:', searchSourceId);

      // Buscar y actualizar todos los efectos de patrulla en todos los grupos que tengan el mismo sourceId
      let hasUpdates = false;
      const updatedGroups = groups.map(group => {
        if (!group.patrolEffects) return group;

        console.log('Groups.svelte - Revisando grupo:', group.name);
        console.log('Groups.svelte - Efectos en grupo:', Object.keys(group.patrolEffects));

        // Log all modifiers in this group for debugging
        for (const [effectId, effect] of Object.entries(group.patrolEffects)) {
          console.log('Groups.svelte - Efecto ID:', effectId, 'sourceId:', effect.sourceId, 'key:', effect.key);
        }

        // Buscar efectos que coincidan con el sourceId
        const updatedEffects = { ...group.patrolEffects };
        let groupHasUpdates = false;

        for (const [effectId, effect] of Object.entries(updatedEffects)) {
          console.log('Groups.svelte - Comparando:', effect.sourceId, '===', searchSourceId);
          if (effect.sourceId === searchSourceId) {
            console.log('Groups.svelte - ¡MATCH! Actualizando efecto de patrulla en grupo:', group.name, effect);

            // Actualizar el efecto con los datos del preset
            updatedEffects[effectId] = {
              ...effect,
              name: preset.data.name,
              description: preset.data.description || '',
              statEffects: preset.data.statEffects || {}
            };

            groupHasUpdates = true;
            hasUpdates = true;
          }
        }

        if (groupHasUpdates) {
          return { ...group, patrolEffects: updatedEffects };
        }

        return group;
      });

      if (hasUpdates) {
        // Actualizar los grupos con los efectos de patrulla actualizados
        updateGroups(updatedGroups);
        console.log('Groups.svelte - Efectos de patrulla actualizados desde preset');
      } else {
        console.log('Groups.svelte - No se encontraron efectos para actualizar con sourceId:', searchSourceId);
      }
    }
  }

  // Create preset from a new patrol effect
  function createPatrolEffectPreset(effect) {
    const nameKey = effect.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const effectsKey = Object.keys(effect.statEffects).sort().join('-');
    const sourceId = `temp-${nameKey}-${effectsKey}`;

    // Check if preset already exists
    const existingPresets = $presetsStore.patrolEffect || [];
    const existingPreset = existingPresets.find(p => p.sourceId === sourceId);

    if (!existingPreset) {
      console.log('Groups.svelte - Creating new preset for effect:', effect);
      presetManager.createPresetFromExistingItem({
        name: effect.name,
        description: effect.description,
        statEffects: effect.statEffects,
        sourceId: sourceId
      }, 'patrolEffect');
    } else {
      console.log('Groups.svelte - Preset already exists for sourceId:', sourceId);
    }
  }

  onMount(() => {
    stats = getStats() as GuardStat[];
    modifiers = getModifiers();

    // Initialize appropriate store based on mode
    if (isAdminMode) {
      const admins = getAdmins();
      adminsStore.set(admins);
    }

    // Migrate existing groups to have maxUnits, hope and maxHope if they don't have them
    let needsUpdate = false;
    const currentGroups = [...groups];
    console.log('Groups.svelte - Starting migration check for', currentGroups.length, 'groups');

    for (const group of currentGroups) {
      if (group.maxUnits === undefined) {
        group.maxUnits = 5;
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
      if (group.soldiers === undefined) {
        group.soldiers = [];
        needsUpdate = true;
      }
      if (group.maxSoldiers === undefined) {
        group.maxSoldiers = 5;
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
      if (group.patrolEffects === undefined) {
        group.patrolEffects = {};
        needsUpdate = true;
      }
      
      // Migrate patrolEffects to patrolEffects
      if (group.patrolEffects && Object.keys(group.patrolEffects).length > 0) {
        console.log(`Groups.svelte - Migrating patrolEffects to patrolEffects for group: ${group.name}`);
        
        // Copy all patrolEffects to patrolEffects if patrolEffects is empty
        if (Object.keys(group.patrolEffects).length === 0) {
          for (const [modifierId, modifier] of Object.entries(group.patrolEffects)) {
            group.patrolEffects[modifierId] = {
              name: modifier.name,
              description: modifier.description,
              statEffects: modifier.statEffects,
              sourceId: modifier.sourceId,
              key: modifier.key
            };
          }
          needsUpdate = true;
          console.log(`Groups.svelte - Migrated ${Object.keys(group.patrolEffects).length} patrolEffects to patrolEffects`);
        }
        
        // Clear patrolEffects after migration
        delete (group as any).patrolEffects;
        needsUpdate = true;
      }
      
      // Ensure patrolEffects structure is correct
      if (group.patrolEffects) {
        // Migrate old patrolEffects format (single stat) to new format (multi-stat)
        let effectsUpdated = false;
        console.log(`Groups.svelte - Checking ${Object.keys(group.patrolEffects).length} effects in group: ${group.name}`);

        for (const [effectId, effect] of Object.entries(group.patrolEffects)) {
          console.log(`Groups.svelte - Checking effect ${effectId}:`, effect);

          // Check if it's the old format (has statKey and value)
          if ('statKey' in effect && 'value' in effect && !('statEffects' in effect)) {
            // Convert to new format
            const oldEffect = effect as any;
            group.patrolEffects[effectId] = {
              name: oldEffect.name,
              description: oldEffect.description,
              statEffects: {
                [oldEffect.statKey]: oldEffect.value
              }
            };
            effectsUpdated = true;
            console.log(`Groups.svelte - Converted old format effect: ${effectId}`);
          }

          // Ensure all effects have sourceId and key (for sync compatibility)
          if (!effect.sourceId && effect.name && effect.statEffects) {
            const nameKey = effect.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const effectsKey = Object.keys(effect.statEffects || {}).sort().join('-');
            const stableSourceId = `temp-${nameKey}-${effectsKey}`;

            effect.sourceId = stableSourceId;
            effect.key = stableSourceId;
            effectsUpdated = true;

            console.log(`Migrated effect "${effect.name}" to have sourceId: ${stableSourceId} in group: ${group.name}`);
          } else if (effect.sourceId) {
            console.log(`Effect "${effect.name}" already has sourceId: ${effect.sourceId} in group: ${group.name}`);
          } else {
            console.warn(`Effect in group ${group.name} missing required fields:`, effect);
          }
        }
        if (effectsUpdated) {
          needsUpdate = true;
          console.log(`Groups.svelte - Group ${group.name} needs update due to effect changes`);
        }
      }
    }
    if (needsUpdate) {
      console.log('Groups.svelte - Migration needed, updating groups');
      if (isAdminMode) {
        adminsStore.set(currentGroups);
      } else {
        groupsStore.set(currentGroups);
      }
      persist();
    } else {
      console.log('Groups.svelte - No migration needed');
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
        // Close any open floating containers, but keep them open if the patrol is being edited
        let hasOpenContainers = false;
        for (const groupId in patrolExtraInfo) {
          if (patrolExtraInfo[groupId] && !editing[groupId]) {
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

    // Listen for patrol effect application events
    const handlePatrolEffectApplication = (event: CustomEvent) => {
      pendingPatrolEffect = event.detail;
      applyingPatrolEffect = true;
    };

    window.addEventListener('crow-nest-apply-patrol-effect', handlePatrolEffectApplication);
    presetManager.addEventListener('presetUpdated', handlePresetUpdated);

    // Cleanup function
    return () => {
      document.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('crow-nest-apply-patrol-effect', handlePatrolEffectApplication);
      presetManager.removeEventListener('presetUpdated', handlePresetUpdated);
    };

    // Groups sync is handled globally, no need to subscribe here
  });

  onDestroy(() => {
    if (syncManager) {
      syncManager.unsubscribe('stats', handleStatsSync);
      syncManager.unsubscribe('modifiers', handleModifiersSync);
      // No need to unsubscribe from groups - it's global
    }

    // Remove preset manager listener if still available
    if (presetManager) {
      presetManager.removeEventListener('presetUpdated', handlePresetUpdated);
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
    if (isAdminMode) {
      await persistAdmins(groups);
    } else {
      await persistGroups(groups);
    }
  }

  // Helper function to update groups and sync
  function updateGroups(newGroups: Group[]) {
    groups = newGroups;
    if (isAdminMode) {
      adminsStore.set(groups);
    } else {
      groupsStore.set(groups);
    }
    persist();
  }

  function addGroup() {
    const newGroupId = generateUUID();
    groups = [
      ...groups,
      {
        id: newGroupId,
        name: '',
        officer: null,
        units: [],
        soldiers: [], // Add soldiers array for formation layout
        mods: {},
        skills: [],
        experiences: [],
        patrolEffects: {},
        maxUnits: 5,
        maxSoldiers: 5, // Add maxSoldiers for formation layout
        hope: 0,
        maxHope: 3,
      },
    ];
    persist();

    // Scroll to the new group after it's been added
    setTimeout(() => {
      const newGroupElement = document.querySelector(`[data-group-id="${newGroupId}"]`);
      if (newGroupElement) {
        newGroupElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
      }
    }, 100);
  }

  async function removeGroup(index: number) {
    const group = groups[index];
    const groupName = group?.name || labels.groupSingular;

    // Create confirmation dialog using Foundry's Dialog API
    const confirmed = await new Promise((resolve) => {
      const dialog = new Dialog({
        title: `Confirmar eliminación de ${labels.groupSingular}`,
        content: `
          <div style="text-align: center; padding: 20px;">
            <i class="fas fa-exclamation-triangle" style="color: #ff6b35; font-size: 2rem; margin-bottom: 10px;"></i>
            <h3 style="margin: 10px 0;">¿Estás seguro?</h3>
            <p style="margin: 15px 0;">
              ¿Realmente quieres eliminar la patrulla "<strong>${groupName}</strong>"?
            </p>
            <p style="color: #888; font-size: 0.9rem; margin-top: 15px;">
              Esta acción no se puede deshacer.
            </p>
          </div>
        `,
        buttons: {
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancelar",
            callback: () => resolve(false)
          },
          confirm: {
            icon: '<i class="fas fa-trash"></i>',
            label: "Eliminar",
            callback: () => resolve(true)
          }
        },
        default: "cancel",
        close: () => resolve(false)
      });
      dialog.render(true);
    });

    // Only proceed if user confirmed
    if (confirmed) {
      groups.splice(index, 1);
      groups = [...groups];
      persist();

      // Show success notification
      ui.notifications?.info(`Patrulla "${groupName}" eliminada exitosamente.`);
    }
  }

  function toggleEditing(group: Group) {
    const wasEditing = editing[group.id];

    // If starting to edit this group, close any other group that's being edited
    if (!wasEditing) {
      for (const groupId in editing) {
        if (editing[groupId] && groupId !== group.id) {
          editing[groupId] = false;
          // Also close the floating-extra for the previously edited group
          patrolExtraInfo[groupId] = false;
        }
      }
    }

    editing[group.id] = !editing[group.id];
    editing = { ...editing }; // Trigger reactivity

    // When starting to edit, show the floating-extra automatically
    if (!wasEditing && editing[group.id]) {
      patrolExtraInfo[group.id] = true;
      patrolExtraInfo = { ...patrolExtraInfo };
    }

    // When stopping editing (saving), close the floating-extra
    if (wasEditing && !editing[group.id]) {
      patrolExtraInfo[group.id] = false;
      patrolExtraInfo = { ...patrolExtraInfo };
    }
  }

  function removeOfficer(group: Group) {
    group.officer = null;
    groups = [...groups];
    persist();
  }

  function removeUnit(group: Group, unit: GroupMember) {
    const index = group.units.indexOf(unit);
    if (index > -1) {
      group.units.splice(index, 1);
      group.units = [...group.units];
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

  async function onDropUnit(event: DragEvent, group: Group) {
    const actor = await actorFromDrop(event);
    if (!actor) return;

    const maxUnits = group.maxUnits || 5;

    // Find the first empty slot in the formation
    let targetIndex = -1;
    for (let i = 0; i < maxUnits; i++) {
      if (!group.units[i]) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1) {
      // All slots are occupied, replace the last one
      targetIndex = maxUnits - 1;
    }

    // Ensure units array has the correct number of slots
    while (group.units.length < maxUnits) {
      group.units.push(null);
    }

    group.units[targetIndex] = {
      id: actor.id || '',
      name: actor.name || '',
      img: actor.img || '',
    };

    groups = [...groups];
    persist();
  }

  async function onDropUnitAtPosition(event: DragEvent, group: Group, position: number) {
    event.preventDefault();
    const actor = await actorFromDrop(event);
    if (!actor) return;

    const maxUnits = group.maxUnits || 5;

    // Ensure units array has the correct number of slots
    while (group.units.length < maxUnits) {
      group.units.push(null);
    }

    // Always allow placing the actor in the target position (allow duplicates)
    group.units[position] = {
      id: actor.id || '',
      name: actor.name || '',
      img: actor.img || '',
    };

    groups = [...groups];
    persist();
  }

  function removeUnitAtPosition(group: Group, position: number) {
    if (position >= 0 && position < group.units.length) {
      group.units[position] = null;
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
    patrolSheetManager.forceShowPatrolSheetToAll(group, labels);
  }

  function guardBonus(key: string): number {
    return modifiers.reduce((acc, m) => acc + (m.mods[key] || 0), 0);
  }

  function totalStat(stat: GuardStat, group: Group): number {
    // Calculate patrol effects for this stat
    const patrolEffectMod = Object.values(group.patrolEffects || {})
      .reduce((sum, effect) => sum + (effect.statEffects[stat.key] || 0), 0);

    return stat.value + guardBonus(stat.key) + (group.mods[stat.key] || 0) + patrolEffectMod;
  }

  function roll(stat: GuardStat, group: Group) {
    rollDialogStat = stat;
    rollDialogGroup = group;
    rollDialogBaseValue = stat.value;

    // Calculate patrol effects for this stat
    const patrolEffectMod = Object.values(group.patrolEffects || {})
      .reduce((sum, effect) => sum + (effect.statEffects[stat.key] || 0), 0);

    rollDialogTotalModifier = guardBonus(stat.key) + (group.mods[stat.key] || 0) + patrolEffectMod;
    rollDialogOpen = true;
  }

  function closeRollDialog() {
    rollDialogOpen = false;
    rollDialogStat = null;
    rollDialogGroup = null;
  }

  async function deployGroup(group: Group) {
    if (!group.officer && (!group.units || group.units.length === 0)) {
      ui.notifications?.warn("No members in the group to deploy");
      return;
    }

    const members = [] as GroupMember[];
    if (group.officer) members.push(group.officer);
    members.push(...group.units);

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
    // Always allow manual toggle with the button, even when editing
    patrolExtraInfo[group.id] = !patrolExtraInfo[group.id];
    patrolExtraInfo = { ...patrolExtraInfo }; // Trigger reactivity
  }

  function handleMaxUnitsChange(group: Group) {
    const maxUnits = group.maxUnits || 5;

    // Adjust units array to match the new max
    if (group.units.length < maxUnits) {
      // Add null slots if we need more
      while (group.units.length < maxUnits) {
        group.units.push(null);
      }
    } else if (group.units.length > maxUnits) {
      // When reducing from 6 to 5, remove the 6th unit (index 5)
      // This will free up the unit that was in the 6th position
      group.units = group.units.slice(0, maxUnits);
    }

    groups = [...groups];
    persist();
  }

  // Drag and drop functions for group reordering
  function onGroupDragStart(event: DragEvent, index: number) {
    if (!event.dataTransfer) return;

    draggedGroupIndex = index;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index.toString());

    // Add a visual indicator class to the dragged element
    if (event.target instanceof HTMLElement) {
      event.target.classList.add('dragging');
    }
  }

  function onGroupDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    if (draggedGroupIndex === null || draggedGroupIndex === index) {
      dragOverIndex = null;
      return;
    }

    dragOverIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function onGroupDragLeave() {
    dragOverIndex = null;
  }

  function onGroupDrop(event: DragEvent, dropIndex: number) {
    event.preventDefault();

    if (draggedGroupIndex === null || draggedGroupIndex === dropIndex) {
      resetDragState();
      return;
    }

    // Simple array reordering: use splice to move elements directly
    const newGroups = [...groups];

    // Extract the dragged element
    const draggedElement = newGroups[draggedGroupIndex];

    // Remove it from the array
    newGroups.splice(draggedGroupIndex, 1);

    // Calculate the correct insertion index
    // The dropIndex refers to the final desired position in the result array
    // We need to calculate where to insert in the current (post-removal) array
    let targetIndex;

    if (draggedGroupIndex < dropIndex) {
      // Moving forward: we want to end up at dropIndex in the final array
      targetIndex = dropIndex;
    } else {
      // Moving backward: dropIndex stays the same
      targetIndex = dropIndex;
    }

    // Bounds check to prevent out-of-range insertion
    if (targetIndex > newGroups.length) {
      targetIndex = newGroups.length;
    }

    newGroups.splice(targetIndex, 0, draggedElement);

    // Force reactivity update and persistence
    if (isAdminMode) {
      adminsStore.set(newGroups);
      persistAdmins(newGroups);
    } else {
      groupsStore.set(newGroups);
      persistGroups(newGroups);
    }

    // Force component re-render
    groups = newGroups;

    resetDragState();
  }

  function onGroupDragEnd(event: DragEvent) {
    // Clean up visual indicators
    if (event.target instanceof HTMLElement) {
      event.target.classList.remove('dragging');
    }
    resetDragState();
  }

  function resetDragState() {
    draggedGroupIndex = null;
    dragOverIndex = null;
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

  function addPatrolEffect(group: Group) {
    // Use Foundry's Dialog system to create multi-stat effect
    if (!Dialog) {
      console.error("Dialog not available");
      return;
    }

    // Create checkboxes for each stat
    const statCheckboxes = stats.map(stat => `
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
        <input type="checkbox" id="stat-${stat.key}" name="statCheckbox" value="${stat.key}">
        <label for="stat-${stat.key}" style="flex: 1;">${stat.name}</label>
        <input type="number" id="value-${stat.key}" name="statValue" placeholder="±" value="0" style="width: 60px;" disabled>
      </div>
    `).join('');

    new Dialog({
      title: "Añadir Efecto de Patrulla Multi-Stat",
      content: `
        <form>
          <div class="form-group">
            <label>Nombre del efecto:</label>
            <input type="text" name="effectName" placeholder="Ej: Falta de personal, Bendición divina..." autofocus />
          </div>
          <div class="form-group">
            <label>Descripción:</label>
            <textarea name="effectDescription" placeholder="Descripción del efecto" rows="3" style="width: 100%; resize: vertical;"></textarea>
          </div>
          <div class="form-group">
            <label>Stats afectados y valores:</label>
            <div style="border: 1px solid #ccc; padding: 0.5rem; border-radius: 4px; max-height: 200px; overflow-y: auto;">
              ${statCheckboxes}
            </div>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          icon: '<i class="fas fa-check"></i>',
          label: "Añadir",
          callback: (html: any) => {
            const form = html[0].querySelector("form");
            const effectName = form.effectName.value.trim();
            const effectDescription = form.effectDescription.value.trim();

            // Collect selected stats and their values
            const statEffects: Record<string, number> = {};
            const checkedBoxes = form.querySelectorAll('input[name="statCheckbox"]:checked');

            checkedBoxes.forEach((checkbox: HTMLInputElement) => {
              const statKey = checkbox.value;
              const valueInput = form.querySelector(`#value-${statKey}`) as HTMLInputElement;
              const value = parseInt(valueInput.value) || 0;
              if (value !== 0) { // Only include non-zero values
                statEffects[statKey] = value;
              }
            });

            if (effectName && Object.keys(statEffects).length > 0) {
              // Initialize patrolEffects if undefined
              if (!group.patrolEffects) {
                group.patrolEffects = {};
              }

              // Generate stable sourceId for new effect
              const nameKey = effectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
              const effectsKey = Object.keys(statEffects).sort().join('-');
              const stableSourceId = `temp-${nameKey}-${effectsKey}`;

              // Generate unique ID for this effect
              const effectId = generateUUID();

              group.patrolEffects[effectId] = {
                name: effectName,
                description: effectDescription,
                statEffects: statEffects,
                sourceId: stableSourceId, // Add stable sourceId for sync
                key: stableSourceId // Add key for consistency
              };

              // Create a complete new copy of the groups array with the modified group
              const updatedGroups = groups.map(g =>
                g.id === group.id
                  ? { ...g, patrolEffects: { ...g.patrolEffects } }
                  : g
              );

              updateGroups(updatedGroups);

              console.log('Groups.svelte - New effect created, creating preset:', {
                sourceId: stableSourceId,
                name: effectName,
                description: effectDescription,
                statEffects: statEffects
              });

              // Create a preset for this new effect
              createPatrolEffectPreset({
                name: effectName,
                description: effectDescription,
                statEffects: statEffects
              });

            } else if (Object.keys(statEffects).length === 0) {
              ui.notifications?.warn("Debes seleccionar al menos un stat con un valor diferente de 0");
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar"
        }
      },
      default: "ok",
      render: (html: any) => {
        // Add checkbox functionality after dialog is rendered
        const checkboxes = html[0].querySelectorAll('input[name="statCheckbox"]');
        checkboxes.forEach((checkbox: HTMLInputElement) => {
          const valueInput = html[0].querySelector(`#value-${checkbox.value}`) as HTMLInputElement;
          checkbox.addEventListener('change', () => {
            valueInput.disabled = !checkbox.checked;
            if (!checkbox.checked) valueInput.value = '0';
          });
        });
      }
    }).render(true);
  }

  function editPatrolEffect(group: Group, effectId: string) {
    // Use Foundry's Dialog system to edit multi-stat effect
    if (!Dialog) {
      console.error("Dialog not available");
      return;
    }

    const existingEffect = group.patrolEffects[effectId];
    if (!existingEffect) {
      console.error("Effect not found");
      return;
    }

    // Create checkboxes for each stat, pre-selecting and pre-filling existing values
    const statCheckboxes = stats.map(stat => {
      const isChecked = existingEffect.statEffects[stat.key] !== undefined;
      const currentValue = existingEffect.statEffects[stat.key] || 0;

      return `
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
          <input type="checkbox" id="stat-${stat.key}" name="statCheckbox" value="${stat.key}" ${isChecked ? 'checked' : ''}>
          <label for="stat-${stat.key}" style="flex: 1;">${stat.name}</label>
          <input type="number" id="value-${stat.key}" name="statValue" placeholder="±" value="${currentValue}" style="width: 60px;" ${isChecked ? '' : 'disabled'}>
        </div>
      `;
    }).join('');

    new Dialog({
      title: "Editar Efecto de Patrulla Multi-Stat",
      content: `
        <form>
          <div class="form-group">
            <label>Nombre del efecto:</label>
            <input type="text" name="effectName" placeholder="Ej: Falta de personal, Bendición divina..." value="${existingEffect.name}" autofocus />
          </div>
          <div class="form-group">
            <label>Descripción:</label>
            <textarea name="effectDescription" placeholder="Descripción del efecto" rows="3" style="width: 100%; resize: vertical;">${existingEffect.description || ''}</textarea>
          </div>
          <div class="form-group">
            <label>Stats afectados y valores:</label>
            <div style="border: 1px solid #ccc; padding: 0.5rem; border-radius: 4px; max-height: 200px; overflow-y: auto;">
              ${statCheckboxes}
            </div>
          </div>
        </form>
      `,
      buttons: {
        ok: {
          icon: '<i class="fas fa-check"></i>',
          label: "Guardar",
          callback: (html: any) => {
            const form = html[0].querySelector("form");
            const effectName = form.effectName.value.trim();
            const effectDescription = form.effectDescription.value.trim();

            // Collect selected stats and their values
            const statEffects: Record<string, number> = {};
            const checkedBoxes = form.querySelectorAll('input[name="statCheckbox"]:checked');

            checkedBoxes.forEach((checkbox: HTMLInputElement) => {
              const statKey = checkbox.value;
              const valueInput = form.querySelector(`#value-${statKey}`) as HTMLInputElement;
              const value = parseInt(valueInput.value) || 0;
              if (value !== 0) { // Only include non-zero values
                statEffects[statKey] = value;
              }
            });

            if (effectName && Object.keys(statEffects).length > 0) {
              // Update existing effect
              group.patrolEffects[effectId] = {
                name: effectName,
                description: effectDescription,
                statEffects: statEffects,
                sourceId: existingEffect.sourceId, // Preserve existing sourceId
                key: existingEffect.key // Preserve existing key
              };

              // Use updateGroups helper instead of manual update
              updateGroups([...groups]);

              // Notify preset manager about the effect update (reverse sync)
              if (existingEffect.sourceId) {
                console.log('Groups.svelte - Notifying preset manager of effect update:', {
                  sourceId: existingEffect.sourceId,
                  name: effectName,
                  description: effectDescription,
                  statEffects: statEffects
                });

                const updatedEffect = {
                  sourceId: existingEffect.sourceId,
                  key: existingEffect.key,
                  name: effectName,
                  description: effectDescription,
                  statEffects: statEffects,
                  type: 'neutral',
                  duration: ''
                };

                // Update the preset via preset manager
                presetManager.updatePresetFromItem(updatedEffect, 'patrolEffect');
              }
            } else if (Object.keys(statEffects).length === 0) {
              ui.notifications?.warn("Debes seleccionar al menos un stat con un valor diferente de 0");
            }
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar"
        }
      },
      default: "ok",
      render: (html: any) => {
        // Add checkbox functionality after dialog is rendered
        const checkboxes = html[0].querySelectorAll('input[name="statCheckbox"]');
        checkboxes.forEach((checkbox: HTMLInputElement) => {
          const valueInput = html[0].querySelector(`#value-${checkbox.value}`) as HTMLInputElement;
          checkbox.addEventListener('change', () => {
            valueInput.disabled = !checkbox.checked;
            if (!checkbox.checked) valueInput.value = '0';
          });
        });
      }
    }).render(true);
  }

  function removePatrolEffect(group: Group, effectId: string) {
    if (group.patrolEffects && group.patrolEffects[effectId]) {
      delete group.patrolEffects[effectId];
      updateGroups([...groups]);
    }
  }

  function clearAllPatrolEffects(group: Group) {
    group.patrolEffects = {};
    updateGroups([...groups]);
  }

  function applyPatrolEffectToGroup(group: Group) {
    if (!pendingPatrolEffect) return;

    // Initialize patrolEffects if undefined
    if (!group.patrolEffects) {
      group.patrolEffects = {};
    }

    // Generate a stable sourceId based on the effect's content (same logic as createPatrolEffectPreset)
    const nameKey = pendingPatrolEffect.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const effectsKey = Object.keys(pendingPatrolEffect.statEffects || {}).sort().join('-');
    const stableSourceId = `temp-${nameKey}-${effectsKey}`;

    const effectId = `preset_${stableSourceId}`;

    // Check if this effect already exists in the group (check by sourceId)
    const existingEffectId = Object.keys(group.patrolEffects).find(id => {
      const effect = group.patrolEffects[id];
      return effect.sourceId === stableSourceId || id === effectId;
    });

    if (existingEffectId) {
      ui.notifications?.warn(`El efecto de patrulla "${pendingPatrolEffect.name}" ya está aplicado a ${group.name}.`);
      // Clear the pending effect
      pendingPatrolEffect = null;
      applyingPatrolEffect = false;
      return;
    }

    // Apply the effect
    group.patrolEffects[effectId] = {
      name: pendingPatrolEffect.name,
      description: pendingPatrolEffect.description,
      statEffects: pendingPatrolEffect.statEffects,
      sourceId: stableSourceId, // Use the stable sourceId for consistency
      key: stableSourceId // Also store as key for consistency with other items
    };

    // Update the groups
    const updatedGroups = groups.map(g =>
      g.id === group.id
        ? { ...g, patrolEffects: { ...g.patrolEffects } }
        : g
    );

    updateGroups(updatedGroups);

    // Clear the pending effect
    pendingPatrolEffect = null;
    applyingPatrolEffect = false;

    // Show success notification
    ui.notifications?.info(`Efecto de patrulla "${group.patrolEffects[effectId].name}" aplicado a ${group.name}.`);
  }  function handleGroupClick(group: Group) {
    if (applyingPatrolEffect && pendingPatrolEffect) {
      applyPatrolEffectToGroup(group);
    }
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
    transition: all 0.2s ease;
  }

  .group.clickable-for-effect {
    border-color: #d4af37;
    background: rgba(212, 175, 55, 0.1);
    box-shadow: 0 0 10px rgba(212, 175, 55, 0.3);
  }

  .group.clickable-for-effect:hover {
    background: rgba(212, 175, 55, 0.2);
    box-shadow: 0 0 15px rgba(212, 175, 55, 0.5);
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

  .drop-zone.units {
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

  .groups {
    display: flex;
    flex-wrap: wrap;
    padding: 0.5rem;
    gap: 1rem;
    overflow: visible; /* Allow floating containers to extend outside */
  }

  /* Header Banner Styles */
  .header-banner {
    background-image: url("../../modules/crow-nest/static/img/patrol-banner.png");
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    border-bottom: solid 2px #d4af37;
    width: 100%;
    height: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    margin-bottom: 1rem;

    &.admin {
    background-image: url("../../modules/crow-nest/static/img/admin-banner.png");
    }
  }

  .header-banner::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 8px;
  }

  .title-display {
    position: relative;
    z-index: 1;
    text-align: center;
    margin: 0;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    color: #ffffffff;
    font-size: 1.8rem;
    font-weight: bold;
    font-family: "Eveleth Dot", "Eveleth", "Overpass", Arial, sans-serif;
    text-shadow: 5px 5px 1px rgba(0, 0, 0, 0.9);
    background: rgba(0, 0, 0, 0.3);
    display: flex;
  }

  .add-button {
    position: absolute;
    left: 0.5rem;
    bottom: 0.5rem;
    z-index: 2;
    height: 40px;
    border: 2px solid #d4af37;
    background: rgba(0, 0, 0, 0.8);
    font-size: 1rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  }

  .add-button:hover {
    background: rgba(212, 175, 55, 0.2);
    border-color: #ffd700;
    color: #ffd700;
    transform: scale(1.1);
  }

  /* Dynamic Formation Styles - Pentagon/Hexagon */
  .formation-and-stats-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: .5rem;
    margin: .25rem 0 0 0;
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

  /* Editable modifier styles */
  .editable-modifier:hover {
    background: rgba(255, 255, 255, 1) !important;
    border-color: #ffd700 !important;
    transform: scale(1.02);
    transition: all 0.2s ease;
  }

  /* Drag and drop styles */
  .draggable-handle {
    cursor: grab;
    transition: all 0.2s ease;
  }

  .draggable-handle:hover {
    background: rgba(212, 175, 55, 0.2) !important;
    transform: scale(1.02);
  }

  .draggable-handle:active {
    cursor: grabbing;
  }

  .group.dragging {
    opacity: 0.5;
    transform: scale(0.95);
  }

  .group.drag-over {
    border-color: #d4af37;
    border-width: 2px;
    background: rgba(212, 175, 55, 0.1);
    transform: scale(1.02);
    box-shadow: 0 4px 8px rgba(212, 175, 55, 0.3);
  }

  .groups {
    position: relative;
  }

  /* Add visual indicator for drag handle */
  .draggable-handle::before {
    content: "⋮⋮";
    position: absolute;
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
    color: #d4af37;
    font-size: 0.8rem;
    line-height: 0.6;
    opacity: 0.7;
  }

  .draggable-handle:hover::before {
    opacity: 1;
  }
</style>

<div class="groups-container">
  <!-- Section Title (if provided) -->
  {#if sectionTitle}
    <div class="header-banner {isAdminMode ? 'admin' : ''}">
      <h3 class="title-display">{sectionTitle}</h3>
      <button class="add-button" on:click={addGroup} title="{labels.addGroup}">
        + Add
      </button>
    </div>
  {/if}
  <div class="groups" role="list">
  {#each groups as group, i}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="group {group.officer ? 'has-officer' : ''} {dragOverIndex === i ? 'drag-over' : ''} {applyingPatrolEffect ? 'clickable-for-effect' : ''}"
      data-group-id="{group.id}"
      role="listitem"
      on:dragover={(e) => onGroupDragOver(e, i)}
      on:dragleave={onGroupDragLeave}
      on:drop={(e) => onGroupDrop(e, i)}
      on:click={() => handleGroupClick(group)}
      on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleGroupClick(group); }}
      style="cursor: {applyingPatrolEffect ? 'pointer' : 'default'}"
      tabindex={applyingPatrolEffect ? "0" : undefined}
    >

      <!-- Group Header with editable name (DRAGGABLE) -->
      <div
        class="group-header draggable-handle"
        draggable="true"
        role="button"
        tabindex="0"
        on:dragstart={(e) => onGroupDragStart(e, i)}
        on:dragend={onGroupDragEnd}
        title="Arrastra para reordenar"
        aria-label="Reordenar grupo {group.name || 'sin nombre'}"
      >
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
          <button class="header-button" on:click={() => showPatrolSheet(group)}  title="Abrir ficha para mí">
            Ficha
          </button>
          <button class="header-button" on:click={() => forceShowPatrolSheetToAll(group)} title="Mostrar ficha a todos los jugadores">
            Ficha→All
          </button>
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
          <button class="header-button" on:click={() => showPatrolSheet(group)}  title="Abrir ficha para mí">
            Ficha
          </button>
          <button class="header-button" on:click={() => forceShowPatrolSheetToAll(group)} title="Mostrar ficha a todos los jugadores">
            Ficha→All
          </button>
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
        <!-- Officer Info (moved above units) -->


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

          <!-- Patrol Layout Component -->
          <PatrolLayout
            group={group}
            editing={editing[group.id]}
            {labels}
            on:officerDrop={(e) => onDropOfficer(e.detail.event, e.detail.group)}
            on:officerDoubleClick={(e) => openActorSheet(e.detail)}
            on:removeOfficer={(e) => removeOfficer(e.detail)}
            on:soldierDrop={(e) => onDropUnitAtPosition(e.detail.event, e.detail.group, e.detail.slotIndex)}
            on:soldierDoubleClick={(e) => openActorSheet(e.detail)}
            on:soldierDragStart={(e) => onDragMember(e.detail.event, e.detail.soldier)}
            on:removeSoldier={(e) => removeUnitAtPosition(e.detail.group, e.detail.slotIndex)}
          />

          <!-- Group Stats (below formation) -->
          <div class="group-stat-container">
            {#each stats as stat, index}
              <div class="group-stat">
                <Tooltip content={`<span>${stat.name}</span>`} size="36px">
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
            {#if group.skills.length === 0}
              <div style="text-align: center; padding: 1rem; color: #888; font-style: italic;">
                Edit para añadir skills
              </div>
            {:else}
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
            {/if}

            <!-- Experiences Section -->
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #d4af37;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <strong style="margin: 0;">Experiences</strong>
                {#if editing[group.id]}
                  <button on:click={() => addExperience(group)}>+</button>
                {/if}
              </div>
              {#if group.experiences.length === 0}
                <div style="text-align: center; padding: 1rem; color: #888; font-style: italic;">
                  Edit para añadir experiences
                </div>
              {:else}
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
              {/if}
            </div>

            <!-- Modificadores Temporales Section -->
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #d4af37;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div>
                  <strong style="margin: 0;">Efectos de Patrulla</strong>
                  <div style="font-size: 0.75em; color: #888; font-style: italic; margin-top: 0.25rem;">Cada efecto puede afectar múltiples stats</div>
                </div>
                {#if editing[group.id]}
                  <div style="display: flex; gap: 0.25rem;">
                    <button on:click={() => addPatrolEffect(group)} style="padding: 0.25rem 0.5rem; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer;" title="Añadir nuevo efecto de patrulla">
                      + Añadir
                    </button>
                    <button on:click={() => clearAllPatrolEffects(group)} style="padding: 0.25rem 0.5rem; background: #ff6666; color: white; border: none; border-radius: 4px; cursor: pointer;" title="Limpiar todos los efectos">
                      Clear All
                    </button>
                  </div>
                {/if}
              </div>

              {#if Object.entries(group.patrolEffects || {}).length === 0}
                <div style="text-align: center; padding: 1rem; color: #888; font-style: italic;">
                  Edit para añadir efectos de patrulla
                </div>
              {:else}
                {#each Object.entries(group.patrolEffects || {}) as [effectId, effect]}
                  <div
                    style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; padding: 1rem; background: rgba(155, 89, 182, 0.1); border: 2px solid #9b59b6; border-radius: 8px; {editing[group.id] ? 'cursor: pointer;' : ''}"
                    class:editable-effect={editing[group.id]}
                    on:dblclick={editing[group.id] ? () => editPatrolEffect(group, effectId) : undefined}
                    on:keydown={editing[group.id] ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editPatrolEffect(group, effectId); } } : undefined}
                    title={editing[group.id] ? 'Doble clic para editar' : ''}
                    role={editing[group.id] ? 'button' : undefined}
                    tabindex={editing[group.id] ? '0' : undefined}
                  >
                    <!-- Effect Header -->
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem;">
                      <div style="flex: 1;">
                        <strong style="color: #9b59b6; font-size: 1.2em; display: block; margin-bottom: 0.5rem; text-shadow: 0 0 2px rgba(155, 89, 182, 0.3);">{effect.name}</strong>
                        {#if effect.description}
                          <div style="color: #666; font-size: 0.9em; line-height: 1.4; margin-bottom: 0.75rem;">
                            {effect.description}
                          </div>
                        {/if}
                      </div>
                      {#if editing[group.id]}
                        <div style="display: flex; gap: 0.5rem;">
                          <button
                            on:click={() => createPatrolEffectPreset(effect)}
                            style="padding: 0.25rem 0.5rem; background: #d4af37; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8em; flex-shrink: 0;"
                            title="Crear preset con este efecto"
                          >
                            Preset
                          </button>
                          <button
                            on:click={() => removePatrolEffect(group, effectId)}
                            style="padding: 0.25rem 0.5rem; background: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8em; flex-shrink: 0;"
                            title="Eliminar efecto"
                          >
                            ×
                          </button>
                        </div>
                      {/if}
                    </div>

                    <!-- Stats Effects -->
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                      {#each Object.entries(effect.statEffects || {}) as [statKey, value]}
                        {@const stat = stats.find(s => s.key === statKey)}
                        {#if stat}
                          <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: rgba(155, 89, 182, 0.15); border: 1px solid #9b59b6; border-radius: 6px;">
                            <img src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} style="width: 24px; height: 24px;" />
                            <span style="font-weight: bold; color: #9b59b6; font-size: 0.9em;">{stat.name}</span>
                            <span style="font-weight: bold; color: {value >= 0 ? '#28a745' : '#dc3545'}; font-size: 1.1em;">
                              {value >= 0 ? '+' : ''}{value}
                            </span>
                          </div>
                        {/if}
                      {/each}
                    </div>
                  </div>
                {/each}
              {/if}
            </div>

                       <!-- Soldados Máximos Section -->
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #d4af37;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <label for="maxUnits-{group.id}" style="color: #d4af37; font-weight: bold;">Unidades Máximas:</label>
                <select id="maxUnits-{group.id}" bind:value={group.maxUnits} on:change={() => handleMaxUnitsChange(group)} style="background: rgba(255, 255, 255, 0.9); border: 1px solid #d4af37; border-radius: 4px; padding: 0.25rem; color: #000;">
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                  <option value={6}>6</option>
                  <option value={7}>7</option>
                  <option value={8}>8</option>
                  <option value={9}>9</option>
                  <option value={10}>10</option>
                  <option value={11}>11</option>
                  <option value={12}>12</option>
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

          </div>
        </div>
      {/if}
    </div>
  {/each}
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
