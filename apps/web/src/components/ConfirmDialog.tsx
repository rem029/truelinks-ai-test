import { useEffect, useId, useRef } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  // What the action applies to (a file name, a work order title), shown under the title
  subject: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  // Runs after the dialog has closed and handed focus back, so the caller can move focus elsewhere
  onClosed?: () => void;
}

// A native <dialog> opened with showModal(): focus stays inside, Esc cancels, the page behind is inert.
// Once the action is refused, only Close is offered: trying again would be refused the same way.
export function ConfirmDialog({ open, title, subject, message, confirmLabel, danger, busy, error, onConfirm, onCancel, onClosed }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) {
      dialog.close();
      onClosed?.();
    }
  }, [open, onClosed]);

  return (
    <dialog ref={dialogRef} className="confirm-dialog" onClose={onCancel} aria-labelledby={titleId}>
      <h2 id={titleId} className="confirm-dialog-title">
        {title}
      </h2>
      <p className="confirm-dialog-subject">{subject}</p>
      <p className="confirm-dialog-message">{message}</p>
      {error && (
        <p className="form-error-alert" role="alert">
          {error}
        </p>
      )}
      <div className="confirm-dialog-actions">
        {error ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
            Close
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={onConfirm}
              disabled={busy}
            >
              {confirmLabel}
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
