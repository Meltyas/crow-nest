<script lang="ts">
  import type { GuardModifier, GuardStat } from '@/guard/stats';
  import { getStats, getModifiers } from "@/guard/stats";
  import Tooltip from '@/components/tooltip.svelte';
  import type { Group, GroupSkill, GroupMember } from "@/shared/group";
  import { onMount } from 'svelte';

  declare const FilePicker: any;

  export let getGroups: () => Group[];
  export let saveGroups: (groups: Group[]) => Promise<void>;
  export let labels = {
    groupSingular: 'Patrulla',
    addGroup: 'Añadir Patrulla',
    removeGroup: 'Eliminar Patrulla',
    officerDrop: 'Arrastra un oficial aquí',
    soldierDrop: 'Arrastra soldados aquí',
  };

  let stats: GuardStat[] = [];
  let groups: Group[] = [];
  let modifiers: GuardModifier[] = [];
  let editingMods = false;
  let editingSkills = false;

  onMount(() => {
    stats = getStats() as GuardStat[];
    groups = getGroups();
    modifiers = getModifiers();
  });

  async function persist() {
    await saveGroups(groups);
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
      id: actor.id,
      name: actor.name,
      img: actor.img,
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
      { id: actor.id, name: actor.name, img: actor.img },
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
      FilePicker.create({
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
    r.evaluate({ async: false });
    r.toMessage({ speaker: { alias: group.officer || labels.groupSingular }, flavor: stat.name });
  }
</script>

<style>
  .group {
    border: 1px solid #666;
    padding: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .drop-zone {
    border: 1px dashed #aaa;
    padding: 0.25rem;
    min-height: 1.5rem;
    margin-bottom: 0.25rem;
  }

  .officer {
    font-weight: bold;
    background: rgba(255, 255, 255, 0.1);
  }

  .skills {
    margin-top: 0.25rem;
  }

  .skill {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .skill img {
    width: 32px;
    height: 32px;
  }

  .skill .info {
    display: flex;
    flex-direction: column;
  }

  .skill textarea {
    flex: 1;
  }

  .member {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .group-stat {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .deploy {
    margin-top: 0.25rem;
  }

  .stat-icon {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .stat-icon img {
    width: 24px;
    height: 24px;
  }
</style>

<div class="groups">
  {#each groups as group, i}
    <div class="group">
      <strong>{group.name}</strong>
      <div
        class="drop-zone officer" role="button" aria-label={labels.officerDrop}
        on:dragover|preventDefault
        on:drop={(e) => onDropOfficer(e, group)}
      >
        {#if group.officer}
          <div
            class="member" role="button"
            draggable="true"
            on:dragstart={(e) => onDragMember(e, group.officer)}
          >
            <img
              src={group.officer.img}
              alt={group.officer.name}
              width="32"
              height="32"
              draggable="true"
            />
            <span>{group.officer.name}</span>
            <button on:click={() => console.log(group.officer)}>Info</button>
          </div>
        {:else}
          <em>{labels.officerDrop}</em>
        {/if}
      </div>
      <div
        class="drop-zone" role="button" aria-label={labels.soldierDrop}
        on:dragover|preventDefault
        on:drop={(e) => onDropSoldier(e, group)}
      >
        {#each group.soldiers as s}
          <div
            class="member" role="button"
            draggable="true"
            on:dragstart={(e) => onDragMember(e, s)}
          >
            <Tooltip content={`<span>${s.name}</span>`}>
              <img
                src={s.img}
                alt={s.name}
                width="24"
                height="24"
                draggable="true"
              />
            </Tooltip>
            <button on:click={() => console.log(s)}>Info</button>
          </div>
        {/each}
        {#if group.soldiers.length === 0}
          <em>{labels.soldierDrop}</em>
        {/if}
      </div>
      <div>
        {#each stats as stat}
          <div class="group-stat">
            <Tooltip content={`<span>${stat.name}</span>`}>
              <button class="stat-icon" on:click={() => roll(stat, group)}>
                <img src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} />
              </button>
            </Tooltip>
            {#if editingMods}
              <input type="number" bind:value={group.mods[stat.key]} on:change={persist} />
            {:else}
              <span>{group.mods[stat.key] || 0}</span>
              <span>({totalStat(stat, group)})</span>
            {/if}
          </div>
        {/each}
      </div>
      <button on:click={() => (editingMods = !editingMods)}>
        {editingMods ? 'Guardar Mods' : 'Editar Mods'}
      </button>
      <div class="skills">
        <strong>Habilidades</strong>
          {#each group.skills as sk, j}
            <div class="skill">
              <img src={sk.img} alt="" on:click={() => editingSkills && chooseSkillImage(sk)} />
              {#if editingSkills}
                <input placeholder="Nombre" bind:value={sk.name} on:change={persist} />
                <textarea placeholder="Descripción" bind:value={sk.description} on:change={persist}></textarea>
                <button on:click={() => removeSkill(group, j)}>Quitar</button>
              {:else}
                <div class="info">
                  <strong>{sk.name}</strong>
                  <p>{sk.description}</p>
                </div>
              {/if}
            </div>
        {/each}
        <button on:click={() => addSkill(group)}>Añadir Habilidad</button>
        <button on:click={() => (editingSkills = !editingSkills)}>
          {editingSkills ? 'Guardar Habilidades' : 'Editar Habilidades'}
        </button>
      </div>
      <button
        class="deploy"
        draggable="true"
        on:dragstart={(e) => onDragDeploy(e, group)}
      >Desplegar</button>
      <button on:click={() => removeGroup(i)}>{labels.removeGroup}</button>
    </div>
  {/each}
  <button on:click={addGroup}>{labels.addGroup}</button>
</div>
