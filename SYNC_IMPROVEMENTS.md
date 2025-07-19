# Mejoras de Sincronización Bidireccional para Componentes Unificados

## Problemas Resueltos

### 1. **Sincronización Bidireccional Completa**

- **Problema**: Los componentes unificados no reaccionaban a cambios externos del store
- **Solución**: Implementación de suscripción directa al `presetsStore` con `SyncManager`

### 2. **Reactividad del Botón "Usar/Retirar"**

- **Problema**: El botón no cambiaba inmediatamente después del click
- **Solución**: Actualización forzada del estado local tras las operaciones

### 3. **Botón "Quitar" en Guard**

- **Problema**: No había forma de quitar elementos del guard
- **Solución**: Botón flotante "✕" que desactiva elementos en lugar de eliminarlos

### 4. **Visibilidad de Elementos**

- **Problema**: Los elementos no aparecían hasta cambiar de tab
- **Solución**: Reactividad mejorada basada en el store actualizado

## Implementación Técnica

### Patrón de Sincronización Reutilizable

```typescript
// 1. Suscripción al store
let currentPresets = $presetsStore;
let syncManager: SyncManager;

// 2. Variables reactivas basadas en store actualizado
$: activeResources = groupId
  ? currentPresets.resources.filter((r) => r.groupId === groupId && r.active)
  : currentPresets.resources.filter((r) => !r.groupId && r.active);

// 3. Lifecycle hooks
onMount(() => {
  const unsubscribe = presetsStore.subscribe((value) => {
    currentPresets = value;
  });

  import("@/utils/sync").then(({ SyncManager }) => {
    syncManager = SyncManager.getInstance();
    syncManager.subscribe("unifiedPresets", handleSyncUpdate);
  });

  return unsubscribe;
});

onDestroy(() => {
  if (syncManager) {
    syncManager.unsubscribe("unifiedPresets", handleSyncUpdate);
  }
});

// 4. Handler para cambios externos
function handleSyncUpdate(data: any) {
  if (data && data.resources) {
    currentPresets = data;
  }
}

// 5. Operaciones con actualización forzada
async function handleActivatePreset(presetId: string) {
  await toggleResourceActive(presetId);
  currentPresets = $presetsStore; // Forzar reactividad
  dispatch("updateResource");
}
```

### Botones Contextuales en ItemCard

```svelte
<!-- Preset Manager: Activar/Desactivar y Eliminar -->
{#if inPresetManager}
  <div class="preset-floating-buttons">
    <button class="preset-floating-button {item.active ? 'active' : ''}">
      {item.active ? 'Retirar' : 'Usar'}
    </button>
    <button class="preset-floating-button remove">🗑️</button>
  </div>

<!-- Guard: Solo Quitar (desactivar) -->
{:else}
  <div class="preset-floating-buttons">
    <button class="preset-floating-button remove">✕</button>
  </div>
{/if}
```

### Lógica de Botón Quitar Inteligente

```typescript
function handleRemovePreset() {
  if (inPresetManager) {
    // En preset manager: eliminar completamente
    dispatch("removePreset", item.key || item.id);
  } else {
    // En guard: desactivar (quitar del guard)
    dispatch("activatePreset", { id: item.key || item.id, active: false });
  }
}
```

## Beneficios del Nuevo Sistema

### 1. **Reutilizable**

- Patrón estándar que se puede aplicar a cualquier componente unificado futuro
- Código modular y bien estructurado

### 2. **Reactivo**

- Cambios instantáneos en la UI
- Sincronización bidireccional automática

### 3. **Contextual**

- Comportamiento diferente según el contexto (guard vs preset manager)
- Botones apropiados para cada situación

### 4. **Robusto**

- Manejo de errores y cleanup automático
- Compatibilidad con diferentes formatos de ID

## Componentes Actualizados

- ✅ `src/components/unified/unified-resources.svelte`
- ✅ `src/components/unified/unified-reputation.svelte`
- ✅ `src/components/guard/item-card.svelte`
- ✅ `src/stores/presets.ts`

## Cómo Usar para Futuros Componentes Unificados

1. Importar `presetsStore` y `SyncManager`
2. Crear variable local `currentPresets = $presetsStore`
3. Usar variables reactivas basadas en `currentPresets`
4. Implementar `onMount` y `onDestroy` con suscripciones
5. Forzar actualización tras operaciones con `currentPresets = $presetsStore`

Este patrón garantiza sincronización completa y reactividad inmediata para todos los componentes unificados futuros.
