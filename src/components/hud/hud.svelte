<script lang="ts">
  import Popup from "@/components/popup/popup.svelte";

  let pos = { x: 20, y: 20 };
  let isDragging = false;
  let offset = { x: 0, y: 0 };
  let showPopup = false;

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
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }

  function togglePopup() {
    showPopup = !showPopup;
  }
</script>

<style>
  .hud-crow {
    position: fixed;
    top: 0;
    left: 0;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 0.5rem;
    border-radius: 0.5rem;
    user-select: none;
    cursor: move;
    z-index: 1000;
  }
</style>

<div
  class="hud-crow"
  style="transform: translate({pos.x}px, {pos.y}px);"
  on:mousedown={onMouseDown}
>
  <button on:click|stopPropagation={togglePopup}>Abrir Popup</button>
</div>

{#if showPopup}
  <Popup title="Crow Nest Ready" />
{/if}
