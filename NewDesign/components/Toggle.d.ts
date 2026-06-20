import * as React from "react";

export interface ToggleProps {
  /** On/off state. @default false */
  checked?: boolean;
  /** Called with the next boolean when toggled. */
  onChange?: (next: boolean) => void;
  /** Inline label to the right of the switch. */
  label?: string;
  disabled?: boolean;
  className?: string;
}

/** On/off switch. Add the `on-dark` class to an ancestor for sidebar use. */
export function Toggle(props: ToggleProps): JSX.Element;
