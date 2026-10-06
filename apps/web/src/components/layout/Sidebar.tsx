import { useState } from 'react';
import type { ConversationSummary, Unit } from '@truelinks/shared';
import { startLeaseReview } from '../../utils/startLeaseReview.ts';
import { navigate, toHash, type Route } from '../../utils/router.ts';
import { ThemeToggle } from '../ThemeToggle.tsx';
import { SettingsDialog } from '../settings/SettingsDialog.tsx';
import { GearIcon } from '../icons.tsx';

export interface SidebarProps {
  route: Route;
  // The unit the current screen belongs to, so "Report an issue" can pick it for you
  currentUnitId: string | null;
  units: Unit[];
  reviews: ConversationSummary[];
  onUnitsChanged: () => void;
}

export function Sidebar({ route, currentUnitId, units, reviews, onUnitsChanged }: SidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unassignedCount = reviews.filter((r) => r.kind === 'lease' && !r.unitId).length;

  async function handleNewLease() {
    setStarting(true);
    setError(null);
    try {
      await startLeaseReview();
      setMenuOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }

  function isActive(target: Route): boolean {
    if (target.name === 'unit') {
      return currentUnitId === target.unitId && route.name !== 'report';
    }
    return route.name === target.name;
  }

  return (
    <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
      <div className="sidebar-top">
        <a className="sidebar-brand" href={toHash({ name: 'home' })} onClick={() => setMenuOpen(false)}>
          Lease &amp; Issue Agents
        </a>
        <button
          type="button"
          className="btn btn-subtle btn-sm sidebar-menu-button"
          aria-expanded={menuOpen}
          aria-controls="sidebar-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>
      </div>

      <div className="sidebar-theme">
        <ThemeToggle showLabel />
      </div>

      <nav id="sidebar-nav" className="sidebar-nav" aria-label="Units and actions">
        <div className="sidebar-actions">
          <button type="button" className="btn btn-primary" onClick={handleNewLease} disabled={starting}>
            {starting ? 'Starting…' : 'New lease review'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setMenuOpen(false);
              navigate({ name: 'report', unitId: currentUnitId });
            }}
          >
            Report an issue
          </button>
          {error && (
            <p className="sidebar-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <hr className="sidebar-divider" />

        <h2 className="sidebar-heading">Units</h2>
        <ul className="sidebar-list">
          {units.map((unit) => {
            const target: Route = { name: 'unit', unitId: unit.unitId, tab: 'issues' };
            return (
              <li key={unit.unitId}>
                <a
                  className={`sidebar-link ${isActive(target) ? 'is-active' : ''}`}
                  href={toHash(target)}
                  aria-current={isActive(target) ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="sidebar-unit-id">{unit.unitId}</span>
                  <span className={`sidebar-unit-status status-${unit.status}`}>{unit.status}</span>
                </a>
              </li>
            );
          })}
          {unassignedCount > 0 && (
            <li>
              <a
                className={`sidebar-link ${isActive({ name: 'unassigned' }) ? 'is-active' : ''}`}
                href={toHash({ name: 'unassigned' })}
                onClick={() => setMenuOpen(false)}
              >
                <span>Unassigned leases</span>
                <span className="sidebar-count">{unassignedCount}</span>
              </a>
            </li>
          )}
        </ul>

        <div className="sidebar-footer">
          <button type="button" className="sidebar-settings" onClick={() => setSettingsOpen(true)}>
            <GearIcon /> Settings
          </button>
        </div>
      </nav>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} units={units} onUnitsChanged={onUnitsChanged} />
    </aside>
  );
}
