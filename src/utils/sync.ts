// Real-time synchronization system for Crow Nest module
// This handles broadcasting changes to all connected players

import { MODULE_ID } from "@/constants";
import { BehaviorSubject, Subject, combineLatest, merge, EMPTY, Observable } from 'rxjs';
import { distinctUntilChanged, debounceTime, takeUntil, filter, map, tap, shareReplay } from 'rxjs/operators';

export interface SyncEvent {
  type:
    | "stats"
    | "modifiers"
    | "resources"
    | "tokens"
    | "patrols"
    | "admins"
    | "reputation"
    | "groups"
    | "patrol-sheet"
    | "presets"
    | "unifiedPresets"
    | "patrol-effects";
  action: "update" | "create" | "delete" | "command" | "show";
  data: any;
  timestamp: number;
  user: string;
  isCommand?: boolean; // Indicates this is a command for the GM to execute
}

export class SyncManager {
  private static instance: SyncManager;
  private listeners: Map<string, ((event: SyncEvent) => void)[]> = new Map();
  private eventHandlers: Map<string, (event: SyncEvent) => void> = new Map();

  // RxJS subjects for reactive state management
  private groupsSubject = new BehaviorSubject<any>(null);
  private presetsSubject = new BehaviorSubject<any>(null);
  private patrolEffectsSubject = new BehaviorSubject<any>(null);
  private statsSubject = new BehaviorSubject<any>(null);
  private resourcesSubject = new BehaviorSubject<any>(null);
  private reputationSubject = new BehaviorSubject<any>(null);
  private adminDataSubject = new BehaviorSubject<any>(null);
  private tokensSubject = new BehaviorSubject<any>(null);
  private modifiersSubject = new BehaviorSubject<any>(null);
  
  // Destroy subjects for component cleanup
  private destroySubjects = new Map<string, Subject<void>>();

  // Individual streams for specific data types - declared before use
  public groups$: Observable<any>;
  public presets$: Observable<any>;
  public patrolEffects$: Observable<any>;
  public stats$: Observable<any>;
  public resources$: Observable<any>;
  public reputation$: Observable<any>;
  public adminData$: Observable<any>;
  public tokens$: Observable<any>;
  public modifiers$: Observable<any>;

  // Combined state stream with intelligent debouncing
  public readonly state$ = combineLatest([
    this.groupsSubject.pipe(distinctUntilChanged()),
    this.presetsSubject.pipe(distinctUntilChanged()),
    this.patrolEffectsSubject.pipe(distinctUntilChanged()),
    this.statsSubject.pipe(distinctUntilChanged()),
    this.resourcesSubject.pipe(distinctUntilChanged()),
    this.reputationSubject.pipe(distinctUntilChanged()),
    this.adminDataSubject.pipe(distinctUntilChanged()),
    this.tokensSubject.pipe(distinctUntilChanged()),
    this.modifiersSubject.pipe(distinctUntilChanged())
  ]).pipe(
    debounceTime(50), // Prevent excessive updates
    filter(([groups, presets, effects, stats, resources, reputation, admin, tokens, modifiers]) => 
      groups || presets || effects || stats || resources || reputation || admin || tokens || modifiers),
    tap(([groups, presets, effects, stats, resources, reputation, admin, tokens, modifiers]) => {
      console.log('SyncManager - State updated:', { 
        groups: !!groups, presets: !!presets, effects: !!effects, 
        stats: !!stats, resources: !!resources, reputation: !!reputation, admin: !!admin,
        tokens: !!tokens, modifiers: !!modifiers 
      });
    }),
    shareReplay(1)
  );

  // Helper function to create standardized streams
  private createDataStream(subject: BehaviorSubject<any>) {
    return subject.pipe(
      filter(data => data !== null),
      distinctUntilChanged(),
      debounceTime(30),
      shareReplay(1)
    );
  }

  constructor() {
    // Initialize streams after subjects are created
    this.groups$ = this.createDataStream(this.groupsSubject);
    this.presets$ = this.createDataStream(this.presetsSubject);
    this.patrolEffects$ = this.createDataStream(this.patrolEffectsSubject);
    this.stats$ = this.createDataStream(this.statsSubject);
    this.resources$ = this.createDataStream(this.resourcesSubject);
    this.reputation$ = this.createDataStream(this.reputationSubject);
    this.adminData$ = this.createDataStream(this.adminDataSubject);
    this.tokens$ = this.createDataStream(this.tokensSubject);
    this.modifiers$ = this.createDataStream(this.modifiersSubject);
  }

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  // NEW: Subscribe to specific data type with auto-cleanup
  subscribeToDataType<T>(
    dataType: 'groups' | 'presets' | 'patrolEffects' | 'stats' | 'resources' | 'reputation' | 'adminData' | 'tokens' | 'modifiers',
    componentId: string,
    callback: (data: T) => void
  ) {
    const destroy$ = this.getOrCreateDestroySubject(componentId);
    
    const streamMap = {
      groups: this.groups$,
      presets: this.presets$,
      patrolEffects: this.patrolEffects$,
      stats: this.stats$,
      resources: this.resources$,
      reputation: this.reputation$,
      adminData: this.adminData$,
      tokens: this.tokens$,
      modifiers: this.modifiers$
    };

    const stream$ = streamMap[dataType];

    if (!stream$) {
      console.error(`SyncManager: Stream for dataType '${dataType}' is not initialized`);
      return EMPTY.subscribe();
    }

    return stream$.pipe(
      takeUntil(destroy$)
    ).subscribe(callback);
  }

