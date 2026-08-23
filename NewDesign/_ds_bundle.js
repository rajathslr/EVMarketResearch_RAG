/* @ds-bundle: {"format":3,"namespace":"VoltEVEnergyResearchDesignSystem_1e451b","components":[{"name":"Avatar","sourcePath":"components/Avatar.jsx"},{"name":"Badge","sourcePath":"components/Badge.jsx"},{"name":"Button","sourcePath":"components/Button.jsx"},{"name":"Card","sourcePath":"components/Card.jsx"},{"name":"ChatBubble","sourcePath":"components/ChatBubble.jsx"},{"name":"DataTable","sourcePath":"components/DataTable.jsx"},{"name":"ExamplePill","sourcePath":"components/ExamplePill.jsx"},{"name":"Expander","sourcePath":"components/Expander.jsx"},{"name":"FeedbackBar","sourcePath":"components/FeedbackBar.jsx"},{"name":"NavItem","sourcePath":"components/NavItem.jsx"},{"name":"Pill","sourcePath":"components/Pill.jsx"},{"name":"Select","sourcePath":"components/Select.jsx"},{"name":"Slider","sourcePath":"components/Slider.jsx"},{"name":"SourceChunk","sourcePath":"components/SourceChunk.jsx"},{"name":"StatCard","sourcePath":"components/StatCard.jsx"},{"name":"Tabs","sourcePath":"components/Tabs.jsx"},{"name":"TextField","sourcePath":"components/TextField.jsx"},{"name":"Toggle","sourcePath":"components/Toggle.jsx"}],"sourceHashes":{"components/Avatar.jsx":"9f8394de3abe","components/Badge.jsx":"c5536397a6f6","components/Button.jsx":"cda198aa6640","components/Card.jsx":"a29c770ab7f2","components/ChatBubble.jsx":"2f6d11dd14c4","components/DataTable.jsx":"a1566b8e1a2a","components/ExamplePill.jsx":"51be8825c597","components/Expander.jsx":"9c9c9bf2a681","components/FeedbackBar.jsx":"bc46637b20b6","components/NavItem.jsx":"e493515c6d4c","components/Pill.jsx":"f7ecd02db243","components/Select.jsx":"9f7c363c6e40","components/Slider.jsx":"be9dd60860dc","components/SourceChunk.jsx":"00947613c161","components/StatCard.jsx":"f7c67f654fd7","components/Tabs.jsx":"da49ed00830e","components/TextField.jsx":"1d0359760aff","components/Toggle.jsx":"7b65da8bdc86"},"inlinedExternals":[],"unexposedExports":[{"name":"renderMarkdown","sourcePath":"components/ChatBubble.jsx"}]} */

