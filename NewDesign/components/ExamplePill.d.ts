import * as React from "react";

export interface ExamplePillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

/** Clickable example-question card shown in the chat empty state. */
export function ExamplePill(props: ExamplePillProps): JSX.Element;
