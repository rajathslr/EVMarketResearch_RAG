import * as React from "react";

export interface TokenInfo {
  in?: number;
  out?: number;
  total?: number;
  /** Model id, e.g. "claude-sonnet-4-6". */
  model?: string;
}

export interface FeedbackBarProps {
  /** Token usage read-out. Omit to hide. */
  tokens?: TokenInfo;
  /** Selected reaction keys: "up" | "down" | "heart" | "comment". */
  active?: string[];
  /** Called with the toggled reaction key. */
  onReact?: (key: "up" | "down" | "heart" | "comment") => void;
  /** Current comment text (shown when "comment" is active). */
  comment?: string;
  onComment?: (text: string) => void;
  className?: string;
}

/** Token usage + 👍👎❤️💬 reaction row with optional comment input. */
export function FeedbackBar(props: FeedbackBarProps): JSX.Element;
