<script lang="ts">
  import { onMount } from 'svelte';
  import type { GuardStat, LogEntry } from '@/guard/stats';
  import { getStats, getLog, saveStats } from '@/guard/stats';

  interface Stat extends GuardStat {}

  let stats: Stat[] = [];
  let log: LogEntry[] = [];
  let showLog = false;
  let addingStat = false;
  let editing = false;
  let newStat: Stat = { key: '', name: '', value: 0 };

  onMount(() => {
    stats = getStats() as Stat[];
    log = getLog();
  });

  async function persist() {
    await saveStats(stats, log);
  }

  function openAddStat() {
    newStat = { key: crypto.randomUUID(), name: '', value: 0 };
    addingStat = true;
  }

  async function confirmAddStat() {
    stats = [...stats, { ...newStat }];
    log = [
      ...log,
      {
        user: game.user?.name ?? 'unknown',
        time: Date.now(),
        action: `create ${newStat.key}`,
        next: { ...newStat },
      },
    ];
    await persist();
    addingStat = false;
  }

  function cancelAddStat() {
    addingStat = false;
  }

  async function removeStat(index: number) {
    const [removed] = stats.splice(index, 1);
    stats = [...stats];
    log = [
      ...log,
      {
        user: game.user?.name ?? 'unknown',
        time: Date.now(),
        action: `delete ${removed.key}`,
        previous: removed,
      },
    ];
    await persist();
  }

  async function updateStat() {
    log = [
      ...log,
      {
        user: game.user?.name ?? 'unknown',
        time: Date.now(),
        action: 'edit',
      },
    ];
    await persist();
  }

  function toggleLog() {
    showLog = !showLog;
  }

  function toggleEditing() {
    editing = !editing;
  }

  function onImageClick(stat: Stat) {
    if (editing) {
      const input = document.getElementById(`file-${stat.key}`) as HTMLInputElement | null;
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
        id={`file-${stat.key}`}
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
        <div>{new Date(entry.time).toLocaleString()} - {entry.user}: {entry.action}</div>
      {/each}
    </div>
  {/if}
</div>
