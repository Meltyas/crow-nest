<!-- ANTES: Integración del componente PatrolLayout en groups.svelte -->

<!-- En la sección de imports, agregar: -->
<script lang="ts">
  import PatrolLayout from '@/components/patrol-layout/patrol-layout.svelte';
  // ...otros imports existentes...
</script>

<!-- REEMPLAZAR esta sección: -->
<!--
          <div class="formation-container">
            <div class="formation-center officer-position">
              <div class="formation-slot officer-slot...">
                <!-- código del officer -->
              </div>
            </div>
            
            {#each Array(group.maxSoldiers || 5) as _, slotIndex}
              <!-- código de soldiers -->
            {/each}
          </div>
-->

<!-- CON esta nueva implementación: -->
<div class="patrol-layout-container">
  <PatrolLayout
    group={group}
    maxSoldiers={group.maxSoldiers || 6}
    on:officerClick={(e) => handleOfficerClick(e.detail)}
    on:soldierClick={(e) => handleSoldierClick(e.detail.soldier, e.detail.index, group)}
    on:addSoldier={() => handleAddSoldier(group)}
    on:removeSoldier={(e) => handleRemoveSoldier(group, e.detail)}
  />
</div>

<!-- Y agregar estas funciones al script: -->
<script lang="ts">
  // ...código existente...

  function handleOfficerClick(officer: GroupMember) {
    if (officer?.id) {
      openActorSheet(officer.id);
    }
  }

  function handleSoldierClick(soldier: GroupMember, index: number, group: Group) {
    if (soldier?.id) {
      openActorSheet(soldier.id);
    }
  }

  function handleAddSoldier(group: Group) {
    // Logic para agregar soldado (puede abrir dialog de selección)
    // o simplemente agregar un placeholder
    if (!group.soldiers) group.soldiers = [];
    
    // Ejemplo: agregar placeholder que se puede editar después
    const newSoldier: GroupMember = {
      id: `temp-${Date.now()}`,
      name: 'New Soldier',
      img: 'icons/svg/mystery-man.svg' // Default Foundry icon
    };
    
    group.soldiers.push(newSoldier);
    updateGroups(groups);
  }

  function handleRemoveSoldier(group: Group, index: number) {
    if (group.soldiers && group.soldiers[index]) {
      group.soldiers.splice(index, 1);
      updateGroups(groups);
    }
  }
</script>

<!-- Estilos adicionales si es necesario -->
<style>
  .patrol-layout-container {
    margin: 1rem 0;
    display: flex;
    justify-content: center;
  }
</style>
