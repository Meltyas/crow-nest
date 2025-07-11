<script lang="ts">
  import { onMount } from 'svelte';

  interface Stat {
    id: string;
    name: string;
    value: number;
  }

  let stats: Stat[] = [];
  let log: string[] = [];
  let showLog = false;
  let addingStat = false;
  let newStat: Stat = { id: '', name: '', value: 0 };

  onMount(() => {
    const savedStats = localStorage.getItem('crowGuardStats');
    if (savedStats) stats = JSON.parse(savedStats);
    const savedLog = localStorage.getItem('crowGuardLog');
    if (savedLog) log = JSON.parse(savedLog);
  });

  function persist() {
    localStorage.setItem('crowGuardStats', JSON.stringify(stats));
    localStorage.setItem('crowGuardLog', JSON.stringify(log));
  }

  function openAddStat() {
    newStat = { id: crypto.randomUUID(), name: '', value: 0 };
    addingStat = true;
  }

  function confirmAddStat() {
    stats = [...stats, { ...newStat }];
    log = [...log, `Añadido stat ${newStat.id}`];
    persist();
    addingStat = false;
  }

  function cancelAddStat() {
    addingStat = false;
  }

  function removeStat(index: number) {
    const [removed] = stats.splice(index, 1);
    stats = [...stats];
    log = [...log, `Eliminado stat ${removed.id}`];
    persist();
  }

  function updateStat() {
    log = [...log, 'Modificados stats'];
    persist();
  }

  function toggleLog() {
    showLog = !showLog;
  }
</script>

<style>
  .guard-container {
    padding: 0.5rem;
    color: white;
    max-height: 400px;
    overflow-y: auto;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .stat img {
    width: 24px;
    height: 24px;
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
</style>

<div class="guard-container">
  <button on:click={openAddStat}>Añadir Stat</button>
  {#if addingStat}
    <div class="add-stat-form">
      <input placeholder="Nombre" bind:value={newStat.name} />
      <input type="number" placeholder="Valor" bind:value={newStat.value} />
      <button on:click={confirmAddStat}>Agregar</button>
      <button on:click={cancelAddStat}>Cancelar</button>
    </div>
  {/if}
  {#each stats as stat, i}
    <div class="stat">
      <img src="icons/svg/shield.svg" alt="stat" />
      <input placeholder="Nombre" bind:value={stat.name} on:change={updateStat} />
      <input placeholder="ID" bind:value={stat.id} on:change={updateStat} />
      <input type="number" placeholder="Valor" bind:value={stat.value} on:change={updateStat} />
      <button on:click={() => removeStat(i)}>Quitar</button>
    </div>
  {/each}

  <button on:click={toggleLog}>{showLog ? 'Ocultar Log' : 'Mostrar Log'}</button>
  {#if showLog}
    <div class="log">
      {#each log as entry}
        <div>{entry}</div>
      {/each}
    </div>
  {/if}
</div>
