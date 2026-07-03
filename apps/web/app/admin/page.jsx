"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Tabs } from "@/components/Tabs";
import { StatCard } from "@/components/StatCard";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Toggle } from "@/components/Toggle";
import { TextField } from "@/components/TextField";
import { Select } from "@/components/Select";
import {
  changeUserRole, createUser, deleteUser, getAdminOverview, getAdminSources, getObsKpis,
  getRunLogs, getSchedules, getStoredUser, getToken, getUsers, resetUserPassword,
  runSource, saveSchedules, uploadYoutubeTranscript,
} from "@/lib/api";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "sources", label: "Data Sources" },
  { value: "auto", label: "Automation" },
  { value: "logs", label: "Run Logs" },
  { value: "users", label: "Users" },
];

const SOURCE_META = {
  google_play: "Google Play", app_store: "App Store", news: "News",
  web_pages: "Website", youtube: "YouTube",
};
const ROLE_BADGE_TONE = { superadmin: "indigo", superuser: "green", user: "grey" };
const ALL_APP_SLUGS = [
  "chargepoint", "evgo", "blink", "plugshare", "electrify_america", "flo", "evcs", "shell_recharge", "tesla",
  "tesla_powerwall", "enphase", "solaredge", "emporia", "sense", "sunpower", "generac", "span",
];

