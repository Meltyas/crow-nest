<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let type: 'reputation' | 'resource';
  export let item: any;
  export let visible = false;

  const dispatch = createEventDispatcher();

  $: config = type === 'reputation' ? {
    imageDefault: 'icons/svg/aura.svg',
    namePlaceholder: 'Nombre de la facción',
    valuePlaceholder: 'Reputación (0-10)',
    detailsPlaceholder: 'Detalles sobre tu relación con esta facción...',
    valueMin: 0,
    valueMax: 10
  } : {
    imageDefault: 'icons/svg/item-bag.svg',
    namePlaceholder: 'Nombre del recurso',
    valuePlaceholder: 'Cantidad',
    detailsPlaceholder: 'Descripción del recurso...',
    valueMin: 0,
    valueMax: undefined
  };

  function handleImageClick() {
    dispatch('imageClick');
  }

  function handleConfirm() {
    dispatch('confirm');
  }

  function handleCancel() {
    dispatch('cancel');
  }
</script>

{#if visible}
  <div class="add-item-form">
    <button type="button" class="image-button" on:click={handleImageClick}>
      <img class="item-image" src={item.img || config.imageDefault} alt={type} />
    </button>
          <input
        class="item-input name-input"
        placeholder={config.namePlaceholder}
        bind:value={item.name}
      />

    <textarea
      class="item-textarea"
      placeholder={config.detailsPlaceholder}
      bind:value={item.details}
    ></textarea>

    <div class="item-amount">
      <span class="item-amount-label">
        {type === 'reputation' ? 'Reputación (0 a 10):' : 'Cantidad:'}
      </span>
      <input
        class="item-input number-input {type === 'reputation' ? 'reputation-type' : ''}"
        type="number"
        min={config.valueMin}
        max={config.valueMax}
        placeholder={config.valuePlaceholder}
        bind:value={item.value}
      />
    </div>

    <button class="standard-button" on:click={handleConfirm}>Agregar</button>
    <button class="standard-button" on:click={handleCancel}>Cancelar</button>
  </div>
{/if}

<style>
  .item-amount {
    display: flex;
    gap: 0.5rem;
    width: 100%;
  }

  .item-amount-label {
    display: flex;
    align-items: center;
  }

  .add-item-form {
    color: #000000;
    display: flex;
    font-family: "Overpass", sans-serif;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid #6b7280;
    border-radius: 8px;
    background: #ffffff;
    margin-bottom: 1rem;
    max-width: 31.7%;
  }

  .image-button {
    align-self: center;
    width: 100%;
    height: 56px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.2s ease;
  }

  .image-button:hover {
    transform: scale(1.05);
  }

  .item-image {
    background: #000000;
    height: 56px;
    object-fit: cover;
    width: 100%;
    border-radius: 8px;
    border: 2px solid #6b7280;
  }

  .image-button:hover .item-image {
    border-color: #9ca3af;
  }

  .item-input {
    background: transparent;
    border: solid 1px #000000;
    color: #000000;
    padding: 0.5rem;
    border-radius: 4px;
  }

  .number-input {
    width: 48px;
  }

  .number-input.reputation-type {
    width: 32px;
  }

  .item-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .item-textarea {
    background: transparent;
    border: solid 1px #000000;
    margin-bottom: 0.5rem;
    font-family: "Overpass", sans-serif;
    font-size: 14px;
    line-height: 1.4;
    color: #000000;
    width: 100%;
    padding: 0.5rem;
    border-radius: 4px;
    resize: vertical;
    min-height: 80px;
  }

  .item-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
</style>