(() => {

const __ds_ns = (window.VoltEVEnergyResearchDesignSystem_1e451b = window.VoltEVEnergyResearchDesignSystem_1e451b || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const React = window.React;

/**
 * Avatar — initials chip. Pass `name` to auto-derive initials, or `initials`.
 * `kind`: user (accent) | assistant (dark) | muted.
 */
function Avatar({
  name = "",
  initials,
  kind = "user",
  size = "md",
  className = "",
  ...rest
}) {
  const text = initials || name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("") || "?";
  const cls = ["avatar", size !== "md" ? `avatar--${size}` : "", kind === "assistant" ? "avatar--assistant" : "", kind === "muted" ? "avatar--muted" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), text);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const React = window.React;

/**
 * Badge — small uppercase status / role pill.
 * Use `role` for the three app roles, or `tone` for generic semantics.
 */
function Badge({
  children,
  tone = "neutral",
  role,
  dot = false,
  className = "",
  ...rest
}) {
  const toneClass = role ? {
    superadmin: "indigo",
    superuser: "green",
    user: "grey"
  }[role] || "grey" : tone;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `badge badge--${toneClass} ${className}`
  }, rest), dot ? /*#__PURE__*/React.createElement("span", {
    className: "badge__dot",
    "aria-hidden": "true"
  }, "\u25CF") : null, children || (role ? role : null));
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Badge.jsx", error: String((e && e.message) || e) }); }

// components/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const React = window.React;

/**
 * Button — primary action control.
 * Variants: primary (accent fill), ghost (bordered), subtle (grey fill),
 * danger, ghost-danger. Sizes: sm | md | lg. Use `block` for full width.
 */
function Button({
  children,
  variant = "primary",
  size = "md",
  block = false,
  icon = null,
  iconRight = null,
  disabled = false,
  type = "button",
  onClick,
  className = "",
  ...rest
}) {
  const cls = ["btn", `btn--${variant}`, size !== "md" ? `btn--${size}` : "", block ? "btn--block" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: cls,
    disabled: disabled,
    onClick: onClick
  }, rest), icon ? /*#__PURE__*/React.createElement("span", {
    className: "btn__icon",
    "aria-hidden": "true"
  }, icon) : null, children, iconRight ? /*#__PURE__*/React.createElement("span", {
    className: "btn__icon",
    "aria-hidden": "true"
  }, iconRight) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Button.jsx", error: String((e && e.message) || e) }); }

// components/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const React = window.React;

/** Card — surface container. `surface` for grey fill, `shadow` for elevation. */
function Card({
  children,
  surface = false,
  shadow = false,
  padLg = false,
  className = "",
  ...rest
}) {
  const cls = ["card", surface ? "card--surface" : "", shadow ? "card--shadow" : "", padLg ? "card--pad-lg" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Card.jsx", error: String((e && e.message) || e) }); }

// components/ChatBubble.jsx
try { (() => {
const React = window.React;

/* --- Minimal markdown -> HTML (headings, lists, tables, code, inline) --- */
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(s) {
  return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>").replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function renderMarkdown(src) {
  const lines = String(src).replace(/\r/g, "").split("\n");
  let html = "",
    i = 0;
  while (i < lines.length) {
    let ln = lines[i];

    // fenced code
    if (/^```/.test(ln)) {
      let code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(esc(lines[i]));
        i++;
      }
      i++;
      html += "<pre><code>" + code.join("\n") + "</code></pre>";
      continue;
    }
    // heading
    let h = ln.match(/^(#{1,3})\s+(.*)/);
    if (h) {
      const n = h[1].length;
      html += `<h${n}>${inline(h[2])}</h${n}>`;
      i++;
      continue;
    }
    // table
    if (/\|/.test(ln) && i + 1 < lines.length && /^[\s|:-]+$/.test(lines[i + 1])) {
      const head = ln.split("|").map(c => c.trim()).filter(Boolean);
      i += 2;
      let rows = [];
      while (i < lines.length && /\|/.test(lines[i])) {
        rows.push(lines[i].split("|").map(c => c.trim()).filter((_, idx, a) => true));
        i++;
      }
      html += "<table><thead><tr>" + head.map(c => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>";
      rows.forEach(r => {
        const cells = r.filter(c => c !== "");
        html += "<tr>" + head.map((_, ci) => `<td>${inline(cells[ci] || "")}</td>`).join("") + "</tr>";
      });
      html += "</tbody></table>";
      continue;
    }
    // blockquote
    if (/^>\s?/.test(ln)) {
      let q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        q.push(inline(lines[i].replace(/^>\s?/, "")));
        i++;
      }
      html += "<blockquote>" + q.join("<br>") + "</blockquote>";
      continue;
    }
    // unordered list
    if (/^[-*]\s+/.test(ln)) {
      let items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^[-*]\s+/, ""))}</li>`);
        i++;
      }
      html += "<ul>" + items.join("") + "</ul>";
      continue;
    }
    // ordered list
    if (/^\d+\.\s+/.test(ln)) {
      let items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ""))}</li>`);
        i++;
      }
      html += "<ol>" + items.join("") + "</ol>";
      continue;
    }
    // blank
    if (/^\s*$/.test(ln)) {
      i++;
      continue;
    }
    // paragraph (gather consecutive non-blank, non-special lines)
    let para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,3}\s|[-*]\s|\d+\.\s|>|```)/.test(lines[i])) {
      para.push(inline(lines[i]));
      i++;
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
function ChatBubble({
  role = "assistant",
  children,
  markdown = true,
  avatar = true,
  footer = null,
  name,
  className = ""
}) {
  const isUser = role === "user";
  const body = markdown && typeof children === "string" ? /*#__PURE__*/React.createElement("div", {
    className: "md",
    dangerouslySetInnerHTML: {
      __html: renderMarkdown(children)
    }
  }) : /*#__PURE__*/React.createElement("div", {
    className: "md"
  }, children);
  const initials = name ? name.split(/\s+/).slice(0, 2).map(w => w[0]).join("") : isUser ? "You" : "AI";
  return /*#__PURE__*/React.createElement("div", {
    className: `bubble-row ${isUser ? "bubble-row--user" : ""} ${className}`
  }, avatar ? /*#__PURE__*/React.createElement("span", {
    className: `avatar ${isUser ? "" : "avatar--assistant"}`
  }, isUser ? initials || "U" : "⚡") : null, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      maxWidth: isUser ? "78%" : "100%",
      flex: isUser ? "none" : 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: `bubble ${isUser ? "bubble--user" : "bubble--assistant"}`
  }, body), footer ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, footer) : null));
}
Object.assign(__ds_scope, { ChatBubble, renderMarkdown });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/ChatBubble.jsx", error: String((e && e.message) || e) }); }

