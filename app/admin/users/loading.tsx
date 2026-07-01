export default function Loading() {
  return (
    <div className="users-loading">
      <div className="users-loading-topbar skeleton-card" />

      <div className="users-loading-toolbar skeleton-card">
        <div className="skeleton-line skeleton-line--lg" />
        <div className="users-loading-filters">
          <div className="skeleton-input" />
          <div className="skeleton-input" />
          <div className="skeleton-input" />
          <div className="skeleton-button" />
        </div>
      </div>

      <div className="users-loading-summary">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="skeleton-card users-loading-summary-card" key={index}>
            <div className="skeleton-avatar" />
            <div className="users-loading-summary-content">
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line--xl" />
              <div className="skeleton-line skeleton-line--sm" />
            </div>
          </div>
        ))}
      </div>

      <div className="skeleton-card users-loading-table">
        <div className="users-loading-table-head">
          <div className="skeleton-line skeleton-line--lg" />
          <div className="skeleton-line skeleton-line--sm" />
        </div>
        <div className="users-loading-table-rows">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="users-loading-row" key={index}>
              <div className="users-loading-user">
                <div className="skeleton-avatar" />
                <div className="users-loading-user-copy">
                  <div className="skeleton-line skeleton-line--md" />
                  <div className="skeleton-line skeleton-line--sm" />
                  <div className="skeleton-line skeleton-line--sm" />
                </div>
              </div>
              <div className="skeleton-pill" />
              <div className="skeleton-pill" />
              <div className="skeleton-line skeleton-line--md" />
              <div className="skeleton-button skeleton-button--sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
