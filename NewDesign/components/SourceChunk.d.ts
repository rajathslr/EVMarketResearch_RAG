import * as React from "react";

export interface SourceChunkProps {
  /** App the chunk was sourced from. */
  app: string;
  /** Source type — known keys get a friendly label. */
  source?: "google_play" | "app_store" | "news" | "website" | "youtube" | string;
  /** Relevance score (0–1), shown to 2 decimals. */
  score?: number;
  /** The (usually truncated) chunk text. */
  text: string;
  className?: string;
}

/** A single retrieved knowledge-base chunk citation card. */
export function SourceChunk(props: SourceChunkProps): JSX.Element;
