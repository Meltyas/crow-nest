<script lang="ts">
  import { onMount } from "svelte";
  import Popup from "@/components/popup/popup.svelte";
  import Guard from "@/components/guard/guard.svelte";

  let pos = { x: 0, y: 0 };
  let isDragging = false;
  let offset = { x: 0, y: 0 };
  let showPopup = false;

  onMount(() => {
    const saved = localStorage.getItem("crowHudPos");
    if (saved) {
      pos = JSON.parse(saved);
    } else {
      pos = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
    }
  });

  function onMouseDown(event: MouseEvent) {
    isDragging = true;
    offset = {
      x: event.clientX - pos.x,
      y: event.clientY - pos.y,
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(event: MouseEvent) {
    if (!isDragging) return;
    pos = {
      x: event.clientX - offset.x,
      y: event.clientY - offset.y,
    };
  }

  function onMouseUp() {
    isDragging = false;
    localStorage.setItem("crowHudPos", JSON.stringify(pos));
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }

  function togglePopup() {
    showPopup = !showPopup;
  }
</script>

<style>
  .hud-crow {
    position: absolute;
    top: 0;
    left: 0;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 0.5rem;
    border-radius: 0.5rem;
    user-select: none;
    z-index: 1000;
    width: max-content;
  }

  .hud-crow.expanded {
    background: rgba(0, 0, 0, 1);
  }

  .drag-area {
    cursor: move;
    margin-bottom: 0.25rem;
  }
</style>

<div
  class="hud-crow"
  class:expanded={showPopup}
  style="transform: translate({pos.x}px, {pos.y}px);"
>
  <div class="drag-area" on:mousedown={onMouseDown}>Crow Nest</div>
  <button on:click|stopPropagation={togglePopup}>Abrir Popup</button>
</div>

{#if showPopup}
  <Popup title="Crow Nest Ready" on:close={togglePopup}>
    <Guard />
  </Popup>
{/if}
