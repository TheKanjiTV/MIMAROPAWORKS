import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import '@/components/modal.css';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  titleId: string;
  descriptionId?: string;
  className?: string;
  children: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
  focusKey?: string;
};

// The native dialog owns focus containment. Count scroll locks so closing a
// sign-in dialog over job details does not unlock the underlying page.
let openModals = 0;
let previousBodyOverflow = '';

function containTabFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return;
  const controls = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, iframe, [tabindex]',
    ),
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden',
  );
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (!first) {
    event.preventDefault();
    return;
  }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !controls.includes(active as HTMLElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || active === event.currentTarget)) {
    event.preventDefault();
    first.focus();
  }
}

export function Modal({
  isOpen,
  onClose,
  titleId,
  descriptionId,
  className = '',
  children,
  returnFocusRef,
  focusKey,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const explicitTarget = returnFocusRef?.current;
    if (openModals === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openModals += 1;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-modal-close]')?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      openModals = Math.max(0, openModals - 1);
      if (openModals === 0) document.body.style.overflow = previousBodyOverflow;
      const target = explicitTarget?.isConnected ? explicitTarget : trigger;
      if (target?.isConnected && target !== document.body) target.focus({ preventScroll: true });
      else
        ['.header-actions .login-button', '.menu-toggle', '.brand']
          .map((selector) => document.querySelector<HTMLElement>(selector))
          .find((element) => element && element.getClientRects().length > 0)
          ?.focus({ preventScroll: true });
    };
  }, [isOpen, returnFocusRef]);
  useEffect(() => {
    if (isOpen && focusKey)
      dialogRef.current
        ?.querySelector<HTMLElement>('[data-modal-close]')
        ?.focus({ preventScroll: true });
  }, [focusKey, isOpen]);
  return (
    <dialog
      ref={dialogRef}
      className={`app-modal ${className}`}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={containTabFocus}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      {isOpen ? children : null}
    </dialog>
  );
}
