import { useRef, useState } from 'react';
import type { ConversationKind } from '@truelinks/shared';
import { archiveConversation, deleteConversation, unarchiveConversation } from '../utils/api.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { useNotice } from './Notice.tsx';

export interface ArchiveActionsProps {
  conversationId: string;
  kind: ConversationKind;
  archivedAt: string | null;
  // Set when the API won't allow archiving (the unit's current or next lease); Archive is then not offered
  archiveBlockedReason: string | null;
  // Names the item in the modal and in each button's accessible name, so a list's buttons can be told apart
  itemName: string;
  disabled?: boolean;
  onChanged: () => void | Promise<void>;
  onDeleted: () => void;
}

type Pending = 'archive' | 'unarchive' | 'delete';

// The button that opened the dialog is replaced or removed after an action, so focus goes to the
// page or thread heading instead of being lost
function focusPageTitle() {
  document.querySelector<HTMLElement>('.page-title, .thread-heading')?.focus();
}

// Archive hides a lease review or issue report from the unit's lists; delete is permanent and only
// offered once archived. Each asks first in a modal, and confirms with a short notice when done.
export function ArchiveActions({
  conversationId,
  kind,
  archivedAt,
  archiveBlockedReason,
  itemName,
  disabled,
  onChanged,
  onDeleted,
}: ArchiveActionsProps) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notify = useNotice();
  const actionDone = useRef(false);

  const noun = kind === 'lease' ? 'lease review' : 'issue report';
  const Noun = kind === 'lease' ? 'Lease review' : 'Issue report';
  const files = kind === 'lease' ? 'the uploaded lease file' : 'its photos and work order';
  const copy: Record<Pending, { title: string; message: string; confirmLabel: string; done: string }> = {
    archive: {
      title: `Archive this ${noun}?`,
      message: 'It moves under "Show archived" and becomes read-only until you unarchive it.',
      confirmLabel: 'Archive',
      done: `${Noun} archived`,
    },
    unarchive: {
      title: `Unarchive this ${noun}?`,
      message: 'It returns to the list and can be changed again.',
      confirmLabel: 'Unarchive',
      done: `${Noun} unarchived`,
    },
    delete: {
      title: `Delete this ${noun} permanently?`,
      message: `This deletes it with its messages and ${files}. It can't be undone.`,
      confirmLabel: 'Delete permanently',
      done: `${Noun} deleted`,
    },
  };

  function open(action: Pending) {
    setError(null);
    setPending(action);
  }

  async function confirm() {
    if (!pending) return;
    const action = pending;
    setWorking(true);
    setError(null);
    try {
      if (action === 'delete') {
        await deleteConversation(conversationId);
      } else {
        await (action === 'archive' ? archiveConversation(conversationId) : unarchiveConversation(conversationId));
      }
      actionDone.current = true;
      setPending(null);
      notify(`${copy[action].done}: ${itemName}`);
      if (action === 'delete') {
        onDeleted();
      } else {
        await onChanged();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  if (!archivedAt && archiveBlockedReason) {
    return null;
  }

  return (
    <div className="archive-actions">
      {archivedAt ? (
        <>
          <button type="button" className="btn btn-subtle btn-sm" disabled={disabled} aria-label={`Unarchive ${itemName}`} onClick={() => open('unarchive')}>
            Unarchive
          </button>
          <button type="button" className="btn btn-subtle btn-sm btn-subtle-danger" disabled={disabled} aria-label={`Delete ${itemName}`} onClick={() => open('delete')}>
            Delete
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-subtle btn-sm" disabled={disabled} aria-label={`Archive ${itemName}`} onClick={() => open('archive')}>
          Archive
        </button>
      )}
      <ConfirmDialog
        open={pending !== null}
        title={copy[pending ?? 'archive'].title}
        subject={itemName}
        message={copy[pending ?? 'archive'].message}
        confirmLabel={copy[pending ?? 'archive'].confirmLabel}
        danger={pending === 'delete'}
        busy={working}
        error={error}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
        onClosed={() => {
          if (actionDone.current) {
            actionDone.current = false;
            focusPageTitle();
          }
        }}
      />
    </div>
  );
}
