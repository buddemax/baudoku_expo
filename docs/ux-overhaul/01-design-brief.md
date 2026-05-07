# Phase 1 — Design Brief

Date: 2026-05-07
Inputs: Phase 0 audit (`00-audit.md`), Design Context (`/.impeccable.md`), discovery answers.
Status: locked. Hand-off to Phase 2A (state extraction) + Phase 3 (design system).

---

## 1. Feature Summary

The Baudoku Expo app is a **field documentation tool for independent appraisers (Sachverständige)** producing formal building defect reports (Gutachten). On a 12.9"-class tablet on site, the inspector captures defects (text, voice, photo, plan marker) with offline-first persistence, then assembles and exports a defensible PDF report. Phone use is supported as a graceful collapse, not a parallel design.

This brief governs a multi-phase UX/UI overhaul lifting the app from current baseline (~54/100) to a tool that feels like calibrated equipment: precise, durable, calm.

---

## 2. Primary User Action

**Capture one defect, completely, in the smallest possible number of confident steps.**

Everything else (review, plans, report, sync) supports this loop. The capture moment is the highest-volume interaction (50–500× per project) and the first place where field data is created. Quality of capture determines quality of report.

Glance priority on each detail screen:
1. **Project status + sync state** (trust signal — first thing eyes land on)
2. **Defect count by severity** (scope at a glance)
3. **Active capture queue** (how many drafts not yet saved)

---

## 3. Design Direction

Brand voice — **precise · durable · calm** — translates to:

- **Surfaces** look like measured paper and anodized aluminum, not glass.
- **Type** reads like an instrument label or observation log, not a marketing site.
- **Motion** is functional only: state transitions, sync feedback, gesture affordances. No celebratory flourishes.
- **Color** is calibrated neutrals tinted toward a deep brand hue, with severity as the only loud color (used as data, not decoration).
- **Density** is generous — outdoor glare and gloved hands punish small targets and tight type.

**Light theme is primary** (sunlight readability). Dark theme available, AAA-pref body contrast on both.

**Reflex-rejected fonts** (per impeccable font_selection_procedure): no Inter / Plex / DM / Outfit / Fraunces / Newsreader / Crimson / Cormorant / Space Grotesk / Instrument family. Type pair to be selected in Phase 3 against `precise / durable / calm`. Working hypothesis: a **technical neogrotesque or geometric body** (e.g. ABC Diatype Mono / Söhne / Diatype / Fakt / GT America Mono / Space Mono is banned — search Pangram Pangram + Klim + ABC Dinamo) paired with a **light-friendly humanist or mechanical body**. Final pick deferred.

**Brand accent hypothesis:** deep low-chroma blue-graphite (oklch L≈0.32, C≈0.04, H≈245) — survives sunlight, photographs neutrally on PDF, does not steal attention from severity reds. Verify in Phase 3.

**Severity ramp (data colors):** info / low / medium / high / critical — must remain distinguishable on B/W laser print and for protan/deutan vision. Use both hue AND a second channel (icon shape or pattern) for double-encoding.

---

## 4. Layout Strategy

### Tablet (≥ 900px width — primary)

- **Master-detail at root.** Left rail = project list (always visible). Right pane = active project detail.
- **Detail screen has persistent left tab rail** (not horizontal segmented control). Tabs ordered by user loop frequency:
  `Erfassung · Pläne · Einträge · Bericht · Übersicht`
- **Capture pane** uses a **3-button capture bar** at top (Text · Sprache · Foto). Tap one → that primitive expands inline, others collapse. Plan-marker queue lives in a right-side companion panel when active.
- **Plans tab** uses full content area for the canvas; markers overlay; marker list collapses to a bottom drawer (swipe up to expand).

### Phone (< 900px)

- **Single-column stack**: list → detail → tab content.
- **Tab rail collapses** to a fixed top tab bar.
- **Capture bar** stays as 3 buttons; expansion takes the full screen height.
- **Plans tab** goes fullscreen on activation; back button to detail.

### Spatial system

- **4pt scale** (existing 0–12 spacing tokens are correct shape; rename to semantic names: `space-xs/sm/md/lg/xl/2xl/3xl`).
- **Density tier**: tablet uses generous; phone uses default; no compact tier (gloves).
- **Container queries** for the capture bar and severity badges (component-level responsiveness).
- **Touch target minimum**: 48dp on Android tablets in field gloves; 44dp acceptable on phone.

### Visual hierarchy

- **One eyebrow + one display + one body** per screen. No competing display sizes.
- Status pill always **top-right** of header. Severity counts always **left of the divider** below header.
- Defect cards are **flat with full borders** (1px hairline), tinted background, no left-stripe. Severity is encoded as an **icon + numeric chip**, not a colored stripe.

