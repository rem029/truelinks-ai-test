export function HomePage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Lease &amp; Issue Agents</h1>
          <p className="page-subtitle">
            Turn a lease into a verified lease record, or turn unit photos into a draft work order. Both are filed
            under their unit.
          </p>
        </div>
      </header>
      <div className="empty-state">
        <p>Pick a unit on the left to see its issues and lease records, or start a lease review or an issue report.</p>
      </div>
    </div>
  );
}
