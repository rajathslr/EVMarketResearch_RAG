const React = window.React;

/**
 * NavItem — a recent-chat row in the dark sidebar.
 * Designed to sit inside an `.on-dark` container. Hover reveals delete.
 */
export function NavItem({ title, active = false, onClick, onDelete, className = "" }) {
  return (
    <div
      className={"nav-item " + (active ? "nav-item--active " : "") + className}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", opacity: .7 }}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span className="nav-item__title">{title}</span>
      {onDelete ? (
        <button
          type="button"
          className="nav-item__del"
          aria-label="Delete chat"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >×</button>
      ) : null}
    </div>
  );
}
