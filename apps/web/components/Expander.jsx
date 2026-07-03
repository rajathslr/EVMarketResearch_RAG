"use client";

import { useState } from "react";

/**
 * Expander — collapsible disclosure. Uncontrolled by default (`defaultOpen`),
 * or controlled via `open` + `onToggle`.
 */
export function Expander({ title, children, defaultOpen = false, open, onToggle, className = "" }) {
  const [internal, setInternal] = useState(defaultOpen);
  const isOpen = open !== undefined ? open : internal;
  const toggle = () => (onToggle ? onToggle(!isOpen) : setInternal((v) => !v));
  return (
    <div className={"expander " + (isOpen ? "expander--open " : "") + className}>
      <button type="button" className="expander__head" onClick={toggle} aria-expanded={isOpen}>
        <svg className="expander__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {title}
      </button>
      {isOpen ? <div className="expander__body">{children}</div> : null}
    </div>
  );
}
