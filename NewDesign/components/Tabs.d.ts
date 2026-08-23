import * as React from "react";

export type TabItem = string | { value: string; label: string };

export interface TabsProps {
  /** Tabs as strings or { value, label } objects. */
  items: TabItem[];
  /** Active tab value. */
  value: string;
  onChange?: (value: string) => void;
  className?: string;
}

/** Horizontal underline tab strip. */
export function Tabs(props: TabsProps): JSX.Element;
