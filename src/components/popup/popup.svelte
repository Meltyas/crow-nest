<script lang="ts">
  export let title = "Crow Nest Popup";
</script>

<style>
  .popup {
    padding: 1rem;
    background: #222;
    color: white;
    border-radius: 0.5rem;
  }
</style>

<div class="popup">
  <h2>{title}</h2>
  <slot />
</div>
