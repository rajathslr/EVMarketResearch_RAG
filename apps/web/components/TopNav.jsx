"use client";

import Link from "next/link";
import { Badge } from "@/components/Badge";

const LINKS = [
  { href: "/chat", label: "Chat" },
  { href: "/admin", label: "Admin Portal" },
  { href: "/observability", label: "Observability" },
];

/** TopNav — shared header for non-chat pages: brand, cross-page nav, role badge. */
export function TopNav({ active, role = "superadmin" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, flex: "none", borderRadius: 9, background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Home Energy &amp; EV Research</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Knowledge base &amp; pipeline control</div>
        </div>
      </div>

      <nav style={{ display: "flex", gap: 4, marginLeft: 8 }}>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={"btn btn--sm " + (active === l.href ? "btn--subtle" : "btn--ghost")}
            style={{ textDecoration: "none" }}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div style={{ marginLeft: "auto" }}>
        <Badge role={role} />
      </div>
    </div>
  );
}
