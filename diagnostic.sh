#!/bin/bash

echo "=== CROW NEST MODULE DIAGNOSTIC ==="
echo ""
echo "1. Verificando estructura de archivos:"
echo "   module.json: $([ -f module.json ] && echo "✓ EXISTS" || echo "✗ MISSING")"
echo "   dist/main.js: $([ -f dist/main.js ] && echo "✓ EXISTS ($(du -h dist/main.js | cut -f1))" || echo "✗ MISSING")"
echo "   dist/main.css: $([ -f dist/main.css ] && echo "✓ EXISTS ($(du -h dist/main.css | cut -f1))" || echo "✗ MISSING")"
echo ""

echo "2. Verificando module.json:"
echo "   ID: $(grep '"id"' module.json | cut -d'"' -f4)"
echo "   Title: $(grep '"title"' module.json | cut -d'"' -f4)"
echo "   Version: $(grep '"version"' module.json | cut -d'"' -f4)"
echo "   Type: $(grep '"type"' module.json | cut -d'"' -f4)"
echo ""

echo "3. Verificando paths de archivos en module.json:"
echo "   esmodules: $(grep '"esmodules"' module.json)"
echo "   styles: $(grep '"styles"' module.json)"
echo ""

echo "4. Verificando que main.js sea válido JavaScript:"
if head -1 dist/main.js | grep -q "var\|const\|let\|function\|(function"; then
    echo "   ✓ main.js parece ser código JavaScript válido"
else
    echo "   ✗ main.js no parece ser código JavaScript válido"
fi
echo ""

echo "5. Verificando permisos de archivos:"
echo "   module.json permisos: $(ls -la module.json | cut -d' ' -f1)"
echo "   dist/main.js permisos: $(ls -la dist/main.js | cut -d' ' -f1)"
echo "   dist/main.css permisos: $(ls -la dist/main.css | cut -d' ' -f1)"
echo ""

echo "6. Verificando ubicación del módulo:"
echo "   Directorio actual: $(pwd)"
echo "   Ruta esperada de Foundry: Data/modules/crow-nest"
echo ""

echo "7. Sugerencias de troubleshooting:"
echo "   - Reinicia Foundry VTT completamente"
echo "   - Ve a Setup > Add-on Modules y busca 'Crow Nest'"
echo "   - Verifica que estés en el mundo correcto"
echo "   - Comprueba la consola de desarrollador (F12) por errores"
echo "   - Verifica que la versión de Foundry sea compatible (v11)"
echo ""

echo "=== FIN DEL DIAGNÓSTICO ==="
