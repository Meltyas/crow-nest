import { writable } from 'svelte/store';
import type { Admin } from '@/admin/admins';
import { getAdmins, saveAdmins } from '@/admin/admins';

// Create writable store for admins
export const adminsStore = writable<Admin[]>([]);

// Initialize store with data from settings
export function initializeAdminsStore() {
  const admins = getAdmins();
  adminsStore.set(admins);
}

// Persist admins to settings
export async function persistAdmins(admins: Admin[]): Promise<void> {
  await saveAdmins(admins);
}
