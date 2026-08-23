import * as React from "react";

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Full name — initials are derived from the first two words. */
  name?: string;
  /** Explicit initials, overrides `name`. */
  initials?: string;
  /** Color treatment. @default "user" */
  kind?: "user" | "assistant" | "muted";
  /** @default "md" */
  size?: "sm" | "md" | "lg";
}

/** Circular initials avatar. */
export function Avatar(props: AvatarProps): JSX.Element;
