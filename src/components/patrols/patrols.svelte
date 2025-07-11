<script lang="ts">
  import { onMount } from 'svelte';
  import type { GuardStat } from '@/guard/stats';
  import { getStats } from '@/guard/stats';
  import { getPatrols, savePatrols, type Patrol, type PatrolSkill } from '@/patrol/patrols';

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
      { id: crypto.randomUUID(), officer: '', soldiers: [], modifier: 0, skills: [] }
    ];
    persist();
  }

  function removePatrol(index: number) {
    patrols.splice(index, 1);
    patrols = [...patrols];
    persist();
  }

  function onDropOfficer(event: DragEvent, patrol: Patrol) {
    const data = event.dataTransfer?.getData('text/plain');
    if (data) {
      patrol.officer = data;
      persist();
    }
  }

  function onDropSoldier(event: DragEvent, patrol: Patrol) {
    const data = event.dataTransfer?.getData('text/plain');
    if (data) {
      patrol.soldiers = [...patrol.soldiers, data];
      persist();
    }
  }

  function addSkill(patrol: Patrol) {
    const skill: PatrolSkill = { img: '', description: '' };
    patrol.skills = [...patrol.skills, skill];
    persist();
  }

  function removeSkill(patrol: Patrol, index: number) {
    patrol.skills.splice(index, 1);
    patrol.skills = [...patrol.skills];
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
      <div
        class="drop-zone officer"
        on:dragover|preventDefault
        on:drop={(e) => onDropOfficer(e, patrol)}
      >
        Oficial: {patrol.officer || 'Arrastra un actor aquí'}
      </div>
      <div
        class="drop-zone"
        on:dragover|preventDefault
        on:drop={(e) => onDropSoldier(e, patrol)}
      >
        {#each patrol.soldiers as s}
          <div>{s}</div>
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
            <input placeholder="Descripción" bind:value={sk.description} on:change={persist} />
            <button on:click={() => removeSkill(patrol, j)}>X</button>
          </div>
        {/each}
        <button on:click={() => addSkill(patrol)}>Añadir Habilidad</button>
      </div>
      <button on:click={() => removePatrol(i)}>Eliminar Patrulla</button>
    </div>
  {/each}
  <button on:click={addPatrol}>Añadir Patrulla</button>
</div>
