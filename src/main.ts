import Hud from "@/components/hud/hud.svelte";
import "./styles/global.pcss";

Hooks.once("init", () => {
  console.log("Crow Nest | Initializing module");
});

Hooks.once("ready", () => {
  console.log("Crow Nest | Ready");
});

Hooks.once("ready", () => {
  const container = document.createElement("div");
  container.style.position = "absolute";
  document.body.appendChild(container);
  new Hud({ target: container });
});
