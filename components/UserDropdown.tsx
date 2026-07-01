"use client";



export function UserDropdown({
  displayName,
  roleLabel,
}: {
  displayName: string;
  roleLabel: string;
}) {
  return (
    <div className="user-dropdown-trigger user-account-badge" aria-label={`บัญชี ${displayName}`}>
      <span className="user-dropdown-avatar">
        {displayName.charAt(0).toUpperCase()}
      </span>
      <span className="user-account-text">
        <span className="user-dropdown-name">{displayName}</span>
        <span className="user-account-role">{roleLabel}</span>
      </span>
    </div>
  );
}
