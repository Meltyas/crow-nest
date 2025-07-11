<script lang="ts">
  import type { GuardModifier, GuardStat } from '@/guard/stats';
  import { getStats, getModifiers } from "@/guard/stats";
  import Tooltip from '@/components/tooltip.svelte';
  import {
    getPatrols,
    savePatrols,
    type Patrol,
    type PatrolSkill,
    type PatrolMember
  } from "@/patrol/patrols";
  import { onMount } from 'svelte';

  let stats: GuardStat[] = [];
  let patrols: Patrol[] = [];
  let modifiers: GuardModifier[] = [];
  let editingMods = false;

  onMount(() => {
    stats = getStats() as GuardStat[];
    patrols = getPatrols();
    modifiers = getModifiers();
  });

  async function persist() {
    await savePatrols(patrols);
  }

  function addPatrol() {
    patrols = [
      ...patrols,
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

  function removePatrol(index: number) {
    patrols.splice(index, 1);
    patrols = [...patrols];
    persist();
  }

  function onDragMember(event: DragEvent, member: PatrolMember | null) {
    if (!member) return;
    const payload = {
      type: 'Actor',
      uuid: `Actor.${member.id}`,
    };
    event.dataTransfer?.setData('text/plain', JSON.stringify(payload));
  }

  function onDragDeploy(event: DragEvent, patrol: Patrol) {
    const payload = {
      type: 'CrowPatrol',
      patrolId: patrol.id,
    };
    event.dataTransfer?.setData('text/plain', JSON.stringify(payload));
  }

  async function actorFromDrop(event: DragEvent): Promise<Actor | null> {
    event.preventDefault();
    const raw = event.dataTransfer?.getData("text/plain");
    console.log("🎯 Raw dropped data:", raw);
    if (!raw) return null;

    try {
      const data = JSON.parse(raw);
      console.log("✅ Parsed drop data:", data);

      if (data?.uuid) {
        const droppedActor = await fromUuid(data.uuid);
        console.log("🎭 Dropped Actor:", droppedActor);

        if (droppedActor instanceof Actor) {
          return droppedActor;
        }
      }
    } catch (err) {
      console.error("❌ Failed to parse drop data:", err);
    }

    return null;
  }

  async function onDropOfficer(event: DragEvent, patrol: Patrol) {
    const actor = await actorFromDrop(event);
    if (!actor) return;

    patrol.officer = {
      id: actor.id,
      name: actor.name,
      img: actor.img,
    };

    if (!patrol.name) {
      patrol.name = `Patrulla de ${actor.name}`;
    }

    patrols = [...patrols];
    persist();
  }


  async function onDropSoldier(event: DragEvent, patrol: Patrol) {
    const actor = await actorFromDrop(event);
    if (!actor) return;

    patrol.soldiers = [
      ...patrol.soldiers,
      { id: actor.id, name: actor.name, img: actor.img },
    ];
    patrols = [...patrols];
    persist();
  }

  function addSkill(patrol: Patrol) {
    const skill: PatrolSkill = { name: '', description: '', img: '' };
    patrol.skills = [...patrol.skills, skill];
    patrols = [...patrols];
    persist();
  }

  function removeSkill(patrol: Patrol, index: number) {
    patrol.skills.splice(index, 1);
    patrol.skills = [...patrol.skills];
    patrols = [...patrols];
    persist();
  }

  function guardBonus(key: string): number {
    return modifiers.reduce((acc, m) => acc + (m.mods[key] || 0), 0);
  }

  function totalStat(stat: GuardStat, patrol: Patrol): number {
    return stat.value + guardBonus(stat.key) + (patrol.mods[stat.key] || 0);
  }

  function roll(stat: GuardStat, patrol: Patrol) {
    const total = totalStat(stat, patrol);
    const r = new Roll(`1d20 + ${total}`);
    r.evaluate({ async: false });
    r.toMessage({ speaker: { alias: patrol.officer || 'Patrol' }, flavor: stat.name });
  }
</script>

<style>
  .patrol {
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

  .member {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .patrol-stat {
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

<div class="patrols">
  {#each patrols as patrol, i}
    <div class="patrol">
      <strong>{patrol.name}</strong>
      <div
        class="drop-zone officer"
        on:dragover|preventDefault
        on:drop={(e) => onDropOfficer(e, patrol)}
      >
        {#if patrol.officer}
          <div
            class="member"
            draggable="true"
            on:dragstart={(e) => onDragMember(e, patrol.officer)}
          >
            <img
              src={patrol.officer.img}
              alt={patrol.officer.name}
              width="32"
              height="32"
              draggable="true"
            />
            <span>{patrol.officer.name}</span>
            <button on:click={() => console.log(patrol.officer)}>Info</button>
          </div>
        {:else}
          <em>Arrastra un oficial aquí</em>
        {/if}
      </div>
      <div
        class="drop-zone"
        on:dragover|preventDefault
        on:drop={(e) => onDropSoldier(e, patrol)}
      >
        {#each patrol.soldiers as s}
          <div
            class="member"
            draggable="true"
            on:dragstart={(e) => onDragMember(e, s)}
          >
            <Tooltip content={s.name}>
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
        {#if patrol.soldiers.length === 0}
          <em>Arrastra soldados aquí</em>
        {/if}
      </div>
      <div>
        {#each stats as stat}
          <div class="patrol-stat">
            <Tooltip content={stat.name}>
              <button class="stat-icon" on:click={() => roll(stat, patrol)}>
                <img src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} />
              </button>
            </Tooltip>
            {#if editingMods}
              <input type="number" bind:value={patrol.mods[stat.key]} on:change={persist} />
            {:else}
              <span>{patrol.mods[stat.key] || 0}</span>
              <span>({totalStat(stat, patrol)})</span>
            {/if}
          </div>
        {/each}
      </div>
      <button on:click={() => (editingMods = !editingMods)}>
        {editingMods ? 'Guardar Mods' : 'Editar Mods'}
      </button>
      <div class="skills">
        <strong>Habilidades</strong>
        {#each patrol.skills as sk, j}
          <div class="skill">
            <img src={sk.img} alt="" />
            <input placeholder="Imagen" bind:value={sk.img} on:change={persist} />
            <input placeholder="Nombre" bind:value={sk.name} on:change={persist} />
            <input placeholder="Descripción" bind:value={sk.description} on:change={persist} />
            <button on:click={() => removeSkill(patrol, j)}>Quitar</button>
          </div>
        {/each}
        <button on:click={() => addSkill(patrol)}>Añadir Habilidad</button>
      </div>
      <button
        class="deploy"
        draggable="true"
        on:dragstart={(e) => onDragDeploy(e, patrol)}
      >Desplegar</button>
      <button on:click={() => removePatrol(i)}>Eliminar Patrulla</button>
    </div>
  {/each}
  <button on:click={addPatrol}>Añadir Patrulla</button>
</div>
