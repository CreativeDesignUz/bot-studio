# Design QA

- Source visual truth: `/var/folders/w8/wdbhgrsx1l3_yqqgg3gw0_g00000gn/T/codex-clipboard-01390854-79de-448d-b56b-45ccf063f26f.png` (830 × 1276 px).
- Implementation: `http://127.0.0.1:4173/onboarding` and `http://127.0.0.1:4173/onboarding?preview=created`.
- Viewports checked: 390 × 844 CSS px and 1440 × 1000 CSS px in the Codex in-app Browser.
- States checked: initial bot setup, bot-created confirmation, and transition to first-item creation.
- Full-view evidence: both reference and implementation were opened at original/mobile scale; the implementation was additionally captured at desktop width.
- Focused comparison: success marker, status badge, capability rows, white-card treatment, spacing, radii, typography hierarchy, and persistent actions.

## Findings and fixes

- P1: the old journey presented an empty catalogue before the user had configured and seen the bot. Fixed by separating the journey into four explicit stages: setup, created, first item, ready.
- P1: saving the first item could create a second bot record. Fixed by returning and reusing `botId`; subsequent saves update the owned bot and insert only the catalogue item.
- P2: the confirmation screen did not make the completed base visible. Fixed by adding a Mini App preview with the chosen name, description, colors, logo, and template capabilities.
- P2: logo selection had no production persistence path. Fixed with a validated bot-owned upload route and a Supabase Storage bucket migration.
- P2: preview-only state initially caused a hydration mismatch. Fixed by reading `preview=created` through `useSearchParams`; no new mismatch appeared after reload.
- Visual comparison: the implementation retains the source's pale neutral background, white bordered cards, violet icon surfaces, green completion language, generous spacing, and rounded action area while adapting the composition to desktop and mobile.

## Interaction verification

1. The initial screen shows bot type, logo, name, description, primary/secondary colors, and live preview before creation.
2. The created screen clearly confirms that the base is saved and lists the prepared sections.
3. Activating “Начать работу” advances to step 3 and displays the correct first-item form for the selected template.
4. “Изменить настройки” returns to the setup screen and updates the same bot rather than creating another one.
5. Mobile actions remain reachable without covering the content; desktop content stays centered with a visible progress rail.

## Verification history

1. Mobile created-state comparison at 390 × 844: passed after responsive spacing and action-bar adjustments.
2. Desktop created-state comparison at 1440 × 1000: passed with preview and next-step card presented side by side.
3. Keyboard activation of “Начать работу”: passed and transitioned to first-item entry.
4. Production build and lint: passed; remaining `<img>` advisories are non-blocking and apply to local/blob or remote user-provided images.

final result: passed
