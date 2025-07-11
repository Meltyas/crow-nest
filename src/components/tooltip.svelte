<script lang="ts">
  import { tick } from 'svelte';
  export let content = '';
  let show = false;
  let tooltipEl: HTMLDivElement;
  let wrapperEl: HTMLDivElement;

  async function position() {
    await tick();
    if (!tooltipEl || !wrapperEl) return;
    const wrap = wrapperEl.getBoundingClientRect();
    const tip = tooltipEl.getBoundingClientRect();
    let left = (wrap.width - tip.width) / 2;
    left = Math.max(0, Math.min(left, wrap.width - tip.width));
    let top = -tip.height - 4;
    if (top < -wrap.top) {
      top = wrap.height + 4;
    }
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  }

  function onEnter() {
    show = true;
    position();
  }
  function onLeave() {
    show = false;
  }
</script>

<div class="tooltip-wrapper" bind:this={wrapperEl} on:mouseenter={onEnter} on:mouseleave={onLeave}>
  <slot></slot>
  {#if show}
    <div class="tooltip" bind:this={tooltipEl}>
      {@html content}
    </div>
  {/if}
</div>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-block;
  }
  .tooltip {
    position: absolute;
    background: #333;
    color: white;
    padding: 0.25rem;
    border-radius: 4px;
    max-width: 100%;
    white-space: normal;
    word-wrap: break-word;
    z-index: 10;
    pointer-events: none;
  }
</style>
