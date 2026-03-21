# Changes in `test/ui-architecture-changes` branch

> Branch off: `main`
> Purpose: Replicate the CAT 2023 exam UI (digialm.com) as closely as possible, fix in-test bugs, and update component styles.

---

## 1. Pre-Test Instructions Page (`Instructions.jsx` + `Instructions.css`)
**Full rewrite** to match the official CAT 2023 instructions screen (digialm.com) pixel-accurately.

- Two-page layout controlled by `page` state (1 or 2)
  - Page 1 — section bar shows **"Instructions"**; contains General Instructions (items 1–13) with palette legend
  - Page 2 — section bar shows **"Other Important Instructions"**; contains items 1–8, Declaration text, checkbox, and Begin button
- **Palette symbols** with correct CAT shapes:
  - Not Visited: white square with gray border
  - Not Answered / Answered: pentagon/shield shape via CSS `clipPath`
  - Marked / Answered+Marked / Marked(no eval): circles in varying purples
- **IIM logos strip**: circular colored badges for all 18 IIMs
- **Candidate panel** (right): SVG avatar + candidate name in blue
- **Navigation buttons**: `‹ Previous` | `Next ›` | `I am ready to begin` (blue, disabled until checkbox checked)
- **Footer**: `Version : 17.07.00`
- Font: Georgia serif throughout; section heading bar in light blue `#b8d4e8`; no italic text

---

## 2. In-Test Instructions Modal (`Test.jsx` + `Test.css`)
Replaced the minimal modal with a **full scrollable CAT-style instructions modal**.

- Blue header bar with "Instructions" title and Close button
- Timer warning note at top in blue bold
- Complete General Instructions (items 1–13) with palette legend
- "Other Important Instructions" inline heading + all 8 items
- Section table (VARC / DILR / QA)
- Max height `90vh` with `overflow-y: auto` so it scrolls

---

## 3. Palette Symbol Shapes (`Test.jsx`, `QuestionPalette.jsx`)
Updated `PALETTE_STYLES` to match correct CAT exam icon shapes:
- `not_answered` (red) and `answered` (green): pentagon via `clipPath: polygon(0% 0%, 100% 0%, 100% 68%, 50% 100%, 0% 68%)`
- `marked`, `answered_marked`, `marked_eval`: circles (`borderRadius: 50%`) in varying purple shades

---

## 4. IIM Logos Strip in Test Page (`Test.jsx`, `Test.css`)
- Replaced inline JSX-rendered colored circle badges with a single `<img src="/iim-logos.png">` for a cleaner, accurate strip
- Added `public/iim-logos.png`

---

## 5. Bug Fix — Passage not showing on all questions in a group (`Test.jsx`)
**Root cause**: The backward-walk passage resolution used `q.question_type !== 'RC'` as a stop condition, but all questions in the DB have `question_type = 'MCQ'` or `'TITA'` — never `'RC'`. This caused the walk to break after one step, so only Q1 and Q2 of a 4-question RC group showed the passage.

**Fix**: Built a `passageIdMap` (`passage_id → passage_text`) at load time using all questions across all sections. Any question now resolves its passage via `passage_id`, regardless of whether its own `passage` field is populated.

---

## 6. Bug Fix — Save & Next should clear Mark for Review (`Test.jsx`)
**Problem**: When a question was in `answered_marked` state (blue + orange border) and the user clicked **Save & Next**, it stayed `answered_marked` instead of going to `answered` (green).

**Fix**: `handleSaveNext` now always sets `status: 'answered'` and `marked_for_review: false`, clearing the mark flag on explicit save.

---

## 7. Component Style Overhauls
General visual updates to align with the CAT exam aesthetic:
- **`QuestionCard.jsx` / `.css`**: Passage panel layout, marks bar, scroll buttons, RC two-column layout
- **`QuestionPalette.jsx` / `.css`**: Section summary legend, palette grid, submit button styling
- **`Calculator.jsx` / `.css`**: Updated calculator UI
- **`Test.css`**: Major expansion — brand bar, logos strip, info bar, section tabs, timer, question area, action bar, all modal classes, interrupt warning, confirm dialog, version footer
- Minor tweaks to `Analytics.css`, `Home.css`, `Login.css`, `Profile.css`, `Results.css`, `Review.css`, `SectionTabs.css`, `index.css`

---

## Files Changed (19 total)
| File | Change |
|------|--------|
| `public/iim-logos.png` | New — IIM logos image |
| `src/pages/Instructions.jsx` | Full rewrite — CAT 2023 replica |
| `src/pages/Instructions.css` | Full rewrite — CAT 2023 styles |
| `src/pages/Test.jsx` | Major update — bugs fixed, modals, palette shapes |
| `src/pages/Test.css` | Major expansion — all test UI classes |
| `src/components/QuestionCard.jsx` | Updated for RC passage panel |
| `src/components/QuestionCard.css` | Restyled |
| `src/components/QuestionPalette.jsx` | Updated palette shapes + legend |
| `src/components/QuestionPalette.css` | Restyled |
| `src/components/Calculator.jsx` | Updated |
| `src/components/Calculator.css` | Restyled |
| `src/pages/Analytics.css` | Minor |
| `src/pages/Home.css` | Minor |
| `src/pages/Login.css` | Minor |
| `src/pages/Profile.css` | Minor |
| `src/pages/Results.css` | Minor |
| `src/pages/Review.css` | Minor |
| `src/components/SectionTabs.css` | Minor |
| `src/index.css` | Minor |