// components/DataTable.jsx
try { (() => {
const React = window.React;

/**
 * DataTable — simple bordered table.
 * `columns`: [{ key, label, align?, render? }]. `rows`: array of objects.
 * A column's `render(row)` overrides the raw cell value.
 */
function DataTable({
  columns = [],
  rows = [],
  className = "",
  empty = "No data"
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "table-wrap " + className
  }, /*#__PURE__*/React.createElement("table", {
    className: "table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    className: c.align === "right" ? "table__num" : ""
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.length === 0 ? /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: columns.length,
    className: "table__muted",
    style: {
      textAlign: "center",
      padding: "24px"
    }
  }, empty)) : rows.map((row, ri) => /*#__PURE__*/React.createElement("tr", {
    key: row.id != null ? row.id : ri
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    className: c.align === "right" ? "table__num" : ""
  }, c.render ? c.render(row) : row[c.key])))))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/ExamplePill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const React = window.React;

/** ExamplePill — a clickable suggested-question card for the empty state. */
function ExamplePill({
  children,
  onClick,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: "example-pill " + className,
    onClick: onClick
  }, rest), children);
}
Object.assign(__ds_scope, { ExamplePill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/ExamplePill.jsx", error: String((e && e.message) || e) }); }

// components/Expander.jsx
try { (() => {
const React = window.React;

/**
 * Expander — collapsible disclosure. Uncontrolled by default (`defaultOpen`),
 * or controlled via `open` + `onToggle`.
 */
function Expander({
  title,
  children,
  defaultOpen = false,
  open,
  onToggle,
  className = ""
}) {
  const [internal, setInternal] = React.useState(defaultOpen);
  const isOpen = open !== undefined ? open : internal;
  const toggle = () => onToggle ? onToggle(!isOpen) : setInternal(v => !v);
  return /*#__PURE__*/React.createElement("div", {
    className: "expander " + (isOpen ? "expander--open " : "") + className
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "expander__head",
    onClick: toggle,
    "aria-expanded": isOpen
  }, /*#__PURE__*/React.createElement("svg", {
    className: "expander__chevron",
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "9 18 15 12 9 6"
  })), title), isOpen ? /*#__PURE__*/React.createElement("div", {
    className: "expander__body"
  }, children) : null);
}
Object.assign(__ds_scope, { Expander });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Expander.jsx", error: String((e && e.message) || e) }); }

// components/FeedbackBar.jsx
try { (() => {
const React = window.React;
const ICONS = [{
  key: "up",
  glyph: "👍"
}, {
  key: "down",
  glyph: "👎"
}, {
  key: "heart",
  glyph: "❤️"
}, {
  key: "comment",
  glyph: "💬"
}];

/**
 * FeedbackBar — token usage read-out + reaction icons.
 * `tokens`: { in, out, total, model }. `active`: array of selected keys.
 * Toggling "comment" reveals a 100-char comment input.
 */
function FeedbackBar({
  tokens,
  active = [],
  onReact,
  comment = "",
  onComment,
  className = ""
}) {
  const showComment = active.includes("comment");
  const t = tokens || {};
  return /*#__PURE__*/React.createElement("div", {
    className: className
  }, /*#__PURE__*/React.createElement("div", {
    className: "feedback"
  }, tokens ? /*#__PURE__*/React.createElement("span", {
    className: "feedback__tokens"
  }, "Tokens \u2014 in ", fmt(t.in), " \xB7 out ", fmt(t.out), " \xB7 total ", fmt(t.total), t.model ? " · " + t.model : "") : null, /*#__PURE__*/React.createElement("div", {
    className: "feedback__icons"
  }, ICONS.map(ic => /*#__PURE__*/React.createElement("button", {
    key: ic.key,
    type: "button",
    title: ic.key,
    onClick: () => onReact && onReact(ic.key),
    className: "feedback__btn" + (active.includes(ic.key) ? " feedback__btn--active" : "")
  }, ic.glyph)))), showComment ? /*#__PURE__*/React.createElement("input", {
    type: "text",
    maxLength: 100,
    className: "input",
    placeholder: "Add a comment (max 100 chars)\u2026",
    value: comment,
    onChange: e => onComment && onComment(e.target.value),
    style: {
      marginTop: 8,
      maxWidth: 360,
      marginLeft: "auto",
      display: "block"
    }
  }) : null);
}
function fmt(n) {
  return n === undefined || n === null ? "–" : Number(n).toLocaleString();
}
Object.assign(__ds_scope, { FeedbackBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/FeedbackBar.jsx", error: String((e && e.message) || e) }); }

// components/NavItem.jsx
try { (() => {
const React = window.React;

/**
 * NavItem — a recent-chat row in the dark sidebar.
 * Designed to sit inside an `.on-dark` container. Hover reveals delete.
 */
function NavItem({
  title,
  active = false,
  onClick,
  onDelete,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "nav-item " + (active ? "nav-item--active " : "") + className,
    onClick: onClick,
    role: "button",
    tabIndex: 0
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flex: "none",
      opacity: .7
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
  })), /*#__PURE__*/React.createElement("span", {
    className: "nav-item__title"
  }, title), onDelete ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "nav-item__del",
    "aria-label": "Delete chat",
    onClick: e => {
      e.stopPropagation();
      onDelete();
    }
  }, "\xD7") : null);
}
Object.assign(__ds_scope, { NavItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/NavItem.jsx", error: String((e && e.message) || e) }); }

// components/Pill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const React = window.React;

/** Pill — accent-tinted label, e.g. the "AI Research" badge in the topbar. */
function Pill({
  children,
  icon = null,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: "pill " + className
  }, rest), icon ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, icon) : null, children);
}
Object.assign(__ds_scope, { Pill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Pill.jsx", error: String((e && e.message) || e) }); }

// components/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const React = window.React;

/**
 * Select — native dropdown with the system chevron.
 * Pass `options` as strings or { value, label } objects.
 */
function Select({
  label,
  value,
  onChange,
  options = [],
  id,
  className = "",
  ...rest
}) {
  const selectId = id || (label ? "sel-" + String(label).toLowerCase().replace(/\s+/g, "-") : undefined);
  const norm = options.map(o => typeof o === "object" ? o : {
    value: o,
    label: o
  });
  const control = /*#__PURE__*/React.createElement("select", _extends({
    id: selectId,
    className: "select",
    value: value,
    onChange: e => onChange && onChange(e.target.value)
  }, rest), norm.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label)));
  if (!label) return control;
  return /*#__PURE__*/React.createElement("div", {
    className: "field " + className
  }, /*#__PURE__*/React.createElement("label", {
    className: "field__label",
    htmlFor: selectId
  }, label), control);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Select.jsx", error: String((e && e.message) || e) }); }

// components/Slider.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const React = window.React;

/**
 * Slider — labelled range input with live value read-out.
 * `format` lets you append units or render a custom value string.
 */
function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  format,
  className = "",
  ...rest
}) {
  const shown = format ? format(value) : value;
  return /*#__PURE__*/React.createElement("div", {
    className: "slider " + className
  }, (label || shown !== undefined) && /*#__PURE__*/React.createElement("div", {
    className: "slider__head"
  }, label ? /*#__PURE__*/React.createElement("span", {
    className: "slider__label"
  }, label) : /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", {
    className: "slider__value"
  }, shown)), /*#__PURE__*/React.createElement("input", _extends({
    type: "range",
    className: "slider__input",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange && onChange(Number(e.target.value))
  }, rest)));
}
Object.assign(__ds_scope, { Slider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Slider.jsx", error: String((e && e.message) || e) }); }

// components/SourceChunk.jsx
try { (() => {
const React = window.React;
const SOURCE_LABEL = {
  google_play: "Google Play",
  app_store: "App Store",
  news: "News",
  website: "Website",
  youtube: "YouTube"
};

/** SourceChunk — one retrieved knowledge-base chunk with app, source, score. */
function SourceChunk({
  app,
  source = "",
  score,
  text,
  className = ""
}) {
  const srcLabel = SOURCE_LABEL[source] || source;
  return /*#__PURE__*/React.createElement("div", {
    className: "chunk " + className
  }, /*#__PURE__*/React.createElement("div", {
    className: "chunk__head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chunk__app"
  }, app), srcLabel ? /*#__PURE__*/React.createElement("span", {
    className: "badge badge--neutral"
  }, srcLabel) : null, score !== undefined ? /*#__PURE__*/React.createElement("span", {
    className: "chunk__score"
  }, Number(score).toFixed(2)) : null), /*#__PURE__*/React.createElement("div", {
    className: "chunk__text"
  }, text));
}
Object.assign(__ds_scope, { SourceChunk });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/SourceChunk.jsx", error: String((e && e.message) || e) }); }

// components/StatCard.jsx
try { (() => {
const React = window.React;

/** StatCard — a labelled metric tile for the admin overview. */
function StatCard({
  label,
  value,
  delta,
  deltaDir,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "stat " + className
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat__label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "stat__value"
  }, value), delta ? /*#__PURE__*/React.createElement("div", {
    className: "stat__delta " + (deltaDir === "down" ? "stat__delta--down" : "stat__delta--up")
  }, deltaDir === "down" ? "▼" : "▲", " ", delta) : null);
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/Tabs.jsx
try { (() => {
const React = window.React;

/**
 * Tabs — horizontal tab strip. Controlled via `value` + `onChange`.
 * `items`: array of strings or { value, label }.
 */
function Tabs({
  items = [],
  value,
  onChange,
  className = ""
}) {
  const norm = items.map(t => typeof t === "object" ? t : {
    value: t,
    label: t
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "tabs " + className,
    role: "tablist"
  }, norm.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.value,
    type: "button",
    role: "tab",
    "aria-selected": value === t.value,
    className: "tab" + (value === t.value ? " tab--active" : ""),
    onClick: () => onChange && onChange(t.value)
  }, t.label)));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/TextField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const React = window.React;

/**
 * TextField — labelled text input with optional error / hint.
 * Pass `error` to show the inline error state + message.
 */
function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  error = "",
  hint = "",
  id,
  disabled = false,
  className = "",
  ...rest
}) {
  const inputId = id || (label ? "tf-" + String(label).toLowerCase().replace(/\s+/g, "-") : undefined);
  return /*#__PURE__*/React.createElement("div", {
    className: "field " + className
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "field__label",
    htmlFor: inputId
  }, label) : null, /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    type: type,
    className: "input" + (error ? " input--error" : ""),
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled
  }, rest)), error ? /*#__PURE__*/React.createElement("span", {
    className: "field__error"
  }, "\u26A0 ", error) : hint ? /*#__PURE__*/React.createElement("span", {
    className: "field__hint"
  }, hint) : null);
}
Object.assign(__ds_scope, { TextField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/TextField.jsx", error: String((e && e.message) || e) }); }

// components/Toggle.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const React = window.React;

/** Toggle — on/off switch with optional inline label. Controlled via `checked`. */
function Toggle({
  checked = false,
  onChange,
  label = "",
  disabled = false,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: "switch",
    "aria-checked": checked,
    disabled: disabled,
    onClick: () => !disabled && onChange && onChange(!checked),
    className: "toggle " + (checked ? "toggle--on " : "") + className,
    style: {
      background: "none",
      border: "none",
      opacity: disabled ? 0.55 : 1
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "toggle__track"
  }, /*#__PURE__*/React.createElement("span", {
    className: "toggle__thumb"
  })), label ? /*#__PURE__*/React.createElement("span", {
    className: "toggle__label"
  }, label) : null);
}
Object.assign(__ds_scope, { Toggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Toggle.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.ChatBubble = __ds_scope.ChatBubble;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.ExamplePill = __ds_scope.ExamplePill;

__ds_ns.Expander = __ds_scope.Expander;

__ds_ns.FeedbackBar = __ds_scope.FeedbackBar;

__ds_ns.NavItem = __ds_scope.NavItem;

__ds_ns.Pill = __ds_scope.Pill;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Slider = __ds_scope.Slider;

__ds_ns.SourceChunk = __ds_scope.SourceChunk;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.TextField = __ds_scope.TextField;

__ds_ns.Toggle = __ds_scope.Toggle;

})();
