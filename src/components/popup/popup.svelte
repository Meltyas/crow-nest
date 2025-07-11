<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let title = 'Crow Nest Popup';
  const dispatch = createEventDispatcher();

  let pos = { x: 0, y: 0 };
  let dragging = false;
  let offset = { x: 0, y: 0 };

  onMount(() => {
    pos = { x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 100 };
  });

  function onHeaderDown(event: MouseEvent) {
    dragging = true;
    offset = {
      x: event.clientX - pos.x,
      y: event.clientY - pos.y,
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onMove(event: MouseEvent) {
    if (!dragging) return;
    pos = {
      x: event.clientX - offset.x,
      y: event.clientY - offset.y,
    };
  }

  function onUp() {
    dragging = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  }

  function close() {
    dispatch('close');
  }
</script>

<style>
  .window-app {
    position: absolute;
    background: #222;
    color: white;
    border: 1px solid #555;
    border-radius: 4px;
    width: 300px;
  }

  header {
    background: #444;
    padding: 0.25rem;
    cursor: move;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .close {
    cursor: pointer;
  }

  .content {
    padding: 0.5rem;
  }
</style>

<div
  class="window-app"
  style="transform: translate({pos.x}px, {pos.y}px);"
>
  <header on:mousedown={onHeaderDown}>
    <span>{title}</span>
    <a class="close" on:click={close}>×</a>
  </header>
  <div class="content">
    <slot />
  </div>
</div>
