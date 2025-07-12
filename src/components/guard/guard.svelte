<script lang="ts">
  import Tooltip from '@/components/tooltip.svelte';
  import type { GuardModifier, GuardResource, GuardStat, LogEntry } from '@/guard/stats';
  import {
    getLog,
    getModifiers,
    getResources,
    getStats,
    saveModifiers,
    saveResources,
    saveStats,
  } from '@/guard/stats';
  import { onMount } from 'svelte';

  // FilePicker is provided by Foundry at runtime
  declare const FilePicker: any;

  interface Stat extends GuardStat {}

  let stats: Stat[] = [];
  let log: LogEntry[] = [];
  let showLog = false;
  let addingStat = false;
  let editing = false;
  let newStat: Stat = { key: '', name: '', value: 0 };

  let modifiers: GuardModifier[] = [];
  let addingModifier = false;
  let editingMods = false;
  let newModifier: GuardModifier = { key: '', name: '', description: '', mods: {} };

  let resources: GuardResource[] = [];
  let addingResource = false;
  let newResource: GuardResource = { key: '', name: '', value: 0 };

  onMount(() => {
    stats = getStats() as Stat[];
    log = getLog();
    modifiers = getModifiers();
    resources = getResources();
  });

  async function persist() {
    await saveStats(stats, log);
  }

  async function persistMods() {
    await saveModifiers(modifiers);
  }

  async function persistRes() {
    await saveResources(resources);
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

  function openAddModifier() {
    newModifier = { key: crypto.randomUUID(), name: '', description: '', mods: {} };
    addingModifier = true;
  }

  function cancelAddModifier() {
    addingModifier = false;
  }

  async function confirmAddModifier() {
    newModifier.mods = Object.fromEntries(
      Object.entries(newModifier.mods).filter(([, v]) => Number(v) !== 0)
    );
    modifiers = [...modifiers, { ...newModifier }];
    await persistMods();
    addingModifier = false;
  }

  async function removeModifier(index: number) {
    modifiers.splice(index, 1);
    modifiers = [...modifiers];
    await persistMods();
  }

  async function updateModifier() {
    modifiers = modifiers.map((m) => ({
      ...m,
      mods: Object.fromEntries(
        Object.entries(m.mods).filter(([, v]) => Number(v) !== 0)
      ),
    }));
    await persistMods();
  }

  function modChanges(mod: GuardModifier): string {
    return Object.entries(mod.mods)
      .map(([k, v]) => {
        const stat = stats.find((s) => s.key === k);
        if (!stat) return '';
        const val = Number(v) > 0 ? `+${v}` : `${v}`;
        return `<div><strong>${stat.name}:</strong> ${val}</div>`;
      })
      .filter(Boolean)
      .join('');
  }

  function toggleEditingMods() {
    editingMods = !editingMods;
  }

  function toggleLog() {
    showLog = !showLog;
  }

  function toggleEditing() {
    editing = !editing;
  }

  function onImageClick(stat: Stat) {
    if (editing) {
      if (typeof FilePicker !== 'undefined') {
        // @ts-ignore - FilePicker is provided by Foundry at runtime
        new FilePicker({
          type: 'image',
          current: stat.img,
          callback: (path: string) => {
            stat.img = path;
            updateStat();
          },
        }).render(true);
      }
    } else {
      const bonus = modifiers.reduce(
        (acc, m) => acc + (m.mods[stat.key] || 0),
        0
      );
      const r = new Roll(`1d20 + ${stat.value + bonus}`);
      r.evaluate({ async: false });

      const lines: string[] = [];
      for (const m of modifiers) {
        const v = m.mods[stat.key];
        if (v) lines.push(`${m.name} ${v > 0 ? '+' : ''}${v}`);
      }

      const flavor = [stat.name, ...lines].join('<br/>');
      r.toMessage({ speaker: { alias: 'La Guardia' }, flavor });
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

  function onModImageClick(mod: GuardModifier) {
    if (editingMods) {
      const input = document.getElementById(`mod-file-${mod.key}`) as HTMLInputElement | null;
      input?.click();
    }
  }

  function onModFileChange(mod: GuardModifier, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      mod.img = String(reader.result);
      updateModifier();
    };
    reader.readAsDataURL(input.files[0]);
  }

  function openAddResource() {
    newResource = { key: crypto.randomUUID(), name: '', value: 0 };
    addingResource = true;
  }

  function cancelAddResource() {
    addingResource = false;
  }

  async function confirmAddResource() {
    resources = [...resources, { ...newResource }];
    await persistRes();
    addingResource = false;
  }

  async function removeResource(index: number) {
    resources.splice(index, 1);
    resources = [...resources];
    await persistRes();
  }

  async function updateResource() {
    await persistRes();
  }

  function onResImageClick(res: GuardResource) {
    const input = document.getElementById(`res-file-${res.key}`) as HTMLInputElement | null;
    input?.click();
  }

  function onResFileChange(res: GuardResource, event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const reader = new FileReader();
    reader.onload = () => {
      res.img = String(reader.result);
      updateResource();
    };
    reader.readAsDataURL(input.files[0]);
  }
</script>

<style>
  .guard-container {
    padding: 0.5rem;
    color: white;
    overflow-y: auto;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.25rem;
    flex: 1 1 0;
    min-width: 0;
    max-width: none;
    box-sizing: border-box;
  }

  .stat img {
    height: 42px;
    width: 42px;
  }

  .stat-img {
    background: none;
    border: none;
    padding: 0;
    height: 42px;
    width: 42px;
    cursor: pointer;
  }

  .stat-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    flex-wrap: wrap;
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
  .add-mod-form {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0.5rem 0;
  }
  .modifier {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }
  .modifier-values {
    display: flex;
    gap: 0.25rem;
  }
  .modifier-edit {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .stats-editables {
    display: flex;
    gap: 0.25rem;
  }

  .stat-name-input {
    max-width: 100px;
    text-align: center;
  }

  .stat-number {
    display: flex;
  }

  .stat-number-input {
    width: 30px;
    text-align: center;
  }

  .stat-number-close {
    width: 24px;
    text-align: center;
  }

  .stat-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-weight: bold;
  }

  .add-resource-form {
    display: flex;
    gap: 0.25rem;
    margin: 0.5rem 0;
  }

  .resource {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.25rem;
  }
  .modifier-container {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .modifier {
    max-width: 125px;
  }
  .standard-image {
    width: 24px;
    height: 24px;
  }
  .resource-container {
    display: flex;
    gap: 0.25rem;
  }
  .button-holder {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .stat-value {
    display: flex;
    align-items: center;
    height: 32px;
    font-size: 24px;
    font-weight: bold;
  }
  .stat-name {
    margin-bottom: 0.25rem;
  }
</style>
<h3>Los Cuervos</h3>
<div class="guard-container">

  <div class="button-holder">
    {#if editing}
      <button on:click={openAddStat}>Añadir Stat</button>
    {/if}
    <button on:click={toggleEditing}>{editing ? 'Stop Editing' : 'Edit Stats'}</button>
  </div>

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
      <button class="stat-img" on:click={() => onImageClick(stat)}>
        <img class="standard-image" src={stat.img || 'icons/svg/shield.svg'} alt="stat" />
      </button>
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
            class="stat-name-input"
            placeholder="Nombre"
            bind:value={stat.name}
            on:change={updateStat}
          />
        </div>
        <div class="stat-number">
          <input
            class="stat-number-input"
            type="number"
            placeholder="Valor"
            bind:value={stat.value}
            on:change={updateStat}
          />
          <button class="stat-number-close" on:click={() => removeStat(i)}>X</button>
        </div>
      {:else}
        <div class="stat-view">
          <div class="stat-name">{stat.name}</div>
          <div class="stat-value">{stat.value}</div>
        </div>
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

  <hr />
  <h4>Modificaciones Situacionales</h4>
  {#if editingMods}
    <button on:click={openAddModifier}>Añadir Modificador</button>
  {/if}
  <button on:click={toggleEditingMods}>{editingMods ? 'Stop Edit Mods' : 'Edit Mods'}</button>
  {#if addingModifier}
    <div class="add-mod-form">
      <input placeholder="Nombre" bind:value={newModifier.name} />
      <input placeholder="Descripción" bind:value={newModifier.description} />
      {#each stats as stat}
        <div class="modifier-values">
          <img class="standard-image" src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} width="16" height="16" />
          <input type="number" bind:value={newModifier.mods[stat.key]} />
        </div>
      {/each}
      <button on:click={confirmAddModifier}>Agregar</button>
      <button on:click={cancelAddModifier}>Cancelar</button>
    </div>
  {/if}
  <div class="modifier-container">
  {#each modifiers as mod, i}
    <div class="modifier">
      <Tooltip content={`<p><strong>${mod.name}:</strong> ${mod.description ?? ''}</p>`}>
        <img class="standard-image" src={mod.img || 'icons/svg/upgrade.svg'} alt="mod" on:click={() => onModImageClick(mod)} />
      </Tooltip>
      <input id={`mod-file-${mod.key}`} type="file" accept="image/*" style="display:none" on:change={(e)=>onModFileChange(mod,e)} />
      {#if editingMods}
        <div class="modifier-edit">
          <input placeholder="Nombre" bind:value={mod.name} on:change={updateModifier} />
          <input placeholder="Descripción" bind:value={mod.description} on:change={updateModifier} />
          {#each stats as stat}
            <div class="modifier-values">
              <img class="standard-image" src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} width="16" height="16" />
              <input type="number" bind:value={mod.mods[stat.key]} on:change={updateModifier} />
            </div>
          {/each}
          <button on:click={() => removeModifier(i)}>X</button>
        </div>
      {:else}
        <Tooltip content={modChanges(mod)}>
          <div class="modifier-values">
            {#each Object.entries(mod.mods) as [k,v]}
              {#if stats.find(s => s.key === k)}
                <img class="standard-image" src={(stats.find(s => s.key === k)?.img) || 'icons/svg/shield.svg'} alt="stat" width="16" height="16" />
                <span>{v>0 ? '+' : ''}{v}</span>
              {/if}
            {/each}
          </div>
        </Tooltip>
      {/if}
    </div>
  {/each}
</div>

  <hr />
  <h3>Recursos</h3>
  {#if addingResource}
    <div class="add-resource-form">
      <input placeholder="Nombre" bind:value={newResource.name} />
      <input type="number" bind:value={newResource.value} />
      <button on:click={confirmAddResource}>Agregar</button>
      <button on:click={cancelAddResource}>Cancelar</button>
    </div>
  {/if}
  <button on:click={openAddResource}>Añadir Recurso</button>

  <div class="resource-container">
  {#each resources as res, i}
    <div class="resource">
      <img class="standard-image" src={res.img || 'icons/svg/item-bag.svg'} alt="res" on:click={() => onResImageClick(res)} />
      <input id={`res-file-${res.key}`} type="file" accept="image/*" style="display:none" on:change={(e)=>onResFileChange(res,e)} />
      <input placeholder="Nombre" bind:value={res.name} on:change={updateResource} />
      <input type="number" bind:value={res.value} on:change={updateResource} />
      <button on:click={() => removeResource(i)}>X</button>
    </div>
  {/each}
  </div>
</div>
