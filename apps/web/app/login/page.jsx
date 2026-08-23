"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { login } from "@/lib/api";

// Static knowledge-base snapshot — update by hand after a pipeline run
// (see /api/stats for current live numbers). Last updated 2026-06-20.
const KB_SNAPSHOT = { reviews: 15045, articles: 4472, videos: 269, apps: 21 };

const FEATURES = [
  {
    label: "Reviews, news, video & web — one knowledge base",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="M7 16l4-6 4 3 5-8" />
      </svg>
    ),
  },
  {
    label: "Hybrid retrieval, ranked and filtered by category",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" />
      </svg>
    ),
  },
  {
    label: "Every answer cited back to its source chunk",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /><path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Enter your username and password to continue.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(username.trim(), password);
      router.push("/chat");
    } catch (err) {
      setError(err.message || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <section className="login-hero">
        <div className="login-hero__brand">
          <div className="login-hero__mark">⚡</div>
          <div>
            <div className="login-hero__brand-name">Home Energy &amp; EV Research</div>
            <div className="login-hero__brand-sub">Competitive intelligence workspace</div>
          </div>
        </div>

        <div>
          <h1 className="login-hero__headline">
            Ask anything about the <em>EV &amp; energy</em> app market.
          </h1>
          <p className="login-hero__subhead">
            Reviews, news, videos and official websites across our tracked EV charging and
            home-energy apps — distilled into cited, sourced answers in seconds.
          </p>
        </div>

        <ul className="login-hero__features">
          {FEATURES.map((f) => (
            <li className="login-hero__feature" key={f.label}>
              <span className="login-hero__feature-icon">{f.icon}</span>
              {f.label}
            </li>
          ))}
        </ul>

        <div className="login-hero__stats">
          <div>
            <div className="login-hero__stat-value u-tabular">{KB_SNAPSHOT.reviews.toLocaleString()}</div>
            <div className="login-hero__stat-label">App reviews</div>
          </div>
          <div>
            <div className="login-hero__stat-value u-tabular">{KB_SNAPSHOT.articles.toLocaleString()}</div>
            <div className="login-hero__stat-label">News articles</div>
          </div>
          <div>
            <div className="login-hero__stat-value u-tabular">{KB_SNAPSHOT.videos.toLocaleString()}</div>
            <div className="login-hero__stat-label">Videos</div>
          </div>
          <div>
            <div className="login-hero__stat-value u-tabular">{KB_SNAPSHOT.apps}</div>
            <div className="login-hero__stat-label">Apps tracked</div>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__head">
            <h2 className="login-card__title">Welcome back</h2>
            <p className="login-card__sub">Sign in to your research workspace</p>
          </div>

          <form className="login-card__form" onSubmit={submit}>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              placeholder="you@company.com"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              error={error}
              placeholder="••••••••"
            />
            <Button type="submit" variant="primary" block disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <p className="login-card__footnote">Access is restricted to authorized analysts.</p>
        </div>
      </section>
    </div>
  );
}
