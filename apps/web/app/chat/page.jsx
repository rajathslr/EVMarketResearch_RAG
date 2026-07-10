"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import { Toggle } from "@/components/Toggle";
import { Slider } from "@/components/Slider";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Pill } from "@/components/Pill";
import { NavItem } from "@/components/NavItem";
import { ExamplePill } from "@/components/ExamplePill";
import { ChatBubble } from "@/components/ChatBubble";
import { SourceChunk } from "@/components/SourceChunk";
import { FeedbackBar } from "@/components/FeedbackBar";
import { Expander } from "@/components/Expander";
import {
  appendSessionMessages, askQuestion, clearSession, createSession, deleteSessionApi, getSessionFeedback,
  getSessionMessages, getStoredUser, getToken, listSessions, postFeedback,
} from "@/lib/api";

// Static knowledge-base snapshot — update by hand after a pipeline run
// (see /api/stats for current live numbers). Last updated 2026-06-20.
const KB_SNAPSHOT = { reviews: 15045, articles: 4472, videos: 269, webPages: 252, apps: 21, sources: 5 };

const APP_LABELS = {
  chargepoint: "ChargePoint", evgo: "EVgo", blink: "Blink", plugshare: "PlugShare",
  electrify_america: "Electrify America", flo: "FLO", evcs: "EVCS", shell_recharge: "Shell Recharge", tesla: "Tesla",
  tesla_powerwall: "Tesla Powerwall", enphase: "Enphase Enlighten", solaredge: "SolarEdge mySolarEdge",
  emporia: "Emporia Energy", sense: "Sense", sunpower: "SunPower", generac: "Generac PWRview", span: "Span",
};
const EV_APPS = [
  ["chargepoint", "ChargePoint"], ["evgo", "EVgo"], ["blink", "Blink"], ["plugshare", "PlugShare"],
  ["electrify_america", "Electrify America"], ["flo", "FLO"], ["evcs", "EVCS"], ["shell_recharge", "Shell Recharge"], ["tesla", "Tesla"],
];
const PROSUMER_APPS = [
  ["tesla_powerwall", "Tesla Powerwall"], ["enphase", "Enphase Enlighten"], ["solaredge", "SolarEdge mySolarEdge"],
  ["emporia", "Emporia Energy"], ["sense", "Sense"], ["sunpower", "SunPower"], ["generac", "Generac PWRview"], ["span", "Span"],
];

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "ev_charging", label: "EV Charging" },
  { value: "prosumer", label: "Prosumer" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "google_play", label: "Google Play" },
  { value: "app_store", label: "App Store" },
  { value: "news", label: "News" },
  { value: "website", label: "Website" },
  { value: "youtube", label: "YouTube" },
];

const EXAMPLES = [
  "What are the most common complaints about ChargePoint reliability?",
  "How does EVgo compare to Electrify America on pricing transparency?",
  "What do Tesla Powerwall owners say about recent app updates?",
  "Which prosumer app has the best battery-monitoring UX?",
];

function appOptionsFor(category) {
  const list = category === "ev_charging" ? EV_APPS : category === "prosumer" ? PROSUMER_APPS : [...EV_APPS, ...PROSUMER_APPS];
  return [
    { value: "all", label: category === "prosumer" ? "All prosumer apps" : category === "ev_charging" ? "All EV apps" : "All apps" },
    ...list.map(([value, label]) => ({ value, label })),
  ];
}

