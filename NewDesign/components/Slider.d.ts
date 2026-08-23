import * as React from "react";

export interface SliderProps {
  /** Label shown above the track. */
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (next: number) => void;
  /** Format the value read-out (e.g. v => `${v} chunks`). */
  format?: (value: number) => React.ReactNode;
  className?: string;
}

/** Range slider with label + live value. Add `on-dark` ancestor for sidebar. */
export function Slider(props: SliderProps): JSX.Element;
