<script context="module" lang="ts">
  declare const FilePicker: any;
</script>

<script lang="ts">
  import Tooltip from '@/components/tooltip.svelte';
  import type { GuardModifier, GuardStat } from '@/guard/stats';
  import { getModifiers, getStats } from "@/guard/stats";
  import type { Group, GroupMember, GroupSkill } from "@/shared/group";
  import { SyncManager, type SyncEvent } from '@/utils/sync';
  import { onDestroy, onMount } from 'svelte';

  export let groups: Group[] = [];
  export let saveGroups: (groups: Group[]) => Promise<void>;
  export let labels = {
    groupSingular: 'Patrol',
    addGroup: 'Add Patrol',
    removeGroup: 'Remove Patrol',
    officerDrop: 'Drag an officer here',
    soldierDrop: 'Drag soldiers here',
  };

  let stats: GuardStat[] = [];
  let modifiers: GuardModifier[] = [];
  let editing: Record<string, boolean> = {};
  let collapsed: Record<string, boolean> = {};

  // Sync manager
  let syncManager: SyncManager;

  onMount(() => {
    stats = getStats() as GuardStat[];
    modifiers = getModifiers();

    // Setup real-time synchronization
    syncManager = SyncManager.getInstance();

    // Listen for stats and modifiers updates (for UI updates)
    syncManager.subscribe('stats', handleStatsSync);
    syncManager.subscribe('modifiers', handleModifiersSync);
  });

  onDestroy(() => {
    if (syncManager) {
      syncManager.unsubscribe('stats', handleStatsSync);
      syncManager.unsubscribe('modifiers', handleModifiersSync);
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
    // Only allow saving if user is GM
    if (game.user?.isGM) {
      console.log("💾 Groups: Persisting changes as GM");
      await saveGroups(groups);
    } else {
      console.log("🚫 Groups: Skipping persist - not GM");
    }
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
  }

  function toggleCollapsed(group: Group) {
    collapsed[group.id] = !collapsed[group.id];
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

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const actor = game.actors?.get(member.id);
      if (!actor) continue;

      // Check if token already exists on canvas
      const existingToken = canvas.tokens.placeables.find(
        (token: any) => token.document.actorId === actor.id
      );

      const newX = viewPosition.x + offsetX;
      const newY = viewPosition.y + offsetY;

      if (existingToken) {
        // Move existing token
        tokensToMove.push({
          _id: existingToken.document.id,
          x: newX,
          y: newY,
        });
      } else {
        // Create new token
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
    ui.notifications?.info(`${groupName} deployed on the map (${members.length} members)`);
  }
</script>

<style>
  .group {
    border: 1px solid #666;
    padding: 0.5rem;
    padding-left: 120px; /* Always reserve space for officer area */
    margin-bottom: 0.5rem;
    position: relative;
    min-height: 140px; /* Always use the larger height */
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
    align-items: center;
    margin-bottom: 0.5rem;
    gap: 1rem;
  }

  .collapsed .stats-and-edit-container {
    margin-bottom: 0;
  }

  .collapsed-soldiers {
    display: flex;
    gap: 0.25rem;
    margin-left: 1rem;
    align-items: center;
  }

  .collapsed-soldiers .soldier-mini {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #666;
  }

  .edit-button-container {
    flex-shrink: 0;
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
  }

  .drop-zone.soldiers em {
    width: 100%;
    text-align: center;
  }

  .drop-zone.soldiers .member {
    flex: 1 1 calc(33.333% - 0.17rem); /* 3 per line with gap compensation */
    min-width: 0;
    max-width: calc(33.333% - 0.17rem);
  }

  .skills {
    margin-top: 0;
  }

  .skills strong {
    display: block;
    margin-bottom: 0.5rem;
  }

  .skill {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .skill img {
    width: 64px;
    height: 64px;
    min-width: 64px;
    min-height: 64px;
    flex-shrink: 0;
  }

  .skill .info {
    display: flex;
    flex-direction: column;
    font-size: 0.85em;
  }

  .skill .info strong {
    text-transform: none;
    font-size: 0.9em;
  }

  .skill .info p {
    margin: 0;
    font-size: 0.85em;
  }

  .skill textarea {
    flex: 1;
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
    gap: 0.5rem;
  }

  .stat-values {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .stat-values input {
    width: 32px;
    text-align: center;
  }

  .stat-mod {
    height: 32px;
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

  .deploy {
    margin-top: 0.25rem;
  }

  .stat-icon {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: transform 0.2s ease;
  }

  .stat-icon:hover {
    transform: scale(1.1);
  }

  .stat-icon img {
    width: 48px;
    height: 48px;
  }

  .group-stat-container {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex: 1;
  }

  .skill-image-button {
    background: none;
    border: none;
    padding: 0;
    padding-right: 0.5rem;
    cursor: pointer;
    width: 64px;
    height: 64px;
  }

  .skill-image-button:hover {
    opacity: 0.8;
  }

  .delete-button {
    width: 16px;
    height: 16px;
    min-width: 16px;
    min-height: 16px;
    padding: 0;
    border: 1px solid #666;
    background: #ff4444;
    color: white;
    border-radius: 2px;
    font-size: 10px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
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
          <button class="header-button" on:click={() => toggleEditing(group)}>
            {editing[group.id] ? 'Save' : 'Edit'}
          </button>
          <button
            class="header-button"
            draggable="true"
            on:click={() => deployGroup(group)}
            on:dragstart={(e) => onDragDeploy(e, group)}
          >
            Deploy
          </button>
          {#if editing[group.id]}
            <button class="header-button" on:click={() => removeGroup(i)} style="background: #ff4444; color: white;">
              X
            </button>
          {/if}
          <button class="header-button" on:click={() => toggleCollapsed(group)}>
            {collapsed[group.id] ? '▼' : '▲'}
          </button>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="group-content">
        <!-- Officer Info (moved above soldiers) -->
        {#if group.officer}
          <div class="officer-info-top">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span><strong>Officer:</strong> {group.officer.name}</span>
            </div>
          </div>
        {/if}

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

          <!-- Edit Button separated on the right -->
          <div class="edit-button-container">
            <button on:click={() => toggleEditing(group)}>
              {editing[group.id] ? 'Save' : 'Edit'}
            </button>
          </div>

          <!-- Soldiers in collapsed view -->
          {#if collapsed[group.id] && group.soldiers && group.soldiers.length > 0}
            <div class="collapsed-soldiers">
              {#each group.soldiers as soldier}
                <img
                  src={soldier.img}
                  alt={soldier.name}
                  class="soldier-mini"
                  title={soldier.name}
                />
              {/each}
            </div>
          {/if}
        </div>

        {#if !collapsed[group.id]}
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
                style={`background-image: url('${soldier.img}');`}
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

        <!-- Skills -->
        <div class="skills">
          <strong>Skills</strong>
          {#each group.skills as sk, j}
            <div class="skill">
              <button type="button" class="skill-image-button" on:click={() => editing[group.id] && chooseSkillImage(sk)}>
                <img src={sk.img} alt="" />
              </button>
              {#if editing[group.id]}
                <input placeholder="Name" bind:value={sk.name} on:change={persist} />
                <textarea placeholder="Description" bind:value={sk.description} on:change={persist}></textarea>
                <button class="delete-button" on:click={() => removeSkill(group, j)}>X</button>
              {:else}
                <div class="info">
                  <strong>{sk.name}</strong>
                  <p>{sk.description}</p>
                </div>
              {/if}
            </div>
          {/each}
          {#if editing[group.id]}
            <button on:click={() => addSkill(group)}>Add Skill</button>
          {/if}
        </div>

        {#if editing[group.id]}
          <button on:click={() => removeGroup(i)}>{labels.removeGroup}</button>
        {/if}
        {/if}
      </div>
    </div>
  {/each}
  <button on:click={addGroup}>{labels.addGroup}</button>
</div>
