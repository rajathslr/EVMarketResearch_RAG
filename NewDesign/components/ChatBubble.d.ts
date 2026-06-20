import * as React from "react";

export interface ChatBubbleProps {
  /** "user" = right-aligned accent bubble; "assistant" = left grey card. @default "assistant" */
  role?: "user" | "assistant";
  /** Message body. A string assistant message is rendered as markdown. */
  children?: React.ReactNode;
  /** Parse a string child as markdown. @default true */
  markdown?: boolean;
  /** Show the avatar. @default true */
  avatar?: boolean;
  /** Node rendered under the bubble (e.g. sources expander + feedback bar). */
  footer?: React.ReactNode;
  /** Name used to derive user initials. */
  name?: string;
  className?: string;
}

/** Chat message row: avatar + bubble, with built-in markdown rendering. */
export function ChatBubble(props: ChatBubbleProps): JSX.Element;

/** Render a markdown string to an HTML string (used internally by ChatBubble). */
export function renderMarkdown(src: string): string;
