// Utility functions for Crow Nest module

/**
 * Generate a UUID compatible with Foundry VTT
 * Uses Foundry's built-in randomID() function for consistency
 */
export function generateUUID(): string {
  // Use Foundry's built-in randomID function if available
  if (typeof foundry !== 'undefined' && foundry.utils && foundry.utils.randomID) {
    return foundry.utils.randomID();
  }
  
  // Fallback to simple random string generation
  return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}