<script context="module" lang="ts">
  declare const FilePicker: any;
</script>

<script lang="ts">
  import type { GuardModifier, GuardStat } from '@/guard/stats';
  import { getModifiers, getStats } from "@/guard/stats";
  import type { Group, GroupMember, GroupSkill } from "@/shared/group";
  import { SyncManager, type SyncEvent } from '@/utils/sync';
  import { onDestroy, onMount } from 'svelte';

  export let groups: Group[] = [];
  export let saveGroups: (groups: Group[]) => Promise<void>;
  export let labels = {
    groupSingular: 'Patrol',
    addGroup: 'Add Patrol',
    removeGroup: 'Remove Patrol',
    officerDrop: 'Drag an officer here',
    soldierDrop: 'Drag soldiers here',
  };

  let stats: GuardStat[] = [];
  let modifiers: GuardModifier[] = [];
  let editing: Record<string, boolean> = {};
  let collapsed: Record<string, boolean> = {};

  // Sync manager
  let syncManager: SyncManager;

  onMount(() => {
    stats = getStats() as GuardStat[];
    modifiers = getModifiers();

    // Setup real-time synchronization
    syncManager = SyncManager.getInstance();

    // Listen for stats and modifiers updates (for UI updates)
    syncManager.subscribe('stats', handleStatsSync);
    syncManager.subscribe('modifiers', handleModifiersSync);
    syncManager.subscribe('groups', handleGroupsSync);
  });

  onDestroy(() => {
    if (syncManager) {
      syncManager.unsubscribe('stats', handleStatsSync);
      syncManager.unsubscribe('modifiers', handleModifiersSync);
      syncManager.unsubscribe('groups', handleGroupsSync);
    }
  });

  // Sync event handlers
  function handleStatsSync(event: SyncEvent) {
    if (event.type === 'stats' && event.data?.stats) {
      stats = event.data.stats;
    }
  }

  function handleModifiersSync(event: SyncEvent) {
    if (event.type === 'modifiers') {
      modifiers = event.data || getModifiers();
    }
  }

  function handleGroupsSync(event: SyncEvent) {
    if (event.type === 'groups' && event.data) {
      groups = event.data;
    }
  }

  async function persist() {
    // Only allow saving if user is GM
    if (game.user?.isGM) {
      console.log("💾 Groups: Persisting changes as GM");
      await saveGroups(groups);

      // Broadcast groups changes to other players
      if (syncManager) {
        syncManager.broadcast({
          type: 'groups',
          action: 'update',
          data: groups,
          timestamp: Date.now(),
          user: game.user?.name || 'Unknown'
        });
      }
    } else {
      console.log("🚫 Groups: Skipping persist - not GM");
    }
  }

  function addGroup() {
    groups = [
      ...groups,
      {
        id: crypto.randomUUID(),
        name: '',
        officer: null,
        soldiers: [],
        mods: {},
        skills: [],
        deployed: false,
        active: false,
      },
    ];
    persist();
  }

  function removeGroup(index: number) {
    groups.splice(index, 1);
    groups = [...groups];
    persist();
  }

  function toggleEditing(groupId: string) {
    editing = { ...editing, [groupId]: !editing[groupId] };
  }

  function toggleCollapsed(group: Group) {
    collapsed = { ...collapsed, [group.id]: !collapsed[group.id] };
  }

  function onDragMember(event: DragEvent, member: GroupMember) {
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', JSON.stringify(member));
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  function onDropOfficer(event: DragEvent, group: Group) {
    event.preventDefault();
    const data = event.dataTransfer?.getData('text/plain');
    if (!data) return;

    try {
      const droppedData = JSON.parse(data);

      // Check if it's an actor from the sidebar
      if (droppedData.type === 'Actor') {
        const actor = game.actors?.get(droppedData.uuid.split('.')[1]);
        if (actor) {
          group.officer = { id: actor.id || '', name: actor.name || '', img: actor.img || '' };
          groups = [...groups];
          persist();
        }
        return;
      }

      // Otherwise treat as group member
      const member = droppedData as GroupMember;

      // Remove from all other positions first
      groups.forEach(g => {
        if (g.officer && g.officer.id === member.id) {
          g.officer = null;
        }
        g.soldiers = g.soldiers.filter(s => s.id !== member.id);
      });

      // Set as officer
      group.officer = member;
      groups = [...groups];
      persist();
    } catch (error) {
      console.error('Failed to parse dropped data:', error);
    }
  }

  function onDropSoldier(event: DragEvent, group: Group) {
    event.preventDefault();
    const data = event.dataTransfer?.getData('text/plain');
    if (!data) return;

    try {
      const droppedData = JSON.parse(data);

      // Check if it's an actor from the sidebar
      if (droppedData.type === 'Actor') {
        const actor = game.actors?.get(droppedData.uuid.split('.')[1]);
        if (actor) {
          // Remove from all other positions first
          groups.forEach(g => {
            if (g.officer && g.officer.id === (actor.id || '')) {
              g.officer = null;
            }
            g.soldiers = g.soldiers.filter(s => s.id !== (actor.id || ''));
          });

          // Add as soldier
          group.soldiers = [
            ...group.soldiers,
            { id: actor.id || '', name: actor.name || '', img: actor.img || '' },
          ];
          groups = [...groups];
          persist();
        }
        return;
      }

      // Otherwise treat as group member
      const member = droppedData as GroupMember;

      // Remove from all other positions first
      groups.forEach(g => {
        if (g.officer && g.officer.id === member.id) {
          g.officer = null;
        }
        g.soldiers = g.soldiers.filter(s => s.id !== member.id);
      });

      // Add as soldier if not already there
      if (!group.soldiers.some(s => s.id === member.id)) {
        group.soldiers = [...group.soldiers, member];
        groups = [...groups];
        persist();
      }
    } catch (error) {
      console.error('Failed to parse dropped data:', error);
    }
  }

  function removeOfficer(group: Group) {
    group.officer = null;
    groups = [...groups];
    persist();
  }

  function removeSoldier(group: Group, member: GroupMember) {
    group.soldiers = group.soldiers.filter(s => s.id !== member.id);
    groups = [...groups];
    persist();
  }

  // Handle external drops from actor directory
  function onDrop(event: DragEvent) {
    const data = event.dataTransfer?.getData('text/plain');
    if (!data) return;

    try {
      const droppedData = JSON.parse(data);
      if (droppedData.type === 'Actor') {
        const actor = game.actors?.get(droppedData.uuid.split('.')[1]);
        if (!actor) return;

        // Create a new group for this actor
        groups = [
          ...groups,
          {
            id: crypto.randomUUID(),
            name: actor.name || '',
            officer: { id: actor.id || '', name: actor.name || '', img: actor.img || '' },
            soldiers: [],
            mods: {},
            skills: [],
            deployed: false,
            active: false,
          },
        ];
        persist();
      }
    } catch (error) {
      console.error('Failed to parse dropped data:', error);
    }
  }

  function getTotalStatValue(stat: GuardStat, group: Group): number {
    const groupMod = group.mods[stat.key] || 0;
    const modifierBonus = modifiers.reduce((acc, m) => acc + (m.mods[stat.key] || 0), 0);
    return stat.value + groupMod + modifierBonus;
  }

  function addSkill(group: Group) {
    const skill: GroupSkill = { name: '', description: '', img: 'icons/svg/book.svg' };
    group.skills = [...group.skills, skill];
    groups = [...groups];
    persist();
  }

  function removeSkill(group: Group, index: number) {
    group.skills.splice(index, 1);
    group.skills = [...group.skills];
    groups = [...groups];
    persist();
  }

  function chooseSkillImage(skill: GroupSkill) {
    if (typeof FilePicker !== 'undefined') {
      // @ts-ignore - FilePicker is provided by Foundry at runtime
      new FilePicker({
        type: 'image',
        current: skill.img,
        callback: (path: string) => {
          skill.img = path;
          persist();
        },
      }).render(true);
    }
  }

  function showSkillInChat(skill: GroupSkill, group: Group) {
    const content = `
      <div style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem; border: 2px solid #d4af37; border-radius: 8px; background: rgba(0,0,0,0.1);">
        <img src="${skill.img || 'icons/svg/book.svg'}" alt="${skill.name}" style="width: 64px; height: 64px; object-fit: cover; border-radius: 8px; border: 2px solid #d4af37;" />
        <div style="flex: 1;">
          <h3 style="margin: 0 0 0.5rem 0; color: #d4af37; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${skill.name}</h3>
          <p style="margin: 0; color: #f4f1e8; font-style: italic;">${skill.description}</p>
          <p style="margin: 0.5rem 0 0 0; color: #999; font-size: 0.9em;">- ${group.name}</p>
        </div>
      </div>
    `;

    // Send message to chat
    ChatMessage.create({
      speaker: { alias: `${group.name} - Skills` },
      content: content,
      whisper: null // Public message
    });
  }
</script>

<style>
  .groups {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .group {
    background: linear-gradient(135deg, rgba(11, 10, 19, 0.9) 0%, rgba(20, 30, 50, 0.85) 50%, rgba(11, 10, 19, 0.9) 100%);
    border: 2px solid #d4af37;
    border-radius: 12px;
    padding: 1rem;
    position: relative;
    backdrop-filter: blur(8px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    transition: all 0.3s ease;
    overflow: hidden;
  }

  .group:hover {
    border-color: #f4d03f;
    box-shadow: 0 12px 48px rgba(212, 175, 55, 0.2);
  }

  .group.has-officer::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%);
    z-index: 1;
  }

  .group.collapsed .group-content {
    display: none;
  }

  .officer-image {
    position: absolute;
    top: -5px;
    right: 15px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 3px solid #d4af37;
    object-fit: cover;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
    transition: all 0.3s ease;
  }

  .officer-image:hover {
    transform: scale(1.1);
    border-color: #f4d03f;
  }

  .group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    min-height: 50px;
    position: relative;
  }

  .group-name {
    flex: 1;
    background: transparent;
    border: none;
    color: #f4f1e8;
    font-size: 1.2rem;
    font-weight: bold;
    font-family: "Cinzel", serif;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
    padding: 0.5rem 0;
  }

  .group-name:focus {
    outline: none;
    border-bottom: 2px solid #d4af37;
  }

  .group-name::placeholder {
    color: rgba(244, 241, 232, 0.5);
  }

  .header-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .header-button {
    background: rgba(212, 175, 55, 0.2);
    border: 1px solid rgba(212, 175, 55, 0.5);
    border-radius: 6px;
    color: #f4f1e8;
    padding: 0.4rem 0.8rem;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.3s ease;
    font-family: "Cinzel", serif;
    font-weight: 500;
  }

  .header-button:hover {
    background: rgba(212, 175, 55, 0.4);
    border-color: rgba(212, 175, 55, 0.8);
    transform: translateY(-1px);
  }

  .header-button:active {
    transform: translateY(0);
  }

  .group-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .officer-info-top {
    background: rgba(212, 175, 55, 0.1);
    border: 1px solid rgba(212, 175, 55, 0.3);
    border-radius: 8px;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .officer-info-top span {
    color: #f4f1e8;
    font-size: 0.95rem;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  }

  .stats-and-edit-container {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .group-stat-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    flex: 1;
  }

  .group-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    min-width: 70px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(212, 175, 55, 0.3);
    border-radius: 8px;
    padding: 0.5rem;
    transition: all 0.3s ease;
  }

  .group-stat:hover {
    background: rgba(212, 175, 55, 0.1);
    border-color: rgba(212, 175, 55, 0.5);
  }

  .group-stat img {
    width: 32px;
    height: 32px;
    object-fit: cover;
    border-radius: 4px;
  }

  .group-stat-name {
    font-size: 0.75rem;
    color: #d4af37;
    font-weight: bold;
    text-align: center;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  }

  .group-stat-value {
    font-size: 0.9rem;
    color: #f4f1e8;
    font-weight: bold;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  }

  .group-stat input {
    width: 40px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(212, 175, 55, 0.5);
    border-radius: 4px;
    color: #f4f1e8;
    text-align: center;
    font-size: 0.85rem;
    padding: 0.25rem;
  }

  .group-stat input:focus {
    outline: none;
    border-color: #d4af37;
    box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.3);
  }

  .deployment-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 120px;
  }

  .deployment-button {
    background: linear-gradient(135deg, rgba(212, 175, 55, 0.8) 0%, rgba(244, 208, 63, 0.9) 100%);
    border: 1px solid #d4af37;
    border-radius: 8px;
    color: #1a0f08;
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    font-family: "Cinzel", serif;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .deployment-button:hover {
    background: linear-gradient(135deg, rgba(244, 208, 63, 0.9) 0%, rgba(212, 175, 55, 0.8) 100%);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(212, 175, 55, 0.4);
  }

  .deployment-button:active {
    transform: translateY(0);
  }

  .deployment-button.deployed {
    background: linear-gradient(135deg, rgba(22, 163, 74, 0.8) 0%, rgba(34, 197, 94, 0.9) 100%);
    border-color: #16a34a;
    color: #ffffff;
  }

  .deployment-button.deployed:hover {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(22, 163, 74, 0.8) 100%);
  }

  .members-grid {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .officer-section,
  .soldiers-section {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(212, 175, 55, 0.3);
    border-radius: 8px;
    padding: 1rem;
  }

  .officer-section h4,
  .soldiers-section h4 {
    margin: 0 0 0.75rem 0;
    color: #d4af37;
    font-size: 1rem;
    font-weight: bold;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
    text-align: center;
  }

  .officer-drop-zone,
  .soldiers-drop-zone {
    min-height: 100px;
    border: 2px dashed rgba(212, 175, 55, 0.4);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    transition: all 0.3s ease;
  }

  .officer-drop-zone:hover,
  .soldiers-drop-zone:hover {
    border-color: rgba(212, 175, 55, 0.7);
    background: rgba(212, 175, 55, 0.05);
  }

  .officer-drop-zone em,
  .soldiers-drop-zone em {
    color: rgba(244, 241, 232, 0.6);
    font-style: italic;
    text-align: center;
    font-size: 0.9rem;
  }

  .member {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: rgba(212, 175, 55, 0.1);
    border: 1px solid rgba(212, 175, 55, 0.3);
    border-radius: 8px;
    cursor: move;
    transition: all 0.3s ease;
    position: relative;
    background-size: cover;
    background-position: center;
    background-blend-mode: overlay;
  }

  .member:hover {
    background-color: rgba(212, 175, 55, 0.2);
    border-color: rgba(212, 175, 55, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .member span {
    color: #f4f1e8;
    font-weight: bold;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
    flex: 1;
  }

  .delete-button {
    background: rgba(239, 68, 68, 0.8);
    border: 1px solid #ef4444;
    border-radius: 50%;
    color: white;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: bold;
    transition: all 0.3s ease;
  }

  .delete-button:hover {
    background: rgba(239, 68, 68, 1);
    transform: scale(1.1);
  }

  .skills {
    padding-top: 0.5rem;
  }

  .skills strong {
    color: #d4af37;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  }

  .skill {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: rgba(212, 175, 55, 0.05);
    border: 1px solid rgba(212, 175, 55, 0.2);
    border-radius: 8px;
    margin-bottom: 0.5rem;
    transition: all 0.3s ease;
  }

  .skill:hover {
    background: rgba(212, 175, 55, 0.1);
    border-color: rgba(212, 175, 55, 0.4);
  }

  .skill-image-button {
    background: none;
    border: 2px solid rgba(212, 175, 55, 0.5);
    border-radius: 8px;
    padding: 0;
    cursor: pointer;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
  }

  .skill-image-button:hover {
    border-color: #d4af37;
    transform: scale(1.05);
  }

  .skill-image-button img {
    width: 44px;
    height: 44px;
    object-fit: cover;
    border-radius: 6px;
  }

  .skill-display {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: all 0.3s ease;
  }

  .skill-display:hover {
    background: rgba(212, 175, 55, 0.1);
  }

  .skill-image {
    flex-shrink: 0;
  }

  .skill-image img {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 8px;
    border: 2px solid rgba(212, 175, 55, 0.5);
  }

  .skill-info {
    flex: 1;
  }

  .skill-info strong {
    display: block;
    color: #d4af37;
    font-size: 1rem;
    margin-bottom: 0.25rem;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  }

  .skill-info p {
    margin: 0;
    color: #f4f1e8;
    font-size: 0.9rem;
    line-height: 1.4;
    opacity: 0.9;
  }

  .skill input,
  .skill textarea {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(212, 175, 55, 0.5);
    border-radius: 6px;
    color: #f4f1e8;
    padding: 0.5rem;
    font-family: inherit;
  }

  .skill input:focus,
  .skill textarea:focus {
    outline: none;
    border-color: #d4af37;
    box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.3);
  }

  .skill input::placeholder,
  .skill textarea::placeholder {
    color: rgba(244, 241, 232, 0.5);
  }

  .skill textarea {
    resize: vertical;
    min-height: 60px;
  }

  .add-group-container {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
  }

  .add-group-button {
    background: linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%);
    border: 3px solid #b8941f;
    border-radius: 20px;
    color: #1a0f08;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1.5rem 2rem;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    font-family: "Cinzel", serif;
    box-shadow: 0 8px 30px rgba(212, 175, 55, 0.3);
    position: relative;
    overflow: hidden;
    min-width: 200px;
    min-height: 120px;
  }

  .add-group-button::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    transform: rotate(45deg);
    transition: all 0.6s ease;
    opacity: 0;
  }

  .add-group-button:hover::before {
    animation: shine 1.2s ease-in-out;
  }

  .add-group-button:hover {
    transform: translateY(-5px) scale(1.05);
    box-shadow: 0 15px 40px rgba(212, 175, 55, 0.5);
    border-color: #f4d03f;
  }

  .add-group-button:active {
    transform: translateY(-2px) scale(1.02);
    transition: all 0.1s ease;
  }

  .add-group-icon {
    font-size: 2.5rem;
    font-weight: bold;
    line-height: 1;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  }

  .add-group-text {
    font-size: 1.1rem;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  }

  @keyframes shine {
    0% {
      opacity: 0;
      transform: translateX(-100%) translateY(-100%) rotate(45deg);
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translateX(100%) translateY(100%) rotate(45deg);
    }
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .members-grid {
      grid-template-columns: 1fr;
    }

    .stats-and-edit-container {
      flex-direction: column;
    }

    .deployment-controls {
      min-width: auto;
      width: 100%;
    }

    .add-group-button {
      min-width: 180px;
      min-height: 100px;
      padding: 1rem 1.5rem;
    }

    .add-group-icon {
      font-size: 2rem;
    }

    .add-group-text {
      font-size: 1rem;
    }
  }
</style>

<div class="groups" on:drop={onDrop} on:dragover={onDragOver}>
  {#each groups as group, i}
    <div class="group {group.officer ? 'has-officer' : ''} {collapsed[group.id] ? 'collapsed' : ''}">
      <!-- Officer Image (visible element, not background) -->
      {#if group.officer}
        <img
          src={group.officer.img}
          alt={group.officer.name}
          class="officer-image"
        />
      {/if}

      <!-- Group Header -->
      <div class="group-header">
        <input
          class="group-name"
          placeholder="Group Name"
          bind:value={group.name}
          on:change={persist}
        />
        <div class="header-buttons">
          <button class="header-button" on:click={() => toggleEditing(group.id)}>
            {editing[group.id] ? 'Done' : 'Edit'}
          </button>
          <button class="header-button" on:click={() => removeGroup(i)}>
            Remove {labels.groupSingular}
          </button>
          <button class="header-button" on:click={() => toggleCollapsed(group)}>
            {collapsed[group.id] ? '▼' : '▲'}
          </button>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="group-content">
        <!-- Officer Info (moved above soldiers) -->
        {#if group.officer}
          <div class="officer-info-top">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span><strong>Officer:</strong> {group.officer.name}</span>
            </div>
          </div>
        {/if}

        <!-- Group Stats and Edit Button -->
        <div class="stats-and-edit-container">
          <div class="group-stat-container">
            {#each stats as stat}
              <div class="group-stat">
                <img src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} />
                <div class="group-stat-name">{stat.name}</div>
                {#if editing[group.id]}
                  <input
                    type="number"
                    bind:value={group.mods[stat.key]}
                    on:change={persist}
                    placeholder="0"
                  />
                {:else}
                  <div class="group-stat-value">
                    {getTotalStatValue(stat, group)}
                  </div>
                {/if}
              </div>
            {/each}
          </div>

          <!-- Deployment Controls -->
          <div class="deployment-controls">
            <button
              class="deployment-button {group.deployed ? 'deployed' : ''}"
              on:click={() => { group.deployed = !group.deployed; persist(); }}
            >
              {group.deployed ? 'Deployed' : 'Deploy'}
            </button>
            <button
              class="deployment-button {group.active ? 'deployed' : ''}"
              on:click={() => { group.active = !group.active; persist(); }}
            >
              {group.active ? 'Active' : 'Inactive'}
            </button>
          </div>
        </div>

        <!-- Members Grid -->
        <div class="members-grid">
          <!-- Officer Section -->
          <div class="officer-section">
            <h4>Officer</h4>
            <div
              class="officer-drop-zone"
              on:drop={(e) => onDropOfficer(e, group)}
              on:dragover={onDragOver}
            >
              {#if group.officer}
                <div
                  class="member"
                  role="button"
                  tabindex="0"
                  draggable="true"
                  on:dragstart={(e) => onDragMember(e, group.officer)}
                  style={`background-image: url('${group.officer.img}');`}
                >
                  <span>{group.officer.name}</span>
                  {#if editing[group.id]}
                    <button class="delete-button" on:click={() => removeOfficer(group)}>X</button>
                  {/if}
                </div>
              {:else}
                <em>{labels.officerDrop}</em>
              {/if}
            </div>
          </div>

          <!-- Soldiers Section -->
          <div class="soldiers-section">
            <h4>Members</h4>
            <div
              class="soldiers-drop-zone"
              on:drop={(e) => onDropSoldier(e, group)}
              on:dragover={onDragOver}
            >
              {#if group.soldiers.length > 0}
                {#each group.soldiers as soldier}
                  <div
                    class="member"
                    role="button"
                    tabindex="0"
                    draggable="true"
                    on:dragstart={(e) => onDragMember(e, soldier)}
                    style={`background-image: url('${soldier.img}');`}
                  >
                    <span>{soldier.name}</span>
                    {#if editing[group.id]}
                      <button class="delete-button" on:click={() => removeSoldier(group, soldier)}>X</button>
                    {/if}
                  </div>
                {/each}
              {:else}
                <em>{labels.soldierDrop}</em>
              {/if}
            </div>
          </div>
        </div>

        <!-- Skills -->
        {#if group.skills.length > 0 || editing[group.id]}
          <div class="skills">
            <div style="display: flex; justify-content: space-between; align-items: center; height: 28px; margin-bottom: 0.5rem;">
              <strong style="margin: 0; line-height: 28px;">Skills</strong>
              {#if editing[group.id]}
                <button on:click={() => addSkill(group)}>Add Skill</button>
              {/if}
            </div>
            {#each group.skills as sk, j}
              <div class="skill">
                {#if editing[group.id]}
                  <button type="button" class="skill-image-button" on:click={() => chooseSkillImage(sk)}>
                    <img src={sk.img} alt="" />
                  </button>
                  <div style="display: flex; flex-direction: column; gap: 0.25rem; flex: 1;">
                    <input
                      placeholder="Name"
                      bind:value={sk.name}
                      on:change={persist}
                      on:keydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); persist(); } }}
                    />
                    <textarea
                      placeholder="Description"
                      bind:value={sk.description}
                      on:change={persist}
                      on:keydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); persist(); } }}
                    ></textarea>
                  </div>
                  <button class="delete-button" on:click={() => removeSkill(group, j)}>X</button>
                {:else}
                  <div class="skill-display" role="button" tabindex="0"
                       on:click={() => showSkillInChat(sk, group)}
                       on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showSkillInChat(sk, group); } }}>
                    <div class="skill-image">
                      <img src={sk.img} alt="" />
                    </div>
                    <div class="skill-info">
                      <strong>{sk.name}</strong>
                      <p>{sk.description}</p>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/each}

  <!-- Big GM-only Add Group Button -->
  {#if game.user?.isGM}
    <div class="add-group-container">
      <button class="add-group-button" on:click={addGroup}>
        <div class="add-group-icon">+</div>
        <div class="add-group-text">{labels.addGroup}</div>
      </button>
    </div>
  {/if}
</div>
