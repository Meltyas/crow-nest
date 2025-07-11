# Crow Nest

Crow Nest es un módulo para Foundry VTT. Para compilarlo y cargarlo en Foundry sigue estos pasos:

1. Instala las dependencias (solo la primera vez):
   ```bash
   npm install
   ```
2. Genera los archivos de `dist`:
   ```bash
   npm run build
   ```
3. Copia todo el proyecto, incluido `module.json` y la carpeta `dist`, en la carpeta de módulos de Foundry VTT. Por ejemplo:
   `FoundryData/Data/modules/crow-nest/`
4. Reinicia Foundry VTT y activa el módulo desde la sección **Add-on Modules**.