function timeAgo(iso) {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diffMs / 3600000);
  if (hrs < 1) return "Just now";
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("overview");
  const [error, setError] = useState("");

  const [overview, setOverview] = useState(null);
  const [obsKpis, setObsKpis] = useState(null);
  const [sources, setSources] = useState(null);
  const [schedules, setSchedules] = useState(null);
  const [logFilter, setLogFilter] = useState("all");
  const [logs, setLogs] = useState(null);
  const [users, setUsers] = useState(null);

  const [nuUsername, setNuUsername] = useState("");
  const [nuName, setNuName] = useState("");
  const [nuRole, setNuRole] = useState("user");
  const [creds, setCreds] = useState(null);
  const [ytApp, setYtApp] = useState("chargepoint");
  const [ytFile, setYtFile] = useState(null);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    const user = getStoredUser();
    if (!user || user.role === "user") { router.replace("/chat"); return; }
    setMe(user);
  }, [router]);

  const isSuperadmin = me?.role === "superadmin";

  function withErrorHandling(fn) {
    return (...args) => fn(...args).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (!me) return;
    setError("");
    if (tab === "overview") {
      Promise.all([getAdminOverview(), getObsKpis()]).then(([o, k]) => { setOverview(o); setObsKpis(k); }).catch((e) => setError(e.message));
    } else if (tab === "sources") {
      getAdminSources().then(setSources).catch((e) => setError(e.message));
    } else if (tab === "auto") {
      Promise.all([getSchedules(), getAdminSources()]).then(([sch, src]) => { setSchedules(sch); setSources(src); }).catch((e) => setError(e.message));
    } else if (tab === "logs") {
      getRunLogs(logFilter).then(setLogs).catch((e) => setError(e.message));
    } else if (tab === "users") {
      getUsers().then(setUsers).catch((e) => setError(e.message));
    }
  }, [me, tab, logFilter]);

  async function handleRun(source) {
    setError("");
    try {
      await runSource(source);
      setSources(await getAdminSources());
      if (schedules) setSchedules(await getSchedules());
    } catch (e) { setError(e.message); }
  }

  async function handleScheduleToggle(source, enabled) {
    setSchedules((s) => s.map((row) => (row.source === source ? { ...row, enabled } : row)));
  }

  async function saveScheduleChanges() {
    setError("");
    try {
      const updates = schedules.map((s) => ({ source: s.source, enabled: s.enabled }));
      setSchedules(await saveSchedules(updates));
    } catch (e) { setError(e.message); }
  }

  async function handleYtUpload() {
    if (!ytFile) return;
    setError("");
    try {
      await uploadYoutubeTranscript(ytApp, ytFile);
      setYtFile(null);
    } catch (e) { setError(e.message); }
  }

  async function handleCreateUser() {
    setError("");
    try {
      const result = await createUser(nuUsername.trim(), nuName.trim(), nuRole);
      setCreds(result);
      setUsers(await getUsers());
      setNuUsername(""); setNuName(""); setNuRole("user");
    } catch (e) { setError(e.message); }
  }

  async function handleRoleChange(username, role) {
    setError("");
    try {
      await changeUserRole(username, role);
      setUsers(await getUsers());
    } catch (e) { setError(e.message); }
  }

  async function handleResetPassword(username) {
    setError("");
    try {
      const result = await resetUserPassword(username);
      setCreds(result);
    } catch (e) { setError(e.message); }
  }

  async function handleDeleteUser(username) {
    if (!confirm(`Delete user '${username}'? This cannot be undone.`)) return;
    setError("");
    try {
      await deleteUser(username);
      setUsers(await getUsers());
    } catch (e) { setError(e.message); }
  }

  const logCols = [
    { key: "started_at", label: "Time", render: (r) => timeAgo(r.started_at) },
    { key: "source", label: "Pipeline", render: (r) => SOURCE_META[r.source] || r.source },
    {
      key: "status", label: "Status",
      render: (r) => <Badge tone={r.status === "done" ? "success" : r.status === "error" ? "danger" : "warning"}>
        {r.status === "done" ? `Done (+${r.chunks_added || 0})` : r.status === "error" ? "Error" : "Running"}
      </Badge>,
    },
    { key: "duration_secs", label: "Duration", align: "right", render: (r) => r.duration_secs != null ? `${Math.floor(r.duration_secs / 60)}m ${r.duration_secs % 60}s` : "—" },
  ];

  const userCols = [
    { key: "name", label: "Name" },
    { key: "username", label: "Username" },
    {
      key: "role", label: "Role",
      render: (r) => isSuperadmin ? (
        <Select
          value={r.role}
          onChange={(v) => handleRoleChange(r.username, v)}
          disabled={r.username.toLowerCase() === me?.username?.toLowerCase()}
          options={[{ value: "user", label: "User" }, { value: "superuser", label: "Superuser" }, { value: "superadmin", label: "Superadmin" }]}
        />
      ) : <Badge tone={ROLE_BADGE_TONE[r.role]}>{r.role}</Badge>,
    },
    {
      key: "act", label: "Actions",
      render: (r) => isSuperadmin ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn--ghost btn--sm" onClick={() => handleResetPassword(r.username)}>Reset</button>
          <button
            className="btn btn--ghost-danger btn--sm"
            disabled={r.username.toLowerCase() === me?.username?.toLowerCase()}
            onClick={() => handleDeleteUser(r.username)}
          >Delete</button>
        </div>
      ) : null,
    },
  ];

  if (!me) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: 24 }}>
        <div style={{ marginBottom: 18 }}>
          <TopNav active="/admin" role={me.role} />
        </div>

        {!isSuperadmin && (
          <div className="badge badge--warning" style={{ display: "block", marginBottom: 14, padding: "8px 12px", textTransform: "none", fontWeight: 500 }}>
            View-only mode — Superuser can monitor but not trigger runs, manage users, or change settings.
          </div>
        )}
        {error && (
          <div className="badge badge--danger" style={{ display: "block", marginBottom: 14, padding: "8px 12px", textTransform: "none", fontWeight: 500 }}>
            {error}
          </div>
        )}

        <Tabs items={TABS} value={tab} onChange={setTab} />

        <div style={{ paddingTop: 20 }}>
          {tab === "overview" && (
            overview && obsKpis ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
                  <StatCard label="Total chunks" value={overview.total_chunks.toLocaleString()} />
                  <StatCard label="Sources scheduled" value={`${overview.enabled_count}/${overview.total_sources}`} />
                  <StatCard label="Queries (7d)" value={obsKpis.queries_7d.toLocaleString()} />
                  <StatCard label="Last pipeline run" value={timeAgo(overview.last_run_at)} />
                </div>

                <div className="card" style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Chunks by source</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120 }}>
                    {Object.entries(overview.counts_by_source).map(([source, count]) => {
                      const max = Math.max(...Object.values(overview.counts_by_source));
                      return (
                        <div key={source} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{count.toLocaleString()}</span>
                          <div style={{ width: "100%", maxWidth: 40, background: "var(--accent)", borderRadius: "5px 5px 0 0", height: `${(count / max) * 100}%`, minHeight: 2 }} />
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{SOURCE_META[source] || source}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : <p className="u-muted">Loading…</p>
          )}

          {tab === "sources" && (
            sources ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sources.map((s) => (
                  <div key={s.source} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{SOURCE_META[s.source] || s.source}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {s.chunks.toLocaleString()} chunks · {s.last_run ? `last run ${timeAgo(s.last_run.started_at)}` : "never ingested"}
                      </div>
                    </div>
                    <Badge tone={s.running ? "warning" : s.last_run?.status === "error" ? "danger" : s.last_run?.status === "done" ? "success" : "neutral"}>
                      {s.running ? "Running" : s.last_run?.status === "error" ? "Last run failed" : s.last_run?.status === "done" ? "Last run OK" : "Never run"}
                    </Badge>
                    <Button variant="ghost" size="sm" disabled={!isSuperadmin || s.running} onClick={() => handleRun(s.source)}>
                      {s.running ? "Running…" : "Run now"}
                    </Button>
                  </div>
                ))}
              </div>
            ) : <p className="u-muted">Loading…</p>
          )}

          {tab === "auto" && (
            schedules ? (
              <>
                <div className="card" style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Weekly schedule</div>
                  <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--text-secondary)" }}>
                    The toggle controls the automatic weekly run. Use <strong>Run now</strong> to ingest immediately instead of waiting.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {schedules.map((s) => {
                      const running = sources?.find((x) => x.source === s.source)?.running;
                      return (
                        <div key={s.source} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <Toggle checked={s.enabled} disabled={!isSuperadmin} onChange={(v) => handleScheduleToggle(s.source, v)} label={SOURCE_META[s.source] || s.source} />
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Last: {timeAgo(s.last_run_at)}</span>
                            <Button variant="ghost" size="sm" disabled={!isSuperadmin || running} onClick={() => handleRun(s.source)}>
                              {running ? "Running…" : "Run now"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {isSuperadmin && <div style={{ marginTop: 16 }}><Button variant="primary" onClick={saveScheduleChanges}>Save Schedule</Button></div>}
                </div>

                {isSuperadmin && (
                  <div className="card">
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Ingest YouTube transcript</div>
                    <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--text-secondary)" }}>Upload a .txt transcript to add a new video to the knowledge base.</p>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ width: 200 }}>
                        <Select value={ytApp} onChange={setYtApp} options={ALL_APP_SLUGS} />
                      </div>
                      <input type="file" accept=".txt" onChange={(e) => setYtFile(e.target.files?.[0] || null)} />
                      <Button variant="primary" size="sm" disabled={!ytFile} onClick={handleYtUpload}>Save &amp; Ingest</Button>
                    </div>
                  </div>
                )}
              </>
            ) : <p className="u-muted">Loading…</p>
          )}

          {tab === "logs" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Pipeline run logs</div>
                <div style={{ width: 180 }}>
                  <Select
                    value={logFilter}
                    onChange={setLogFilter}
                    options={[{ value: "all", label: "All sources" }, ...Object.entries(SOURCE_META).map(([value, label]) => ({ value, label }))]}
                  />
                </div>
              </div>
              {logs ? <DataTable columns={logCols} rows={logs} empty="No pipeline runs recorded yet." /> : <p className="u-muted">Loading…</p>}
            </>
          )}

          {tab === "users" && (
            users ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{users.length} users</div>
                <DataTable columns={userCols} rows={users.map((u) => ({ ...u, id: u.username }))} />

                {isSuperadmin && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 20 }}>
                    <div className="card">
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Add user</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <TextField label="Username (email)" value={nuUsername} onChange={(e) => setNuUsername(e.target.value)} placeholder="name@company.com" />
                        <TextField label="Display name" value={nuName} onChange={(e) => setNuName(e.target.value)} placeholder="Full name" />
                        <Select
                          label="Role"
                          value={nuRole}
                          onChange={setNuRole}
                          options={[{ value: "user", label: "User" }, { value: "superuser", label: "Superuser" }, { value: "superadmin", label: "Superadmin" }]}
                        />
                        <Button variant="primary" onClick={handleCreateUser} disabled={!nuUsername.trim() || !nuName.trim()}>Create user</Button>
                      </div>
                    </div>
                    <div className="card">
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Generated credentials</div>
                      {creds ? (
                        <pre style={{ margin: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 14, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
{`Username: ${creds.username}\nPassword: ${creds.password}\n\nShown once — copy now. Only the hash is stored.`}
                        </pre>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Create a user or reset a password to see a one-time copyable credential block here.</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : <p className="u-muted">Loading…</p>
          )}
        </div>
      </div>
    </div>
  );
}
