"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Tabs } from "@/components/Tabs";
import { StatCard } from "@/components/StatCard";
import { DataTable } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import {
  getAppDistribution, getDailyVolume, getLatencyTrend, getObsKpis, getRagasKpis, getRagasTrend,
  getRecentErrors, getRecentQueries, getRunLogs, getStoredUser, getToken,
} from "@/lib/api";

const TABS = [
  { value: "inference", label: "Inference" },
  { value: "ragas", label: "RAGAs Quality" },
  { value: "pipeline", label: "Pipeline" },
  { value: "querylog", label: "Query Log" },
  { value: "errors", label: "Errors" },
];

function Bars({ data, labelKey, valueKey, unit = "" }) {
  if (!data.length) return <p className="u-muted">No data yet.</p>;
  const max = Math.max(...data.map((d) => d[valueKey] || 0), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, overflowX: "auto" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, minWidth: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{d[valueKey]}{unit}</span>
          <div style={{ width: "100%", maxWidth: 28, background: "var(--accent)", borderRadius: "5px 5px 0 0", height: `${((d[valueKey] || 0) / max) * 100}%`, minHeight: 2 }} />
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{String(d[labelKey]).slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function MetricBar({ label, value }) {
  if (value == null) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <b className="u-tabular">{value.toFixed(3)}</b>
      </div>
      <div style={{ height: 8, background: "var(--surface)", borderRadius: 999 }}>
        <div style={{ width: `${Math.min(value, 1) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 999 }} />
      </div>
    </div>
  );
}

const QUERYLOG_COLS = [
  { key: "created_at", label: "Time", render: (r) => new Date(r.created_at).toLocaleString() },
  { key: "username", label: "User" },
  { key: "question", label: "Question" },
  { key: "chunks_returned", label: "Chunks", align: "right" },
  { key: "total_ms", label: "Latency", align: "right", render: (r) => `${(r.total_ms / 1000).toFixed(1)}s` },
  { key: "tok", label: "Tokens", align: "right", render: (r) => (r.input_tokens + r.output_tokens).toLocaleString() },
];

const ERROR_COLS = [
  { key: "created_at", label: "Time", render: (r) => new Date(r.created_at).toLocaleString() },
  { key: "username", label: "User" },
  { key: "question", label: "Question" },
  { key: "error", label: "Error", render: (r) => <span style={{ color: "var(--danger)" }}>{r.error}</span> },
];

const PIPELINE_LOG_COLS = [
  { key: "started_at", label: "Time", render: (r) => new Date(r.started_at).toLocaleString() },
  { key: "source", label: "Source" },
  { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "done" ? "success" : r.status === "error" ? "danger" : "warning"}>{r.status}</Badge> },
  { key: "chunks_added", label: "Rows added", align: "right" },
  { key: "duration_secs", label: "Duration", align: "right", render: (r) => r.duration_secs != null ? `${r.duration_secs}s` : "—" },
];

export default function ObservabilityPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("inference");
  const [error, setError] = useState("");

  const [kpis, setKpis] = useState(null);
  const [volume, setVolume] = useState(null);
  const [latency, setLatency] = useState(null);
  const [appDist, setAppDist] = useState(null);
  const [ragasKpis, setRagasKpis] = useState(null);
  const [ragasTrend, setRagasTrend] = useState(null);
  const [pipelineLogs, setPipelineLogs] = useState(null);
  const [queryLog, setQueryLog] = useState(null);
  const [errorLog, setErrorLog] = useState(null);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    const user = getStoredUser();
    if (!user || user.role === "user") { router.replace("/chat"); return; }
    setMe(user);
  }, [router]);

  useEffect(() => {
    if (!me) return;
    setError("");
    if (tab === "inference") {
      Promise.all([getObsKpis(), getDailyVolume(14), getLatencyTrend(7), getAppDistribution()])
        .then(([k, v, l, a]) => { setKpis(k); setVolume(v); setLatency(l); setAppDist(a); })
        .catch((e) => setError(e.message));
    } else if (tab === "ragas") {
      Promise.all([getRagasKpis(), getRagasTrend(7)])
        .then(([k, t]) => { setRagasKpis(k); setRagasTrend(t); })
        .catch((e) => setError(e.message));
    } else if (tab === "pipeline") {
      getRunLogs("all", 20).then(setPipelineLogs).catch((e) => setError(e.message));
    } else if (tab === "querylog") {
      getRecentQueries(50).then(setQueryLog).catch((e) => setError(e.message));
    } else if (tab === "errors") {
      getRecentErrors(20).then(setErrorLog).catch((e) => setError(e.message));
    }
  }, [me, tab]);

  if (!me) return null;

  const errorRate = kpis && kpis.queries_7d ? ((kpis.errors_7d / kpis.queries_7d) * 100).toFixed(1) : "0.0";
  const avgTokens = kpis && kpis.queries_7d ? Math.round(kpis.tokens_7d / kpis.queries_7d).toLocaleString() : "—";

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: 24 }}>
        <div style={{ marginBottom: 18 }}>
          <TopNav active="/observability" role={me.role} />
        </div>

        {error && (
          <div className="badge badge--danger" style={{ display: "block", marginBottom: 14, padding: "8px 12px", textTransform: "none", fontWeight: 500 }}>
            {error}
          </div>
        )}

        <Tabs items={TABS} value={tab} onChange={setTab} />

        <div style={{ paddingTop: 20 }}>
          {tab === "inference" && (
            kpis ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
                  <StatCard label="Avg latency (7d)" value={kpis.avg_latency_ms ? `${(kpis.avg_latency_ms / 1000).toFixed(1)}s` : "—"} />
                  <StatCard label="p95 latency (7d)" value={kpis.p95_latency_ms ? `${(kpis.p95_latency_ms / 1000).toFixed(1)}s` : "—"} />
                  <StatCard label="Error rate (7d)" value={`${errorRate}%`} />
                  <StatCard label="Avg tokens / query" value={avgTokens} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
                  <div className="card">
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Daily query volume (14d)</div>
                    <Bars data={volume} labelKey="day" valueKey="queries" />
                  </div>
                  <div className="card">
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Daily latency, avg total ms (7d)</div>
                    <Bars data={latency} labelKey="day" valueKey="avg_total_ms" />
                  </div>
                </div>

                <div className="card">
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Query distribution by app</div>
                  {appDist && appDist.length ? appDist.map((a) => {
                    const max = Math.max(...appDist.map((x) => x.queries));
                    return (
                      <div key={a.app_label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <span style={{ width: 150, fontSize: 13, color: "var(--text-secondary)", flex: "none" }}>{a.app_label}</span>
                        <div style={{ flex: 1, height: 8, background: "var(--surface)", borderRadius: 999 }}>
                          <div style={{ width: `${(a.queries / max) * 100}%`, height: "100%", background: "var(--accent)", borderRadius: 999 }} />
                        </div>
                        <span className="u-tabular" style={{ fontSize: 12, width: 32, textAlign: "right" }}>{a.queries}</span>
                      </div>
                    );
                  }) : <p className="u-muted">No queries logged yet.</p>}
                </div>
              </>
            ) : <p className="u-muted">Loading…</p>
          )}

          {tab === "ragas" && (
            ragasKpis ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
                  <StatCard label="Faithfulness" value={ragasKpis.avg_faithfulness != null ? ragasKpis.avg_faithfulness.toFixed(2) : "—"} />
                  <StatCard label="Answer relevancy" value={ragasKpis.avg_answer_relevancy != null ? ragasKpis.avg_answer_relevancy.toFixed(2) : "—"} />
                  <StatCard label="Context precision" value={ragasKpis.avg_context_precision != null ? ragasKpis.avg_context_precision.toFixed(2) : "—"} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                  <div className="card">
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Faithfulness trend (7d)</div>
                    {ragasTrend && ragasTrend.length ? (
                      <Bars data={ragasTrend.map((d) => ({ ...d, pct: Math.round((d.avg_faithfulness || 0) * 100) }))} labelKey="day" valueKey="pct" unit="%" />
                    ) : <p className="u-muted">No evaluated queries yet — runs every 30 min in the background.</p>}
                  </div>
                  <div className="card">
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Latest eval scores ({ragasKpis.total_evaluated} evaluated)</div>
                    <div style={{ paddingTop: 12 }}>
                      <MetricBar label="Faithfulness" value={ragasKpis.avg_faithfulness} />
                      <MetricBar label="Answer relevancy" value={ragasKpis.avg_answer_relevancy} />
                      <MetricBar label="Context precision" value={ragasKpis.avg_context_precision} />
                    </div>
                  </div>
                </div>
              </>
            ) : <p className="u-muted">Loading…</p>
          )}

          {tab === "pipeline" && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Recent ingestion runs</div>
              {pipelineLogs ? <DataTable columns={PIPELINE_LOG_COLS} rows={pipelineLogs.map((r) => ({ ...r, id: r.id }))} empty="No pipeline runs recorded yet." /> : <p className="u-muted">Loading…</p>}
            </>
          )}

          {tab === "querylog" && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Recent queries</div>
              {queryLog ? <DataTable columns={QUERYLOG_COLS} rows={queryLog} empty="No queries logged yet." /> : <p className="u-muted">Loading…</p>}
            </>
          )}

          {tab === "errors" && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Recent errors</div>
              {errorLog ? <DataTable columns={ERROR_COLS} rows={errorLog} empty="No errors logged — good sign." /> : <p className="u-muted">Loading…</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