---

## 5. Key States

For each major surface define: default, empty, loading, error, success, edge.

### Project List
- **Default:** filtered/searchable list, FlatList virtualized, ProjectCardItem memoized.
- **Empty (zero projects):** action-led EmptyState — "Du hast noch keine Projekte. Lege dein erstes Projekt für eine Begehung an." + primary CTA.
- **Empty (filter mismatch):** show which filter narrowed results + reset chip.
- **Loading:** 3 skeleton ProjectCard placeholders (existing Skeleton primitive).
- **Error:** inline Banner with retry; offline cache shown if available with timestamp.
- **Edge — first launch, offline:** explain cache-first behavior in EmptyState.

### Project Detail (host shell)
- **Default:** persistent header (project name, status pill, severity counts), tab rail, active tab content.
- **Loading:** header renders from cache instantly; tab content gets DataState skeleton.
- **Error:** Banner per tab, never blocks header.
- **Edge — outbox has pending items:** sync pill shows count + tap-to-view sheet.

### Capture (Erfassung)
- **Default:** 3-button capture bar (Text / Sprache / Foto). One opens, others collapse.
- **Recording (voice):** recording indicator + waveform + cancel + done. No timer countdown (pressure-free).
- **Empty:** "Beginne mit der ersten Beobachtung. Tipp: Sprache geht am schnellsten." (calm, instructional).
- **Saving:** optimistic — defect appears in entries list immediately; sync pill counts it.
- **Error (e.g. mic permission denied):** inline guidance with system settings link.
- **Edge — multiple drafts open:** queue shows at right; "alle speichern" action.

### Plans (Pläne)
- **Default:** full-canvas image with pan/zoom, marker dots over image, list drawer at bottom.
- **Empty (no plans yet):** EmptyState — "Lade Grundriss oder Foto hoch, um Mängel zu verorten."
- **Loading large plan:** progressive image with low-res placeholder; never block gestures.
- **Marker placement:** crosshair feedback + haptic on drop; undo banner for 4s.
- **Edge — pending marker not yet synced:** marker rendered with subtle dashed outline + tooltip "noch nicht gespeichert".

### Entries (Einträge)
- **Default:** virtualized list, filter bar collapsible, detail panel right (tablet) or modal (phone).
- **Empty:** action-led — "Noch keine Einträge. Wechsle zur Erfassung."
- **Loading:** skeleton rows × 6.
- **Editing:** inline-edit per field; dirty indicator; auto-save on blur + manual save button.
- **Edge — outbox conflict:** show sync conflict banner with resolve action.

### Report (Bericht)
- **Default:** preview panel + edit panel; PDF assembly status.
- **Empty:** "Noch keine Mängel im Bericht. Erfasse zuerst Beobachtungen."
- **Generating PDF:** progress indicator; never modal-block.
- **Sent successfully:** Toast (top of screen) — "Bericht versendet · 14:32 · 12 Mängel · 24 Fotos".
- **Error:** Banner with retry + "Entwurf speichern".

### Sync / Outbox
- **Always-visible pill** in header: idle / syncing / pending count / error.
- **Tap pill → sheet** lists pending items, errors, last-success timestamp.

---

## 6. Interaction Model

- **Single tap** = primary action. **Long press** = secondary (multi-select, drag).
- **Haptic feedback**: selection (light) on tap, impact (medium) on save success, notification (soft) on sync transition. No haptics on scroll or list reach.
- **Optimistic UI everywhere**: defect appears in list before server confirms; sync pill is the truth source.
- **Navigation**: phone uses stack; tablet uses split-view with stack inside the right pane.
- **Gestures**: pan/pinch on plans; swipe-to-dismiss on sheets; pull-to-refresh on lists.
- **Forms**: zod schema per form; inline error per field on blur (not on every keystroke); summary banner on submit if any error remains.
- **Toast vs Banner**: Toast = transient confirmation (3–5s, top of screen, single line). Banner = persistent state (offline, sync error, unsaved). Alert = OS-only (mic/camera/location permission).
- **Loading**: skeleton > spinner. Spinner only for ≤500ms operations.
- **Empty states** teach the next action, never just say "nothing here".

### Performance contract
- Tap-to-feedback: ≤100ms.
- Screen transition: ≤220ms.
- Capture screen first paint: ≤300ms after navigation.
- 60fps sustained while scrolling 200-defect list on mid-tier Android tablet.
- Plans tab pinch-zoom: 60fps on 12MP plan images.

---

## 7. Content Requirements

