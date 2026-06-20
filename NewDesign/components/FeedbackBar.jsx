const React = window.React;

const ICONS = [
  { key: "up", glyph: "👍" },
  { key: "down", glyph: "👎" },
  { key: "heart", glyph: "❤️" },
  { key: "comment", glyph: "💬" },
];

/**
 * FeedbackBar — token usage read-out + reaction icons.
 * `tokens`: { in, out, total, model }. `active`: array of selected keys.
 * Toggling "comment" reveals a 100-char comment input.
 */
export function FeedbackBar({ tokens, active = [], onReact, comment = "", onComment, className = "" }) {
  const showComment = active.includes("comment");
  const t = tokens || {};
  return (
    <div className={className}>
      <div className="feedback">
        {tokens ? (
          <span className="feedback__tokens">
            Tokens — in {fmt(t.in)} · out {fmt(t.out)} · total {fmt(t.total)}
            {t.model ? " · " + t.model : ""}
          </span>
        ) : null}
        <div className="feedback__icons">
          {ICONS.map((ic) => (
            <button
              key={ic.key}
              type="button"
              title={ic.key}
              onClick={() => onReact && onReact(ic.key)}
              className={"feedback__btn" + (active.includes(ic.key) ? " feedback__btn--active" : "")}
            >
              {ic.glyph}
            </button>
          ))}
        </div>
      </div>
      {showComment ? (
        <input
          type="text"
          maxLength={100}
          className="input"
          placeholder="Add a comment (max 100 chars)…"
          value={comment}
          onChange={(e) => onComment && onComment(e.target.value)}
          style={{ marginTop: 8, maxWidth: 360, marginLeft: "auto", display: "block" }}
        />
      ) : null}
    </div>
  );
}

function fmt(n) {
  return n === undefined || n === null ? "–" : Number(n).toLocaleString();
}