// Historical sessions saved by the old Streamlit app use different field
// names ({content, usage, app_name} instead of {text, tokens, app, score}).
// Normalize both shapes to what ChatBubble/SourceChunk/FeedbackBar expect.
function normalizeStoredMessage(m) {
  return {
    role: m.role,
    text: m.text ?? m.content ?? "",
    tokens: m.tokens || (m.usage ? {
      in: m.usage.input_tokens, out: m.usage.output_tokens,
      total: m.usage.total_tokens, model: m.usage.model,
    } : null),
    sources: (m.sources || []).map((s) => ({
      app: APP_LABELS[s.app] || APP_LABELS[s.app_name] || s.app || s.app_name,
      source: s.source,
      score: s.score,
      text: s.text ?? s.content ?? "",
    })),
  };
}

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  const [sessions, setSessions] = useState([]);
  const [sessionError, setSessionError] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [reactions, setReactions] = useState({});
  const [comments, setComments] = useState({});

  const [category, setCategory] = useState("all");
  const [app, setApp] = useState("all");
  const [source, setSource] = useState("all");
  const [compareMode, setCompareMode] = useState(false);
  const [topK, setTopK] = useState(12);

  const [kbOpen, setKbOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const idRef = useRef(100);
  const nid = () => "m" + (idRef.current += 1);

  // Saves must complete in submission order, or an earlier-fired-but-slower
  // save can land on the server after a later, more-complete one and silently
  // overwrite it with stale (shorter) content — chaining onto this ref forces
  // strict sequencing regardless of which network request happens to resolve
  // first. Keyed per session so switching chats doesn't serialize unrelated
  // saves behind each other.
  const persistQueueRef = useRef({});

  // Source of truth for "what to persist", kept independent of React's
  // render cycle — and keyed per session, not a single shared array. Two
  // failure modes this avoids:
  //  1. Navigating to a different PAGE (e.g. Admin Portal) unmounts this
  //     component; React can then silently skip a stale setMessages updater
  //     when an in-flight response finally arrives, so the answer never
  //     makes it into what gets saved even though the API call succeeded.
  //  2. Switching to a different SESSION while a question is still in
  //     flight doesn't unmount anything, but a single shared "current
  //     messages" ref would get overwritten by the newly-selected session —
  //     the late-arriving answer would then attach to the WRONG session's
  //     list and get saved under the ORIGINAL session's id, corrupting both.
  // A plain ref write always runs (it's just JS, not tied to rendering or to
  // which session is currently displayed), so each session's bucket here is
  // guaranteed correct regardless of what the user does in the meantime.
  const messagesBySessionRef = useRef({});
  const activeSessionRef = useRef(null);

  function updateMessagesFor(sessionId, updater) {
    const current = messagesBySessionRef.current[sessionId] || [];
    const next = typeof updater === "function" ? updater(current) : updater;
    messagesBySessionRef.current[sessionId] = next;
    if (activeSessionRef.current === sessionId) setMessages(next);
    return next;
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUser(getStoredUser());
    listSessions().then((list) => {
      setSessions(list);
      if (list.length > 0) selectSession(list[0].session_id, list);
    }).catch((e) => { setSessions([]); setSessionError(e.message); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function selectSession(sessionId, knownSessions) {
    activeSessionRef.current = sessionId;
    setActiveSession(sessionId);
    setMenuOpen(false);
    try {
      const [{ messages: stored }, feedback] = await Promise.all([
        getSessionMessages(sessionId),
        getSessionFeedback(sessionId),
      ]);
      const withIds = stored.map((m) => ({ ...normalizeStoredMessage(m), id: nid() }));
      updateMessagesFor(sessionId, withIds);
      const reactionMap = {};
      const commentMap = {};
      withIds.forEach((m, idx) => {
        const fb = feedback[idx];
        if (fb) {
          if (fb.reaction) reactionMap[m.id] = [fb.reaction];
          if (fb.comment) commentMap[m.id] = fb.comment;
        }
      });
      setReactions(reactionMap);
      setComments(commentMap);
    } catch {
      updateMessagesFor(sessionId, []);
      setReactions({});
      setComments({});
    }
  }

  // Appends just the messages from one exchange (not the full accumulated
  // list) via the additive backend endpoint — this is what actually makes
  // the save safe under concurrent use: it never depends on capturing "the
  // whole current array" correctly, which is the thing that kept breaking
  // (unmounted pages, switched sessions, and — the case this fixes that the
  // earlier ref-based patch didn't — a second tab/device on the same
  // account, each holding its own possibly-stale full copy that would
  // otherwise silently overwrite the other's contribution on save).
  async function persist(sessionId, newMsgs, title) {
    if (!sessionId || newMsgs.length === 0) return;
    try {
      await appendSessionMessages(sessionId, newMsgs.map(({ id, ...rest }) => rest), title);
      setSessions((prev) => {
        const existing = prev.find((s) => s.session_id === sessionId);
        const updated = {
          session_id: sessionId,
          title: existing?.title && existing.title !== "New Chat" ? existing.title : (title || existing?.title || "New chat"),
          updated_at: new Date().toISOString(),
          created_at: existing?.created_at || new Date().toISOString(),
        };
        return [updated, ...prev.filter((s) => s.session_id !== sessionId)];
      });
    } catch {
      // never let persistence failures break the chat UX
    }
  }

  async function sendText(q) {
    q = (q || "").trim();
    if (!q || loading) return;

    let sessionId = activeSession;
    if (!sessionId) {
      try {
        const created = await createSession();
        sessionId = created.session_id;
        activeSessionRef.current = sessionId;
        setActiveSession(sessionId);
      } catch {
        // fall back to an unsaved local-only session
      }
    }

    const uid = nid();
    const userMsg = { id: uid, role: "user", text: q };
    setInput("");
    setLoading(true);
    updateMessagesFor(sessionId, (m) => [...m, userMsg]);

    // Plain local variable, not a ref/state read — what gets saved for this
    // exchange never depends on React having successfully applied a state
    // update, only on this function having run to completion. That's what
    // makes the save reliable regardless of mount state, session switches,
    // or another tab/device concurrently saving its own exchange.
    let assistantMsg;
    try {
      const data = await askQuestion({
        question: q, categoryFilter: category, appFilter: app, sourceFilter: source,
        comparisonMode: compareMode, sessionId, topK,
      });
      const aid = nid();
      assistantMsg = {
        id: aid,
        role: "assistant",
        text: data.answer,
        tokens: data.usage ? { in: data.usage.input_tokens, out: data.usage.output_tokens, total: data.usage.total_tokens, model: data.usage.model } : null,
        sources: (data.sources || []).map((s) => ({ app: APP_LABELS[s.app_name] || s.app_name, source: s.source, score: s.score, text: s.content })),
      };
      updateMessagesFor(sessionId, (m) => [...m, assistantMsg]);
    } catch (err) {
      const aid = nid();
      assistantMsg = { id: aid, role: "assistant", text: `Sorry — that query failed: ${err.message}`, sources: [] };
      updateMessagesFor(sessionId, (m) => [...m, assistantMsg]);
    } finally {
      setLoading(false);
      if (sessionId) {
        const newMsgs = [userMsg, assistantMsg].filter(Boolean);
        const title = q.slice(0, 60);
        const queued = persistQueueRef.current[sessionId] || Promise.resolve();
        persistQueueRef.current[sessionId] = queued
          .then(() => persist(sessionId, newMsgs, title))
          .catch(() => {});
      }
    }
  }

  function toggleReaction(msgId, key) {
    const idx = messages.findIndex((m) => m.id === msgId);
    setReactions((r) => {
      const cur = r[msgId] || [];
      const next = cur.includes(key) ? [] : [key];
      if (activeSession && idx >= 0) postFeedback(activeSession, idx, next[0] || null, comments[msgId] || "").catch(() => {});
      return { ...r, [msgId]: next };
    });
  }

  function updateComment(msgId, text) {
    const idx = messages.findIndex((m) => m.id === msgId);
    setComments((c) => ({ ...c, [msgId]: text }));
    if (activeSession && idx >= 0) {
      const reaction = (reactions[msgId] || [])[0] || null;
      postFeedback(activeSession, idx, reaction, text).catch(() => {});
    }
  }

  function newChat() {
    activeSessionRef.current = null;
    setMessages([]);
    setReactions({});
    setComments({});
    setActiveSession(null);
    setInput("");
    setMenuOpen(false);
  }

  async function deleteSessionRow(id) {
    try { await deleteSessionApi(id); } catch { /* best-effort */ }
    setSessions((s) => s.filter((x) => x.session_id !== id));
    if (activeSession === id) newChat();
  }

  function signOut() {
    clearSession();
    router.push("/login");
  }

  const categoryLabel = category === "ev_charging" ? "EV Charging" : category === "prosumer" ? "Prosumer" : "All";
  const isEmpty = messages.length === 0 && !loading;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)", fontSize: 14 }}>
      {/* ================= SIDEBAR ================= */}
      <aside className="on-dark" style={{ width: 260, flex: "none", background: "var(--sidebar-bg)", color: "var(--sidebar-text)", display: "flex", flexDirection: "column", borderRight: "1px solid var(--sidebar-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 16px 14px" }}>
          <div style={{ width: 34, height: 34, flex: "none", borderRadius: 9, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Home Energy &amp; EV</div>
            <div style={{ fontSize: 11, color: "var(--sidebar-muted)", lineHeight: 1.3 }}>Competitive intelligence</div>
          </div>
        </div>

        <div style={{ padding: "0 16px 12px" }}>
          <Button variant="primary" block icon="＋" onClick={newChat}>New Chat</Button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "4px 10px 10px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sidebar-muted)", padding: "8px 6px 6px" }}>Recent</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {sessions.map((s) => (
              <NavItem key={s.session_id} title={s.title} active={s.session_id === activeSession} onClick={() => selectSession(s.session_id)} onDelete={() => deleteSessionRow(s.session_id)} />
            ))}
            {sessions.length === 0 && !sessionError && <div style={{ fontSize: 12, color: "var(--sidebar-muted)", padding: "4px 6px" }}>No chats yet</div>}
            {sessionError && <div style={{ fontSize: 12, color: "var(--danger)", padding: "4px 6px" }}>Couldn't load chat history: {sessionError}</div>}
          </div>

          <button onClick={() => setKbOpen((v) => !v)} style={sidebarSectionToggleStyle}>
            <span style={{ display: "inline-block" }}>{kbOpen ? "▾" : "▸"}</span> Knowledge Base
          </button>
          {kbOpen && (
            <div style={{ padding: "2px 6px 6px", fontSize: 12, color: "var(--sidebar-muted)", lineHeight: 1.7 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>App reviews</span><b style={{ color: "var(--sidebar-text)" }}>{KB_SNAPSHOT.reviews.toLocaleString()}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>News articles</span><b style={{ color: "var(--sidebar-text)" }}>{KB_SNAPSHOT.articles.toLocaleString()}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Videos</span><b style={{ color: "var(--sidebar-text)" }}>{KB_SNAPSHOT.videos.toLocaleString()}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Apps tracked</span><b style={{ color: "var(--sidebar-text)" }}>{KB_SNAPSHOT.apps}</b></div>
            </div>
          )}

          <button onClick={() => setSettingsOpen((v) => !v)} style={sidebarSectionToggleStyle}>
            <span style={{ display: "inline-block" }}>{settingsOpen ? "▾" : "▸"}</span> Search Settings
          </button>
          {settingsOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "6px 6px 4px" }}>
              <Toggle checked={compareMode} onChange={setCompareMode} label="Comparison mode" />
              <Select label="App" value={app} options={appOptionsFor(category)} onChange={setApp} />
              <Select label="Source" value={source} options={SOURCE_OPTIONS} onChange={setSource} />
              <Slider label="Chunks to retrieve" value={topK} min={4} max={25} onChange={setTopK} format={(v) => v + " chunks"} />
              {compareMode && (
                <div style={{ fontSize: 11, color: "var(--sidebar-muted)" }}>
                  Comparison mode is a UI preview — per-app retrieval isn't wired up yet.
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderTop: "1px solid var(--sidebar-border)" }}>
          <Avatar name={user?.name || "?"} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name || "—"}</div>
            <div style={{ fontSize: 11, color: "var(--sidebar-muted)" }}>{user?.username || ""}</div>
          </div>
          {user?.role && <Badge role={user.role} />}
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 22px", borderBottom: "1px solid var(--border)", position: "relative", flexWrap: "wrap" }}>
          <div style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚡</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Research Chat</span>
              <Pill>AI Research</Pill>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {KB_SNAPSHOT.reviews.toLocaleString()} reviews · {KB_SNAPSHOT.articles.toLocaleString()} articles · {KB_SNAPSHOT.videos} videos · {KB_SNAPSHOT.apps} apps
            </div>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <div className="category-switch">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  className={"category-switch__btn" + (category === c.value ? " category-switch__btn--active" : "")}
                  onClick={() => { setCategory(c.value); setApp("all"); }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <span className="kb-status"><span className="kb-status__dot" /> Knowledge base live</span>
            <button onClick={() => setMenuOpen((v) => !v)} style={{ width: 34, height: 34, flex: "none", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg)", cursor: "pointer", color: "var(--text-secondary)", fontSize: 17, lineHeight: 1 }}>⋯</button>
          </div>

          {menuOpen && (
            <div style={{ position: "absolute", top: 56, right: 22, width: 200, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow-lg)", padding: 6, zIndex: 20 }}>
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name || "—"}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{user?.role || ""}</div>
              </div>
              <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
              {(user?.role === "superadmin" || user?.role === "superuser") && (
                <>
                  <Link href="/admin" style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", fontSize: 13, color: "var(--text)", borderRadius: 6, textDecoration: "none" }} onClick={() => setMenuOpen(false)}>Admin Portal</Link>
                  <Link href="/observability" style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", fontSize: 13, color: "var(--text)", borderRadius: 6, textDecoration: "none" }} onClick={() => setMenuOpen(false)}>Observability</Link>
                  <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                </>
              )}
              <button onClick={signOut} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "var(--danger)", borderRadius: 6 }}>Sign Out</button>
            </div>
          )}
        </header>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: "var(--chat-max)", margin: "0 auto", padding: "26px 22px 12px", display: "flex", flexDirection: "column", gap: 20 }}>
            {isEmpty && (
              <div style={{ textAlign: "center", padding: "48px 12px 24px" }}>
                <div style={{ width: 56, height: 56, margin: "0 auto 16px", borderRadius: 14, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>⚡</div>
                <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>Ask anything about the {categoryLabel === "All" ? "EV & energy" : categoryLabel} market</h2>
                <p style={{ margin: "0 auto", maxWidth: 420, color: "var(--text-secondary)", fontSize: 14 }}>
                  Search {KB_SNAPSHOT.reviews.toLocaleString()} app reviews, {KB_SNAPSHOT.articles.toLocaleString()} news articles and {KB_SNAPSHOT.videos} videos across {KB_SNAPSHOT.apps} apps.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 560, margin: "24px auto 0" }}>
                  {EXAMPLES.map((text) => (
                    <ExamplePill key={text} onClick={() => sendText(text)}>{text}</ExamplePill>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              if (m.role === "user") {
                return <ChatBubble key={m.id} role="user" name={user?.name || "You"}>{m.text}</ChatBubble>;
              }
              const active = reactions[m.id] || [];
              return (
                <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <ChatBubble role="assistant">{m.text}</ChatBubble>
                  <div style={{ paddingLeft: 42, display: "flex", flexDirection: "column", gap: 10 }}>
                    {m.sources && m.sources.length > 0 && (
                      <Expander title={`View ${m.sources.length} source chunks`}>
                        {m.sources.map((c, i) => <SourceChunk key={i} {...c} />)}
                      </Expander>
                    )}
                    <FeedbackBar
                      tokens={m.tokens}
                      active={active}
                      onReact={(k) => toggleReaction(m.id, k)}
                      comment={comments[m.id] || ""}
                      onComment={(t) => updateComment(m.id, t)}
                    />
                  </div>
                </div>
              );
            })}

            {loading && (
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ width: 32, height: 32, flex: "none", borderRadius: 999, background: "var(--text)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⚡</span>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, borderBottomLeftRadius: 6, padding: "14px 16px", fontSize: 14, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 8 }}>
                  Searching knowledge base
                  <span style={{ display: "inline-flex", gap: 3 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", animation: "voltdot 1s infinite" }} />
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", animation: "voltdot 1s infinite .2s" }} />
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", animation: "voltdot 1s infinite .4s" }} />
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 22px 18px", background: "var(--bg)" }}>
          <div style={{ maxWidth: "var(--chat-max)", margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(input); } }}
              rows={1}
              placeholder="Ask about EV charging or home-energy apps…"
              className="textarea"
              style={{ flex: 1, minHeight: 48, maxHeight: 160, fontSize: 15, borderRadius: 12 }}
            />
            <Button variant="primary" onClick={() => sendText(input)} style={{ height: 48 }}>Send ↑</Button>
          </div>
          <div style={{ maxWidth: "var(--chat-max)", margin: "8px auto 0", textAlign: "center", fontSize: 11, color: "var(--text-muted)" }}>
            Live — answers are generated from the real knowledge base via Claude.
          </div>
        </div>
      </main>
    </div>
  );
}

const sidebarSectionToggleStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: "100%",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--sidebar-muted)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  padding: "14px 6px 6px",
};
