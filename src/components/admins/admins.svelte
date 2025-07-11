<script lang="ts">
  import type { GuardModifier, GuardStat } from '@/guard/stats';
  import { getStats, getModifiers } from "@/guard/stats";
  import Tooltip from '@/components/tooltip.svelte';
  import {
    getAdmins,
    saveAdmins,
    type Admin,
    type AdminSkill,
    type AdminMember
  } from "@/admin/admins";
  import { onMount } from 'svelte';

  let stats: GuardStat[] = [];
  let admins: Admin[] = [];
  let modifiers: GuardModifier[] = [];
  let editingMods = false;

  onMount(() => {
    stats = getStats() as GuardStat[];
    admins = getAdmins();
    modifiers = getModifiers();
  });

  async function persist() {
    await saveAdmins(admins);
  }

  function addAdmin() {
    admins = [
      ...admins,
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

  function removeAdmin(index: number) {
    admins.splice(index, 1);
    admins = [...admins];
    persist();
  }

  function onDragMember(event: DragEvent, member: AdminMember | null) {
    if (!member) return;
    const payload = {
      type: 'Actor',
      uuid: `Actor.${member.id}`,
    };
    event.dataTransfer?.setData('text/plain', JSON.stringify(payload));
  }

  function onDragDeploy(event: DragEvent, admin: Admin) {
    const payload = {
      type: 'CrowPatrol',
      patrolId: admin.id,
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

  async function onDropOfficer(event: DragEvent, admin: Admin) {
    const actor = await actorFromDrop(event);
    if (!actor) return;

    admin.officer = {
      id: actor.id,
      name: actor.name,
      img: actor.img,
    };

    if (!admin.name) {
      admin.name = `Patrulla de ${actor.name}`;
    }

    admins = [...admins];
    persist();
  }


  async function onDropSoldier(event: DragEvent, admin: Admin) {
    const actor = await actorFromDrop(event);
    if (!actor) return;

    admin.soldiers = [
      ...admin.soldiers,
      { id: actor.id, name: actor.name, img: actor.img },
    ];
    admins = [...admins];
    persist();
  }

  function addSkill(admin: Admin) {
    const skill: AdminSkill = { name: '', description: '', img: '' };
    admin.skills = [...admin.skills, skill];
    admins = [...admins];
    persist();
  }

  function removeSkill(admin: Admin, index: number) {
    admin.skills.splice(index, 1);
    admin.skills = [...admin.skills];
    admins = [...admins];
    persist();
  }

  function guardBonus(key: string): number {
    return modifiers.reduce((acc, m) => acc + (m.mods[key] || 0), 0);
  }

  function totalStat(stat: GuardStat, admin: Admin): number {
    return stat.value + guardBonus(stat.key) + (admin.mods[stat.key] || 0);
  }

  function roll(stat: GuardStat, admin: Admin) {
    const total = totalStat(stat, admin);
    const r = new Roll(`1d20 + ${total}`);
    r.evaluate({ async: false });
    r.toMessage({ speaker: { alias: admin.officer || 'Admin' }, flavor: stat.name });
  }
</script>

<style>
  .admin {
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

  .admin-stat {
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

<div class="admins">
  {#each admins as admin, i}
    <div class="admin">
      <strong>{admin.name}</strong>
      <div
        class="drop-zone officer"
        on:dragover|preventDefault
        on:drop={(e) => onDropOfficer(e, admin)}
      >
        {#if admin.officer}
          <div
            class="member"
            draggable="true"
            on:dragstart={(e) => onDragMember(e, admin.officer)}
          >
            <img
              src={admin.officer.img}
              alt={admin.officer.name}
              width="32"
              height="32"
              draggable="true"
            />
            <span>{admin.officer.name}</span>
            <button on:click={() => console.log(admin.officer)}>Info</button>
          </div>
        {:else}
          <em>Arrastra un oficial aquí</em>
        {/if}
      </div>
      <div
        class="drop-zone"
        on:dragover|preventDefault
        on:drop={(e) => onDropSoldier(e, admin)}
      >
        {#each admin.soldiers as s}
          <div
            class="member"
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
        {#if admin.soldiers.length === 0}
          <em>Arrastra soldados aquí</em>
        {/if}
      </div>
      <div>
        {#each stats as stat}
          <div class="admin-stat">
            <Tooltip content={`<span>${stat.name}</span>`}>
              <button class="stat-icon" on:click={() => roll(stat, admin)}>
                <img src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} />
              </button>
            </Tooltip>
            {#if editingMods}
              <input type="number" bind:value={admin.mods[stat.key]} on:change={persist} />
            {:else}
              <span>{admin.mods[stat.key] || 0}</span>
              <span>({totalStat(stat, admin)})</span>
            {/if}
          </div>
        {/each}
      </div>
      <button on:click={() => (editingMods = !editingMods)}>
        {editingMods ? 'Guardar Mods' : 'Editar Mods'}
      </button>
      <div class="skills">
        <strong>Habilidades</strong>
        {#each admin.skills as sk, j}
          <div class="skill">
            <img src={sk.img} alt="" />
            <input placeholder="Imagen" bind:value={sk.img} on:change={persist} />
            <input placeholder="Nombre" bind:value={sk.name} on:change={persist} />
            <input placeholder="Descripción" bind:value={sk.description} on:change={persist} />
            <button on:click={() => removeSkill(admin, j)}>Quitar</button>
          </div>
        {/each}
        <button on:click={() => addSkill(admin)}>Añadir Habilidad</button>
      </div>
      <button
        class="deploy"
        draggable="true"
        on:dragstart={(e) => onDragDeploy(e, admin)}
      >Desplegar</button>
      <button on:click={() => removeAdmin(i)}>Eliminar Patrulla</button>
    </div>
  {/each}
  <button on:click={addAdmin}>Añadir Patrulla</button>
</div>
