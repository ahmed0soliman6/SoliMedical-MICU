import { useEffect } from 'react';

/**
 * Custom hook to lock body & document scrolling when a modal or drawer is open.
 * Ensures the background page cannot scroll behind the open modal.
 */
export function useLockBodyScroll(isOpen: boolean = true) {
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalDocOverflow = document.documentElement.style.overflow;
    const originalTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalDocOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);
}
