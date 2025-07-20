// CROW NEST MODULE DIAGNOSTIC SCRIPT
// Run this in Foundry's console (F12) to check module status

console.log("🦅 === CROW NEST DIAGNOSTIC TOOL ===");

// 1. Check if module is loaded
const module = game.modules.get("crow-nest");
console.log("🔍 Module Found:", !!module);
if (module) {
  console.log("📋 Module Details:", {
    id: module.id,
    title: module.title,
    active: module.active,
    version: module.version,
    author: module.authors?.[0]?.name || "Unknown"
  });
} else {
  console.log("❌ Module 'crow-nest' not found in game.modules");
  console.log("📋 Available modules:", Array.from(game.modules.keys()));
}

// 2. Check manifest file
fetch("modules/crow-nest/module.json")
  .then(response => response.json())
  .then(manifest => {
    console.log("📄 Manifest loaded successfully:");
    console.log("   - ID:", manifest.id);
    console.log("   - Title:", manifest.title);
    console.log("   - Version:", manifest.version);
    console.log("   - Compatibility:", manifest.compatibility);
    console.log("   - Main script:", manifest.esmodules?.[0] || "Not found");
  })
  .catch(error => {
    console.log("❌ Failed to load manifest:", error);
  });

// 3. Check main script
fetch("modules/crow-nest/dist/main.js")
  .then(response => {
    console.log("📦 Main script status:", response.ok ? "✅ Found" : "❌ Not found");
    console.log("   - Size:", response.headers.get("content-length") || "Unknown");
  })
  .catch(error => {
    console.log("❌ Failed to load main script:", error);
  });

// 4. Check CSS
fetch("modules/crow-nest/dist/main.css")
  .then(response => {
    console.log("🎨 CSS file status:", response.ok ? "✅ Found" : "❌ Not found");
    console.log("   - Size:", response.headers.get("content-length") || "Unknown");
  })
  .catch(error => {
    console.log("❌ Failed to load CSS:", error);
  });

// 5. Check if hooks are registered
console.log("🪝 Hooks check:");
console.log("   - Init hook registered:", !!Hooks._hooks.init?.find(h => h.fn.toString().includes("Crow Nest")));
console.log("   - Ready hook registered:", !!Hooks._hooks.ready?.find(h => h.fn.toString().includes("Crow Nest")));

// 6. Check global availability
console.log("🌍 Global availability:");
console.log("   - globalThis.game:", !!globalThis.game);
console.log("   - window.game:", !!window.game);
console.log("   - game.user:", !!game?.user);
console.log("   - User type:", game?.user?.isGM ? "GM" : "Player");

console.log("🦅 === END DIAGNOSTIC ===");
