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

    const center = wrap.left + wrap.width / 2;
    const availableLeft = center;
    const availableRight = window.innerWidth - center;
    const maxWidth = 2 * Math.min(availableLeft, availableRight) - 8;
    tooltipEl.style.maxWidth = `${maxWidth}px`;

    const tip = tooltipEl.getBoundingClientRect();
    const desiredLeftViewport = center - tip.width / 2;
    const clampedLeftViewport = Math.min(
      Math.max(desiredLeftViewport, 0),
      window.innerWidth - tip.width
    );
    const left = clampedLeftViewport - wrap.left;

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
    white-space: normal;
    word-wrap: break-word;
    z-index: 10;
    pointer-events: none;
  }
</style>
