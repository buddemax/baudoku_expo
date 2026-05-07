# BBA Baudoku Design-System

## Ziel

Einfach, strukturiert, übersichtlich. Senior-tauglich (30+ Sachverständige, niedrige Tech-Affinität). Cross-Platform iOS + Android + Web (Expo SDK 54).

## Principles

- **Lesbarkeit zuerst.** Body 17pt, Touch-Targets ≥ 56pt, Kontrast WCAG AA Minimum (AAA für Body).
- **Eine Aufgabe pro Screen.** Klare Primär-Aktion, Sekundäres dezent.
- **Klares Wording.** Laienverständliches Deutsch mit Umlauten. Keine Tech-Begriffe wie „Outbox" oder „Sync" prominent.
- **Subtile Bewegung.** Haptik bestätigt Tap, Reanimated nur dort wo es Verständnis stützt.
- **Light + Dark.** Beide Themes über Token-System. System-Default mit Override-Persistenz.

## Token-Layer

Pfad: `src/theme/tokens/`

| Datei | Inhalt |
|-------|--------|
| `colors.light.ts` | Helle Farb-Palette (background, surface, text, primary, semantic …) |
| `colors.dark.ts` | Dunkle Farb-Palette, gleiche Schlüssel |
| `spacing.ts` | 0–80px Skala + Layout-Konstanten (touchTargetMin = 56) |
| `radii.ts` | xs/sm/md/lg/xl/pill |
| `typography.ts` | 17pt body, 24pt title, 32pt display u.a. |
| `shadows.ts` | none / card / raised / overlay |
| `motion.ts` | Reanimated-Easing + Dauer-Stufen |

`buildTheme(scheme)` baut das vollständige Theme. `ThemeProvider` injiziert es per Context. `useTheme()` zum Lesen.

## Komponenten

Pfad: `src/components/`

### Layout / Foundation
- `Screen` – SafeArea-Wrapper mit ScrollView, RefreshControl, KeyboardAvoiding
- `Surface` – Karten-Wrapper (variants: plain | card | sunken | muted)
- `VStack` / `HStack` / `Spacer` / `Divider` – Layout-Helfer
- `AppHeader` – Konsistenter Screen-Header mit Back + Trailing-Action

### Eingaben
- `Button` (primary | secondary | danger | ghost; sm | md | lg)
- `IconButton` (plain | soft | solid)
- `Input` mit Label, Help, Error, Adornments
- `ChoiceChips` – Pill-Filter
- `SegmentedControl`
- `ProjectDatePickerField` (feature-spezifisch)

### Feedback
- `Banner` (info | success | warning | error)
- `EmptyState`
- `LoadingBlock` / `FullscreenLoading`
- `Skeleton` (Reanimated-Pulse)

### Identifier
- `Badge`
- `ProjectStatusBadge`
- `Avatar`

### Navigation / Aktion
- `FAB` – Floating Action Button
- `Sheet` – Modal-Bottom-Sheet
- `ListItem`

### Haptik
Alle interaktiven Komponenten nutzen `expo-haptics`. Selection bei Tabs/Chips, Light bei Buttons, Medium bei FAB, Heavy bei Danger.

## Information-Architektur

Aktuell state-basierte Screen-Steuerung in `App.tsx` (`list | create | detail`). React Navigation ist installiert (`@react-navigation/*`, `react-native-screens`, `react-native-safe-area-context`) und unter `src/navigation/` skeletoniert für späteren Vollausbau.