### Voice & tone
- **du-form**, German.
- **Trade-precise** vocabulary: "Mangel", "Begehung", "Gewerk", "Befund", "Gutachten" — not generic UX phrasing.
- **Direct, observation-style** labels: "Mangel erfassen" not "Lass uns einen Mangel anlegen!".
- **Errors describe what + what to try**, not "Oops!" or "Etwas ist schiefgelaufen". Example: "Foto-Upload offline gespeichert. Wird beim nächsten Sync übertragen." — not "Fehler beim Hochladen".
- **No emoji** in product copy (clients/courts read these reports).

### Realistic data ranges
- **Defects per project**: 30–150 typical, 500 max.
- **Plans per project**: 3–10 typical.
- **Photos per defect**: 3–8 typical, 20 max.
- **Voice notes per project**: 5–30 typical.

### Microcopy registry (non-exhaustive — full pass in Phase 4)
| Surface | Replace | With |
|---|---|---|
| Detail tab labels | Verbal "Erfassen" + nominal "Übersicht" mix | All nominal: Erfassung · Pläne · Einträge · Bericht · Übersicht |
| Alert.alert "Eintrag loeschen?" | Broken umlaut | ConfirmSheet "Eintrag löschen?" + body explaining consequence |
| Empty list CTA | "Noch keine Projekte" | "Du hast noch keine Projekte. Lege dein erstes Projekt für eine Begehung an." |
| Login footer | `Server: {config.apiUrl}` | Hide unless `__DEV__` |
| Sync subtitle | 7 states crammed | Single status pill + sheet |

---

## 8. Recommended References

For implementation phases, consult these `/impeccable` reference files:
- **typography.md** — Phase 3 (selecting type pair against precise/durable/calm).
- **color-and-contrast.md** — Phase 3 (severity ramp + light-theme glare AAA contrast).
- **spatial-design.md** — Phase 4 (master-detail layouts, container queries for capture bar, persistent rails).
- **interaction-design.md** — Phase 4 (capture flow, form patterns with zod, optimistic UI).
- **motion-design.md** — Phase 5 (functional motion only, exponential easing, 220ms cap).
- **responsive-design.md** — Phase 6 (tablet → phone graceful collapse).
- **ux-writing.md** — Phase 4 (du-form, observation-style microcopy).

External references the design team should review (not banned):
- DIN 1451 / ISO 3098 lettering aesthetics
- Festool / Leica / Sennheiser product UI
- Architectural drawing legend conventions
- PlanRadar (pattern-only, not visual reference) — for offline + plan-marker patterns to match feature parity, not aesthetic.

---

## 9. Open Questions (resolved during build)

1. **Type pair final selection.** Hypothesis above; confirm in Phase 3 against actual brief words.
2. **Brand accent oklch values.** Hypothesis above (L≈0.32 C≈0.04 H≈245); test against PDF print, glare, AAA contrast.
3. **Severity ramp exact values.** 5 steps required; double-encode with icon shape.
4. **Master-detail breakpoint.** Audit suggested ≥900; verify against real iPad mini (744 portrait), 11" iPad (820), 12.9" iPad (1024). Likely tier at 744 (single-pane), 820 (compact split), 1024 (full split).
5. **PDF visual identity.** Inherits from screen design system. Specify in Phase 4 ReportTab work.
6. **Storybook screen scope.** Per primitive + per state matrix, dev-only route. Built in Phase 3.
7. **Offline outbox conflict UX.** Currently silent on conflict — needs explicit resolve flow. Phase 4 Entries work.

---

## Locked Constraints

- Stack: Expo 54 / RN 0.81 / React 19 / Reanimated 4 / Supabase / SQLite.
- Form validation library: zod (approved).
- Microcopy: du-form, German, trade-precise.
- Primary device: 12.9" tablet landscape + portrait. Phone graceful collapse.
- A11y: WCAG AA minimum, AAA preferred for body. accessibilityLabel + maxFontSizeMultiplier on every interactive primitive.
- Light primary theme; dark optional.
- No left-stripe borders, no gradient text, no glassmorphism, no AI-default fonts.
- Severity is the only loud color.

---

## Hand-off

- **Phase 2A — State extraction + monolith decomp.** Start immediately. Blocks Phase 2B (nav migration). Tests-first per `tdd-guide`.
- **Phase 3 — Design system upgrade.** Selects type pair + accent oklch + severity ramp; introduces Toast / SyncStatusPill / FormField (zod) / DataState / SeverityBadge / ConfirmSheet primitives; builds dev Storybook screen.
- **Phase 4** — per-screen polish, ordered by user-loop priority: Capture (hottest) → Plans → Entries → Report → Overview → ProjectList → ProjectCreate → Auth.
