import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, loading = false }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={loading ? () => undefined : onCancel} title={title}>
      <p className="text-sm text-tinta-suave">{message}</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secundario" onClick={onCancel} disabled={loading}>
          Cancelar
        </button>
        <button type="button" className="btn-peligro" onClick={onConfirm} disabled={loading}>
          {loading ? 'Eliminando…' : 'Eliminar'}
        </button>
      </div>
    </Modal>
  );
}
