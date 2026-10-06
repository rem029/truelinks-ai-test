import { useEffect, useRef, useState } from 'react';
import type { Unit } from '@truelinks/shared';
import { RulesPanel } from './RulesPanel.tsx';
import { UnitsPanel } from './UnitsPanel.tsx';
import { CloseIcon } from '../icons.tsx';

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  units: Unit[];
  onUnitsChanged: () => void;
}

type Tab = 'rules' | 'units';

// A native <dialog> opened with showModal(): focus stays inside, Esc closes it, the page behind is inert
export function SettingsDialog({ open, onClose, units, onUnitsChanged }: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>('rules');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} className="settings-dialog" onClose={onClose} aria-labelledby="settings-title">
      <header className="settings-header">
        <h2 id="settings-title" className="settings-title">
          Settings
        </h2>
        <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings">
          <CloseIcon size={18} />
        </button>
      </header>
      <div className="settings-tabs" role="group" aria-label="Settings sections">
        <button type="button" className={`tab ${tab === 'rules' ? 'is-active' : ''}`} aria-pressed={tab === 'rules'} onClick={() => setTab('rules')}>
          Rules
        </button>
        <button type="button" className={`tab ${tab === 'units' ? 'is-active' : ''}`} aria-pressed={tab === 'units'} onClick={() => setTab('units')}>
          Units
        </button>
      </div>
      <div className="settings-body">
        {/* Mounted only while open, so the ruleset is fetched fresh each time */}
        {open && tab === 'rules' && <RulesPanel />}
        {open && tab === 'units' && <UnitsPanel units={units} onUnitsChanged={onUnitsChanged} />}
      </div>
    </dialog>
  );
}
