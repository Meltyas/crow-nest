<script lang="ts">
  import { onMount } from 'svelte';

  interface Stat {
    id: string;
    name: string;
    value: number;
    img?: string;
  }

  let stats: Stat[] = [];
  let log: string[] = [];
  let showLog = false;
  let addingStat = false;
  let editing = false;
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

  function toggleEditing() {
    editing = !editing;
  }

  function onImageClick(stat: Stat) {
    if (editing) {
      const input = document.getElementById(`file-${stat.id}`) as HTMLInputElement | null;
      input?.click();
    } else {
      const r = new Roll(`1d20 + ${stat.value}`);
      r.evaluate({ async: false });
      r.toMessage({ speaker: { alias: 'Guardia' }, flavor: stat.name });
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
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .stat img {
    width: 24px;
    height: 24px;
  }

  .stat-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
  .stats-editables {
    display: flex;
    gap: 0.25rem;
  }

  .stat-view {
    font-weight: bold;
  }
</style>

<div class="guard-container">
  <button on:click={openAddStat} disabled={!editing}>Añadir Stat</button>
  <button on:click={toggleEditing}>{editing ? 'Stop Editing' : 'Edit Stats'}</button>
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
      <img
        src={stat.img || 'icons/svg/shield.svg'}
        alt="stat"
        on:click={() => onImageClick(stat)}
      />
      <input
        id={`file-${stat.id}`}
        type="file"
        accept="image/*"
        on:change={(e) => onFileChange(stat, e)}
        style="display: none;"
      />
      {#if editing}
        <div class="stats-editables">
          <input
            placeholder="Nombre"
            bind:value={stat.name}
            on:change={updateStat}
          />
          <input
            type="number"
            placeholder="Valor"
            bind:value={stat.value}
            on:change={updateStat}
          />
          <button on:click={() => removeStat(i)}>Quitar</button>
        </div>
      {:else}
        <div class="stat-view">{stat.name}: {stat.value}</div>
      {/if}

    </div>
  {/each}

  </div>

  <button on:click={toggleLog}>{showLog ? 'Ocultar Log' : 'Mostrar Log'}</button>
  {#if showLog}
    <div class="log">
      {#each log as entry}
        <div>{entry}</div>
      {/each}
    </div>
  {/if}
</div>
