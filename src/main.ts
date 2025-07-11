import Popup from "@/components/popup/Popup.svelte";

Hooks.once("init", () => {
  console.log("Crow Nest | Initializing module");
});

Hooks.once("ready", () => {
  console.log("Crow Nest | Ready");
});

Hooks.once("ready", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  new Popup({ target: container, props: { title: "Crow Nest Ready" } });
});
