"""
Shared sidebar navigation — imported by every page so navigation is consistent.
Uses st.page_link() for session-preserving routing, JS to fix text colour on
dark sidebar (Streamlit's light theme forces dark text otherwise).
"""
from pathlib import Path
import streamlit as st
import streamlit.components.v1 as components


def render_sidebar_nav():
    """Call inside `with st.sidebar:` on any page."""
    display_name = st.session_state.get("name", "")
    username     = st.session_state.get("username", "")
    role         = st.session_state.get("role", "user")

    # ── Volt tokens + sidebar base styles ────────────────────────────────
    _volt_css = (Path(__file__).parents[2] / "NewDesign" / "styles.css").read_text(encoding="utf-8")
    st.markdown(f"<style>{_volt_css}</style>", unsafe_allow_html=True)

    st.markdown("""
    <style>
    [data-testid="stSidebar"] {
        background-color: #0f172a !important;
        border-right: 1px solid #1e293b !important;
        min-width: 220px !important; max-width: 220px !important;
    }
    [data-testid="stSidebar"] > div:first-child { padding: 0 !important; }
    [data-testid="stSidebarNav"] { display: none !important; }

    /* page-link container reset */
    [data-testid="stPageLink"] {
        background: transparent !important;
        border: none !important;
        padding: 2px 8px !important;
    }

    .sb-nav-label {
        font-size: 11px; font-weight: 600; letter-spacing: .06em;
        text-transform: uppercase; color: #64748b;
        padding: 12px 10px 4px; display: block;
    }
    </style>
    """, unsafe_allow_html=True)

    # ── Brand ─────────────────────────────────────────────────────────────
    st.markdown("""
    <div style="display:flex;align-items:center;gap:10px;padding:18px 16px 14px;
                border-bottom:1px solid #1e293b;">
        <div style="width:34px;height:34px;flex:none;border-radius:9px;background:#4f46e5;
                    display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;">⚡</div>
        <div style="min-width:0;">
            <div style="font-weight:700;font-size:14px;line-height:1.2;color:#e2e8f0;">Home Energy &amp; EV</div>
            <div style="font-size:11px;color:#64748b;line-height:1.3;">Competitive intelligence</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # ── Navigation — st.page_link keeps session state alive ──────────────
    st.markdown('<span class="sb-nav-label">Navigation</span>', unsafe_allow_html=True)
    st.page_link("app.py",                    label="Chat",          icon="💬")
    if role in ("superadmin", "superuser"):
        st.page_link("pages/1_Admin_Portal.py", label="Admin Portal", icon="⚙️")
    st.page_link("pages/2_Observability.py",  label="Observability", icon="📊")

    # JS: fix inactive page-link text colour — CSS alone can't beat emotion styles
    components.html("""
    <script>
    (function() {
        function fix() {
            try {
                var doc = window.parent.document;
                doc.querySelectorAll('[data-testid="stPageLink"]').forEach(function(wrap) {
                    wrap.querySelectorAll('span, p, div, a').forEach(function(el) {
                        el.style.setProperty('color', '#94a3b8', 'important');
                        el.style.setProperty('font-size', '13px', 'important');
                        el.style.setProperty('font-weight', '500', 'important');
                    });
                    wrap.addEventListener('mouseenter', function() {
                        wrap.querySelectorAll('span, p, div, a').forEach(function(el) {
                            el.style.setProperty('color', '#e2e8f0', 'important');
                        });
                    });
                    wrap.addEventListener('mouseleave', function() {
                        wrap.querySelectorAll('span, p, div, a').forEach(function(el) {
                            el.style.setProperty('color', '#94a3b8', 'important');
                        });
                    });
                });
            } catch(e) {}
        }
        fix();
        new window.parent.MutationObserver(fix).observe(
            window.parent.document.body, {childList: true, subtree: true}
        );
    })();
    </script>
    """, height=0)

    # ── User block ────────────────────────────────────────────────────────
    _role_badge = {"superadmin": "badge--indigo", "superuser": "badge--green", "user": "badge--grey"}
    _role_label = {"superadmin": "Superadmin",    "superuser": "Superuser",    "user": "User"}
    if display_name:
        st.markdown(f"""
        <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
                    border-top:1px solid #1e293b;margin-top:8px;">
            <div class="avatar" style="background:#4f46e5;color:#fff;">{display_name[0].upper()}</div>
            <div style="min-width:0;flex:1;">
                <div style="font-size:13px;font-weight:600;color:#e2e8f0;white-space:nowrap;
                            overflow:hidden;text-overflow:ellipsis;">{display_name}</div>
                <div style="font-size:11px;color:#64748b;">@{username}</div>
            </div>
            <span class="badge {_role_badge.get(role, 'badge--grey')}" style="font-size:10px;">
                {_role_label.get(role, 'User')}
            </span>
        </div>
        """, unsafe_allow_html=True)
