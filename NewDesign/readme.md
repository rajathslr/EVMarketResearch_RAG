# Volt — Home Energy & EV Research Design System

A clean, utilitarian design system for a RAG competitive-intelligence app
covering North American EV charging and home-energy / prosumer apps.
Built to be Streamlit-friendly: open-source fonts, no exotic dependencies.

## Foundations
- **`styles.css`** — all tokens (`:root` custom properties) + base component CSS.
  - Color: white bg, `--surface` grey, `--border`, indigo `--accent`, dark navy sidebar, role/semantic colors.
  - Type: system stack by default; `[data-font="plex"]` (IBM Plex Sans) and `[data-font="source"]` (Source Sans 3) alternates.
  - **Theming via data-attributes** on any container:
    - `data-accent` → `indigo | violet | teal | blue | emerald | amber`
    - `data-density` → `comfortable` (default) | `compact`
    - `data-font` → `system | plex | source`
- Cards in the **Design System** tab: Colors, Typography, Spacing & elevation, and live component galleries.

## Components (`components/`)
Each is a React function component (`.jsx`) + types (`.d.ts`). Read them off the
compiled bundle: `const { Button } = window.VoltEVEnergyResearchDesignSystem_1e451b`.

`Button · TextField · Select · Badge · Pill · Card · Avatar · Toggle · Slider ·
ChatBubble · Expander · SourceChunk · FeedbackBar · NavItem · ExamplePill ·
StatCard · Tabs · DataTable`

`ChatBubble` renders a string child as markdown (headings, lists, tables, code).
`NavItem`, `Toggle`, and `Slider` adapt to the dark sidebar inside an `.on-dark` ancestor.

## Templates (`templates/`)
Copy-ready starting screens (Design Components). Each loads the system via its
sibling `ds-base.js`.
- **Login** — centered sign-in card with inline error state.
- **Main Chat** — two-panel research chat: dark sidebar (recent chats + search settings) and the RAG conversation with markdown answers, source citations, and feedback.
- **Admin Portal** — role-gated 5-tab portal (Overview, Data Sources, Automation, Run Logs, Users).

Every template exposes `accent`, `font`, and `density` tweaks (the Admin and Chat
add `role` / `chatWidth`).
