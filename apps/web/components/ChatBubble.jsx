"use client";

/* --- Minimal markdown -> HTML (headings, lists, tables, code, inline) --- */
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Only allow http(s)/mailto, or scheme-less relative links. Blocks
// javascript:/data:/vbscript: URIs that would otherwise execute when clicked —
// the captured URL comes from chat text (LLM answers, which can echo content
// scraped from review/news sources), so it must never be trusted as-is.
function safeUrl(url) {
  // Browsers strip ASCII tab/newline/CR from URLs before parsing the scheme
  // (WHATWG URL spec) — strip the same way first, or "java\tscript:" sails
  // through the scheme regex below as "no scheme found" and gets returned raw.
  const cleaned = url.replace(/[\t\n\r]/g, "").trim();
  const scheme = cleaned.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!scheme) return cleaned; // relative URL, no scheme — safe
  return /^(https?|mailto)$/i.test(scheme[1]) ? cleaned : "#";
}

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => `<a href="${safeUrl(url)}" target="_blank" rel="noopener">${text}</a>`);
}
function renderMarkdown(src) {
  const lines = String(src).replace(/\r/g, "").split("\n");
  let html = "", i = 0;
  while (i < lines.length) {
    let ln = lines[i];

    if (/^```/.test(ln)) {
      let code = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(esc(lines[i])); i++; }
      i++; html += "<pre><code>" + code.join("\n") + "</code></pre>"; continue;
    }
    let h = ln.match(/^(#{1,3})\s+(.*)/);
    if (h) { const n = h[1].length; html += `<h${n}>${inline(h[2])}</h${n}>`; i++; continue; }
    if (/\|/.test(ln) && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i + 1])) {
      const head = ln.split("|").map((c) => c.trim()).filter(Boolean);
      i += 2; let rows = [];
      while (i < lines.length && /\|/.test(lines[i])) {
        rows.push(lines[i].split("|").map((c) => c.trim()).filter((_, idx, a) => true));
        i++;
      }
      html += "<table><thead><tr>" + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>";
      rows.forEach((r) => {
        const cells = r.filter((c) => c !== "");
        html += "<tr>" + head.map((_, ci) => `<td>${inline(cells[ci] || "")}</td>`).join("") + "</tr>";
      });
      html += "</tbody></table>"; continue;
    }
    if (/^>\s?/.test(ln)) {
      let q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(inline(lines[i].replace(/^>\s?/, ""))); i++; }
      html += "<blockquote>" + q.join("<br>") + "</blockquote>"; continue;
    }
    if (/^[-*]\s+/.test(ln)) {
      let items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^[-*]\s+/, ""))}</li>`); i++; }
      html += "<ul>" + items.join("") + "</ul>"; continue;
    }
    if (/^\d+\.\s+/.test(ln)) {
      let items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ""))}</li>`); i++; }
      html += "<ol>" + items.join("") + "</ol>"; continue;
    }
    if (/^\s*$/.test(ln)) { i++; continue; }
    let para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,3}\s|[-*]\s|\d+\.\s|>|```)/.test(lines[i])) {
      para.push(inline(lines[i])); i++;
    }
    html += "<p>" + para.join("<br>") + "</p>";
  }
  return html;
}

/**
 * ChatBubble — a single chat message row with avatar.
 * role: "user" (right, accent) | "assistant" (left, grey card).
 * Assistant messages render `children` (a string) as markdown unless
 * `markdown={false}`. Pass JSX children to render them verbatim.
 */
export function ChatBubble({ role = "assistant", children, markdown = true, avatar = true, footer = null, name, className = "" }) {
  const isUser = role === "user";
  const body = (markdown && typeof children === "string")
    ? <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(children) }} />
    : <div className="md">{children}</div>;
  const initials = name ? name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("") : (isUser ? "You" : "AI");
  return (
    <div className={`bubble-row ${isUser ? "bubble-row--user" : ""} ${className}`}>
      {avatar ? (
        <span className={`avatar ${isUser ? "" : "avatar--assistant"}`}>
          {isUser ? (initials || "U") : "⚡"}
        </span>
      ) : null}
      <div style={{ minWidth: 0, maxWidth: isUser ? "78%" : "100%", flex: isUser ? "none" : 1 }}>
        <div className={`bubble ${isUser ? "bubble--user" : "bubble--assistant"}`}>{body}</div>
        {footer ? <div style={{ marginTop: 8 }}>{footer}</div> : null}
      </div>
    </div>
  );
}
