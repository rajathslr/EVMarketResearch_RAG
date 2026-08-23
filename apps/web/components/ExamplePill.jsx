"use client";

/** ExamplePill — a clickable suggested-question card for the empty state. */
export function ExamplePill({ children, onClick, className = "", ...rest }) {
  return (
    <button type="button" className={"example-pill " + className} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}
