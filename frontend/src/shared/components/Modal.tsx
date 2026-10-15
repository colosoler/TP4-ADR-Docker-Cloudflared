import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Modal sobre <dialog> nativo: Esc cierra, el foco entra al abrir
 * y vuelve al elemento que lo abrió al cerrar.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocusRef.current?.focus();
    }
  }, [open]);

  // Si se desmonta abierto, devolvemos el foco igual.
  useEffect(() => () => returnFocusRef.current?.focus(), []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Esc: lo controla el padre a través de `open`.
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click en el fondo (fuera de la caja) cierra.
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-borde bg-superficie p-0 text-tinta shadow-xl backdrop:bg-tinta/50"
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 -mt-1 rounded px-2 text-xl leading-none text-tinta-suave hover:text-tinta"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
