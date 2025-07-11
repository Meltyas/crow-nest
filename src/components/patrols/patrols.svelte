<script lang="ts">
  import type { GuardStat } from '@/guard/stats';
  import { getStats } from "@/guard/stats";
  import {
    getPatrols,
    savePatrols,
    type Patrol,
    type PatrolSkill
  } from "@/patrol/patrols";
  import { onMount } from 'svelte';

  let stats: GuardStat[] = [];
  let patrols: Patrol[] = [];

  onMount(() => {
    stats = getStats() as GuardStat[];
    patrols = getPatrols();
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
        modifier: 0,
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

  function actorFromDrop(event: DragEvent): Actor | null {
    event.preventDefault();
    const uuid = event.dataTransfer?.getData('text/plain');
    if (!uuid) return null;
    const doc = fromUuidSync(uuid);
    if (!doc) return null;
    const actor = doc instanceof Token ? doc.actor : doc;
    if (!actor) return null;
    console.log('Dropped actor', { uuid, actor });
    return actor;
  }
async function onDropOfficer(event: DragEvent, patrol: Patrol) {
  event.preventDefault();

  const raw = event.dataTransfer?.getData("text/plain");
  console.log("🎯 Raw dropped data:", raw);

  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    console.log("✅ Parsed drop data:", data);

    if (data?.uuid) {
      const droppedActor = await fromUuid(data.uuid);
      console.log("🎭 Dropped Actor:", droppedActor);

      if (!(droppedActor instanceof Actor)) return;

      patrol.officer = {
        id: droppedActor.id,
        name: droppedActor.name,
        img: droppedActor.img,
      };

      if (!patrol.name) {
        patrol.name = `Patrulla de ${droppedActor.name}`;
      }

      patrols = [...patrols];
      persist();
    }
  } catch (err) {
    console.error("❌ Failed to parse drop data:", err);
  }
}


  function onDropSoldier(event: DragEvent, patrol: Patrol) {
    const actor = actorFromDrop(event);
    if (!actor) return;

    patrol.soldiers = [
      ...patrol.soldiers,
      { id: actor.id ?? '', name: actor.name ?? '', img: actor.img ?? '' },
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

  function roll(stat: GuardStat, patrol: Patrol) {
    const total = stat.value + patrol.modifier;
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
          <img src={patrol.officer.img} alt={patrol.officer.name} width="32" height="32" />
          <span>{patrol.officer.name}</span>
          <button on:click={() => console.log(patrol.officer)}>Info</button>
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
          <div>
            <img src={s.img} alt={s.name} width="24" height="24" /> {s.name}
            <button on:click={() => console.log(s)}>Info</button>
          </div>
        {/each}
        {#if patrol.soldiers.length === 0}
          <em>Arrastra soldados aquí</em>
        {/if}
      </div>
      <div>
        <label>Modificador</label>
        <input type="number" bind:value={patrol.modifier} on:change={persist} />
      </div>
      <div>
        {#each stats as stat}
          <div>
            <button on:click={() => roll(stat, patrol)}>{stat.name}</button>
            <span>({stat.value + patrol.modifier})</span>
          </div>
        {/each}
      </div>
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
      <button on:click={() => removePatrol(i)}>Eliminar Patrulla</button>
    </div>
  {/each}
  <button on:click={addPatrol}>Añadir Patrulla</button>
</div>