  // NEW: Subscribe to combined state with auto-cleanup
  subscribeToSync(componentId: string, callback: (state: any) => void) {
    const destroy$ = this.getOrCreateDestroySubject(componentId);
    
    return this.state$.pipe(
      takeUntil(destroy$)
    ).subscribe(([groups, presets, effects, stats, resources, reputation, admin, tokens, modifiers]) => {
      callback({ groups, presets, effects, stats, resources, reputation, admin, tokens, modifiers });
    });
  }

  // NEW: Helper method for component cleanup
  private getOrCreateDestroySubject(componentId: string): Subject<void> {
    if (!this.destroySubjects.has(componentId)) {
      this.destroySubjects.set(componentId, new Subject<void>());
    }
    return this.destroySubjects.get(componentId)!;
  }

  // NEW: Component cleanup
  cleanupComponent(componentId: string) {
    const destroy$ = this.destroySubjects.get(componentId);
    if (destroy$) {
      destroy$.next();
      destroy$.complete();
      this.destroySubjects.delete(componentId);
    }
  }

  // Register a handler for specific event types
  registerEventHandler(type: string, handler: (event: SyncEvent) => void) {
    this.eventHandlers.set(type, handler);
  }

  // Clear a specific event handler
  clearEventHandler(type: string) {
    this.eventHandlers.delete(type);
  }

  // Clear all event handlers
  clearAllEventHandlers() {
    this.eventHandlers.clear();
  }

  // Register a listener for sync events
  subscribe(type: string, callback: (event: SyncEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  // Remove a listener
  unsubscribe(type: string, callback: (event: SyncEvent) => void) {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Broadcast a change to all connected players
  async broadcast(event: SyncEvent) {
    // NEW: Update RxJS subjects based on event type
    this.updateSubjectsFromEvent(event);

    // For groups/patrols data, save directly to the main setting
    // This will trigger updateSetting hook on all clients
    if (event.type === "groups" || event.type === "patrols") {
      try {
        await (game as any).settings.set(MODULE_ID, "patrols", event.data);
      } catch (error) {
        console.error("[SyncManager] Error saving groups/patrols data:", error);
      }
    } else {
      // For other types, use the sync setting
      await this.saveSyncEvent(event);
    }

    // Don't trigger local listeners here to avoid double processing
    // The updateSetting hook will handle the sync
  }

  // NEW: Update RxJS subjects when data changes
  private updateSubjectsFromEvent(event: SyncEvent) {
    console.log('SyncManager - Updating subjects from event:', event.type, event.action);
    
    switch (event.type) {
      case 'groups':
      case 'patrols':
        this.groupsSubject.next(event.data);
        break;
      case 'presets':
      case 'unifiedPresets':
        this.presetsSubject.next(event.data);
        break;
      case 'patrol-effects':
        this.patrolEffectsSubject.next(event.data);
        break;
      case 'stats':
        this.statsSubject.next(event.data);
        break;
      case 'resources':
        this.resourcesSubject.next(event.data);
        break;
      case 'reputation':
        this.reputationSubject.next(event.data);
        break;
      case 'admins':
        this.adminDataSubject.next(event.data);
        break;
      case 'tokens':
        this.tokensSubject.next(event.data);
        break;
      case 'modifiers':
        this.modifiersSubject.next(event.data);
        break;
    }
  }

  // Save sync event for any type that's not groups/patrols
  private async saveSyncEvent(event: SyncEvent) {
    try {
      // Create a unique event with timestamp to ensure it always triggers
      const uniqueEvent = {
        ...event,
        syncId: Date.now() + Math.random(), // Ensure uniqueness
        timestamp: Date.now(),
      };

      await (game as any).settings.set(MODULE_ID, "syncEvent", uniqueEvent);
    } catch (error) {
      console.error("[SyncManager] Error setting sync event:", error);
    }
  }

  // Handle incoming sync events from other players
  handleRemoteEvent(event: SyncEvent) {
    // NEW: Update RxJS subjects for remote events too
    this.updateSubjectsFromEvent(event);
    this.notifyLocalListeners(event);
  }

  private notifyLocalListeners(event: SyncEvent) {
    // Check for registered event handlers first
    const handler = this.eventHandlers.get(event.type);
    if (handler) {
      handler(event);
    }

    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach((callback) => callback(event));
    }

    // Also notify 'all' listeners
    const allCallbacks = this.listeners.get("all");
    if (allCallbacks) {
      allCallbacks.forEach((callback) => callback(event));
    }
  }
}

// Helper function to create sync events
export function createSyncEvent(
  type: SyncEvent["type"],
  action: SyncEvent["action"],
  data: any
): SyncEvent {
  return {
    type,
    action,
    data,
    timestamp: Date.now(),
    user: game.user?.name ?? "unknown",
  };
}

// Initialize settings-based sync listener (to be called from main.ts)
export function initializeSync() {
  // The actual hook registration is done in main.ts where Hooks is available
}

// Cleanup function (no longer needed for settings-based sync)
export function cleanupSync() {
  // Settings-based sync uses Foundry's built-in hooks
  // No manual cleanup required
}
