const React = window.React;

const SOURCE_LABEL = {
  google_play: "Google Play",
  app_store: "App Store",
  news: "News",
  website: "Website",
  youtube: "YouTube",
};

/** SourceChunk — one retrieved knowledge-base chunk with app, source, score. */
export function SourceChunk({ app, source = "", score, text, className = "" }) {
  const srcLabel = SOURCE_LABEL[source] || source;
  return (
    <div className={"chunk " + className}>
      <div className="chunk__head">
        <span className="chunk__app">{app}</span>
        {srcLabel ? <span className="badge badge--neutral">{srcLabel}</span> : null}
        {score !== undefined ? <span className="chunk__score">{Number(score).toFixed(2)}</span> : null}
      </div>
      <div className="chunk__text">{text}</div>
    </div>
  );
}
