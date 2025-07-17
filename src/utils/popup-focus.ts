/**
 * Popup Focus Manager
 * Handles focus management between different popup components
 */

class PopupFocusManager {
  private static instance: PopupFocusManager;
  private activePopup: Element | null = null;

  private constructor() {}

  static getInstance(): PopupFocusManager {
    if (!PopupFocusManager.instance) {
      PopupFocusManager.instance = new PopupFocusManager();
    }
    return PopupFocusManager.instance;
  }

  /**
   * Set focus to a popup element
   * @param popupElement The popup element to focus
   */
  setFocus(popupElement: Element) {
    // Remove focus from current active popup
    if (this.activePopup && this.activePopup !== popupElement) {
      this.activePopup.classList.remove("focus");
    }

    // Set focus to new popup
    this.activePopup = popupElement;
    popupElement.classList.add("focus");

    // Solo manejar la clase CSS, no interferir con el focus del teclado
  }

  /**
   * Remove focus from a popup element
   * @param popupElement The popup element to blur
   */
  removeFocus(popupElement: Element) {
    if (this.activePopup === popupElement) {
      this.activePopup = null;
    }
    popupElement.classList.remove("focus");
  }

  /**
   * Check if a popup is currently focused
   * @param popupElement The popup element to check
   */
  isFocused(popupElement: Element): boolean {
    return this.activePopup === popupElement;
  }

  /**
   * Force focus to the current active popup (useful for restoring focus after operations)
   */
  reinforceFocus() {
    if (this.activePopup) {
      this.activePopup.classList.add("focus");
      // Solo manejar la clase CSS, no interferir con el focus del teclado
    }
  }

  /**
   * Get the currently focused popup
   */
  getActivePopup(): Element | null {
    return this.activePopup;
  }
}

export default PopupFocusManager;
