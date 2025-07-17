# Solución al Problema de Cambio de ID en Presets

## 🔧 Problema Identificado
Cuando se editaba un preset en el preset-manager, la ID del objeto cambiaba porque la función `saveEdit()` estaba **removiendo** el preset existente y **agregando** uno nuevo, en lugar de actualizarlo directamente.

## ✅ Solución Implementada

### 1. **Modificación en `presets-popup.svelte`**
- **Antes**: `saveEdit()` usaba `removePreset()` + `addPreset()` 
- **Después**: `saveEdit()` actualiza directamente el preset en el store preservando la ID original

```typescript
// ANTES (problemático)
removePreset(editingPreset.id, editingPreset.type);
addPreset(updatedPreset);

// DESPUÉS (correcto)
presetsStore.update(currentPresets => {
  // Actualiza directamente el preset existente manteniendo la ID
  presetsArray[presetIndex] = {
    ...editingPreset, // ✅ Preserva ID original
    // ... actualiza solo los campos modificados
  };
  return currentPresets;
});
```

### 2. **Preservación del `sourceId`**
- Asegurado que el `sourceId` se preserve en todas las operaciones de edición
- Uso de `...editingPreset.data` para mantener propiedades originales incluyendo `sourceId`

### 3. **Actualización en `guard.svelte`**
- Mejorado `applySituationalModifierPreset()` para preservar el `sourceId` cuando se actualiza un modificador existente
- Búsqueda mejorada: `modifiers.find(m => m.key === presetKey || m.sourceId === presetKey)`

## 🎯 Beneficios de la Solución

### ✅ **ID Estable**
- La ID del preset **nunca cambia** después de editar
- Los botones de preset en guard siguen funcionando correctamente
- No se crean copias duplicadas con valores antiguos

### ✅ **SourceId Preservado**
- El `sourceId` se mantiene intacto en todas las operaciones
- La sincronización bidireccional funciona correctamente
- Los vínculos entre modificadores y presets se mantienen

### ✅ **Persistencia Mejorada**
- Uso correcto de `persistPresets()` para guardar cambios
- Sincronización automática entre jugadores
- Logging mejorado para debugging

## 🔄 Flujo de Funcionamiento

1. **Editar Preset**: La ID se mantiene estable
2. **Aplicar Preset**: Usa la misma ID para buscar y aplicar correctamente
3. **Sincronización**: Los cambios se sincronizan sin crear duplicados
4. **Persistencia**: Los datos se guardan correctamente en Foundry

## 📊 Resultado Final

✅ **Problema Resuelto**: Cuando modificas un preset y lo guardas, la ID no cambia  
✅ **Funcionalidad Preservada**: Los botones de preset siguen funcionando con los valores actualizados  
✅ **Sin Duplicados**: No se crean copias con stats antiguos  
✅ **Sincronización Estable**: La sincronización bidireccional funciona perfectamente  

## 🧪 Cómo Probar

1. Crear un preset desde un modificador situacional
2. Editar el preset (cambiar nombre, stats, etc.)
3. Guardar los cambios
4. Presionar el botón de preset en guard
5. **Verificar**: Se aplica el preset con los valores actualizados, no los antiguos

La solución garantiza que la ID y el sourceId permanezcan estables durante todas las operaciones de edición.
