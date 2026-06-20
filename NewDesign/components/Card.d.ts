import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Use the grey surface fill instead of white + border. @default false */
  surface?: boolean;
  /** Add a drop shadow. @default false */
  shadow?: boolean;
  /** Use the larger 24px padding. @default false */
  padLg?: boolean;
}

/** Generic surface container with border + radius. */
export function Card(props: CardProps): JSX.Element;
