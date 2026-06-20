import * as React from "react";

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Field label rendered above the input. */
  label?: string;
  /** Inline error message; also flips the input to its error style. */
  error?: string;
  /** Muted helper text shown when there is no error. */
  hint?: string;
}

/** Labelled text input with focus ring, hint, and error states. */
export function TextField(props: TextFieldProps): JSX.Element;