### Screens
- **Login / PasswordRecovery** (Login mit Mail+Passwort, Reset-Link)
- **ProjectsList** – FlatList mit Cards, Suche, Sheet-Filter, FAB für Neu-Anlage
- **ProjectCreate** – Single-Form mit ChoiceChips
- **ProjectDetail** – Header-Card + 5 Workspace-Sections (Übersicht / Erfassen / Einträge / Pläne / Bericht), gewählt via SegmentedControl
- **OverviewTab** – Metriken + Plan-Hero (Tap = öffnet Pläne) + Quick-Actions + Sync-Status
- **CaptureTab** – Mangel-Form mit Foto-Aufnahme + Sprach-Aufnahme
- **EntriesTab** – Eintrags-Liste mit Sheet-Filter, Eintrag-Detail mit Fotos / Sprachnotizen
- **PlansTab** – Plan-Viewer mit Pinch/Pan/Tap-to-Marker (Reanimated + GestureHandler)
- **ReportTab** – Allgemeine Feststellungen, Fazit, Hinweise, Word-Generierung

## Wording-Inventar (alt → neu)

| Alt | Neu |
|-----|-----|
| Outbox | Wartet auf Upload |
| Sync wartet | Wartet auf Sync |
| Sync wiederholen | Sync jetzt erneut versuchen |
| Stammdaten | Projektdaten |
| Gutachtentyp | Art des Gutachtens |
| Word-Version erzeugen | Bericht als Word herunterladen |
| Marker Mitte | Marker mittig |
| Loeschen / Aenderung / Maengel | Löschen / Änderung / Mängel (Umlaute korrekt) |
| Bestaetigt | Bestätigt |
| Pruefung | Prüfung |

Duzen statt Siezen, kurze, klare Sätze.

## A11y-Checkliste

- [x] Touch-Targets ≥ 56pt (Buttons, IconButtons, FAB, ListItem, Header-Back)
- [x] Body-Text 17pt, Caption 15pt
- [x] `accessibilityRole="button"` auf allen Pressables
- [x] `accessibilityLabel` & `accessibilityState`
- [x] `accessibilityLiveRegion` auf Banner (assertive bei Error)
- [x] Kontrast WCAG AA in Light + Dark (siehe Token-Werte)
- [x] Keine Festen Farb-Hex-Werte in Komponenten – alles über Theme

## Test-Plan (Manuell)

Da keine Detox/Playwright-Infrastruktur im Repo existiert, manuell prüfen:

### Golden-Path Mangel erfassen
1. Login → Projekt öffnen → Tab „Erfassen"
2. Beschreibung eintippen
3. Foto aufnehmen
4. Sprachnotiz starten / stoppen
5. „Eintrag mit Fotos und Ton speichern" – erscheint in Einträge-Liste

### Plan + Marker
1. Tab „Pläne" → Plan hochladen
2. Eintrag in Einträge-Liste auswählen
3. Tab „Pläne" → Tap auf Plan → Marker erscheint
4. Pinch / Pan funktioniert
5. Marker-Liste zeigt Position

### Bericht
1. Tab „Bericht" → Feststellung anlegen, Fazit eintippen
2. „Bericht als Word herunterladen" → Version erscheint, Öffnen-Button funktioniert

### Offline
1. WLAN aus → Mangel erfassen → Banner „Wartet auf Upload"
2. WLAN an → Auto-Sync → Banner „Daten abgeglichen"

### Theme
1. iOS Settings → Display → Dark → App-Hintergrund wird dunkel
2. Zurück auf Light → wechselt zurück

## Empfehlungen für nächste Iteration

1. **React Navigation aktivieren.** Skeleton liegt in `src/navigation/`. Stack/Tabs ersetzen die `screen`-State-Maschine in `App.tsx`. Native Back-Gesten + Deep-Links.
2. **Plan-First-Capture.** Tap auf Plan ohne ausgewählten Eintrag → öffnet Erfassen-Sheet und legt Marker bei Speichern automatisch an dieser Position an.
3. **Detox-E2E.** Mit Expo dev-client und EAS Build für iOS-Simulator-Tests.
4. **Profil-Picker als Sheet.** Ab > 10 Bearbeitern werden ChoiceChips eng – auf Sheet mit Suche umstellen.
5. **Theme-Toggle in „Mehr"-Screen.** Aktuell Auto-System; manuelle Override sinnvoll für Außeneinsatz.
