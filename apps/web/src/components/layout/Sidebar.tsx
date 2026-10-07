import { useState } from 'react';
import type { ConversationSummary, Unit } from '@truelinks/shared';
import { Link, NavLink, useMatch, useNavigate } from 'react-router';
import { useStartLeaseReview } from '../../hooks/useStartLeaseReview.ts';
import { ThemeToggle } from '../ThemeToggle.tsx';
import { SettingsDialog } from '../settings/SettingsDialog.tsx';
import { GearIcon } from '../icons.tsx';

export interface SidebarProps {
  // The unit the current screen belongs to, so "Report an issue" can pick it for you
  currentUnitId: string | null;
  units: Unit[];
  reviews: ConversationSummary[];
  onUnitsChanged: () => void;
}

export function Sidebar({ currentUnitId, units, reviews, onUnitsChanged }: SidebarProps) {
  const navigate = useNavigate();
  const startLeaseReview = useStartLeaseReview();
  // On the report form the unit is only preselected, so the unit's link isn't highlighted
  const onReportPage = useMatch('/report/*') !== null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unassignedCount = reviews.filter((r) => r.kind === 'lease' && !r.unitId && !r.archivedAt).length;

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

  return (
    <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
      <div className="sidebar-top">
        <Link className="sidebar-brand" to="/" onClick={() => setMenuOpen(false)}>
          Lease &amp; Issue Agents
        </Link>
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
              navigate(currentUnitId ? `/report/${currentUnitId}` : '/report');
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
            // Also highlighted on the unit's threads, which live under /c/
            const active = currentUnitId === unit.unitId && !onReportPage;
            return (
              <li key={unit.unitId}>
                <Link
                  className={`sidebar-link ${active ? 'is-active' : ''}`}
                  to={`/u/${unit.unitId}/issues`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="sidebar-unit-id">{unit.unitId}</span>
                  <span className={`sidebar-unit-status status-${unit.status}`}>{unit.status}</span>
                </Link>
              </li>
            );
          })}
          {unassignedCount > 0 && (
            <li>
              <NavLink
                className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}
                to="/unassigned"
                onClick={() => setMenuOpen(false)}
              >
                <span>Unassigned leases</span>
                <span className="sidebar-count">{unassignedCount}</span>
              </NavLink>
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
