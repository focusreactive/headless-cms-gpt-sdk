# The preset screens, and the picker on the translation screen

## Requirements / Task restatement

Build every screen the artboards draw: the preset list (collapsed and expanded), the
preset form (creating and editing, with its error and in-flight states), and the "Style
preset" select plus gear on the translation screen. Wire them to the data layer committed
in `674f88c`, whose far end is the fake.

**Out of scope, by the owner's word:** prompt composition. The chosen preset will be held
in state and will not reach the model — so after this step the panel looks finished and a
translation is not yet styled. That is a known, deliberate gap, not an oversight.

Also out: preset duplication (the artboards draw a copy button; it stays undrawn in code —
see the previous task record).

## No Phase 2 gate

The owner went to sleep having asked for the task to be closed autonomously, and approved
in advance: edit `Localization` directly, no prompt composition, commit locally in steps
without pushing. Every decision below therefore carries its rejected alternative so any one
of them can be overruled with a sentence.

## Phase 1 — what is there

| Path | Lines | What it is |
|---|---|---|
| `src/components/Localization/index.tsx` | 555 | the reducer, the localize flow, and ~250 lines of Slack debug posting. No tests |
| `src/components/Localization/modes/Story/index.tsx` | 320 | the translation form — where the artboards' screen 1 lives |
| `src/context/AppDataContext.ts` | 30 | `languages`, `spaceId`; provided inline at `pages/index.tsx:102` |

`mainReducer` wraps `reducer` and appends every action to `state.history`. That history is
posted to Slack on every localize, twice, for debugging — which is what makes the choice of
where new state goes a real decision rather than a preference.

**Risk: high.** It edits working code that has no tests, and that code is how the product's
one feature runs today. So: a test is required before anything here is called done, the
regression sweep is mandatory and evidenced, and the review at the end gets three angles.

## Decisions

| Decision | Chosen | Rejected, and why |
|---|---|---|
| Who owns which screen is showing | a `useState` in `Localization/index.tsx` | a `view` in `mainReducer`: every action lands in `history`, which is posted to Slack on each localize. Navigation is not part of a translation's story and would bloat every report |
| Where the chosen preset lives | `stylePresetId` in `LocalizationState`, with a `setStylePreset` action | a separate `useState`: the chosen preset **is** part of what a translation did, so it belongs beside `targetLanguageCode` — and in the history that report carries |
| Component split | `PresetPicker`, `PresetsPanel`, `PresetList`, `PresetForm` | one component taking a `view` prop: the list and the form share nothing but the panel frame, and a single file would carry both sets of state |
| How screens reach the data | they call `usePresets` themselves | threading props from `Localization`: three levels of threading for what a context already provides, and `modes/Story` already takes `state` and `dispatch` |
| Where the provider goes | `pages/index.tsx`, beside `AppDataContext.Provider` | inside `Localization`: the page root is where this project provides context, and following the existing idiom beats inventing a second place |
| What the fake starts with | two sample presets, one covering two languages | nothing: then only the empty-state artboard is reachable and none of the others can be looked at. Named in the code as the fake's sample data, and it leaves with the HTTP implementation |
| What the form's values hold | `voice` as `string[]`, mapped to `VoiceWord[]` by one function both the resolver and the submit use | `VoiceWord[]` in the form: `TagsInput` speaks `string[]`, so the mapping would land at the field and again at submit |

**New surface:** four components, each with its screens named in the artboards. `draftOf`,
one function turning form values into a `PresetDraft` (2 callers: the resolver and the
submit handler).

**Written contract? Yes** — each screen owes callers what it shows in each state and what
each control does, and none of that is in a signature. That puts Phase 3 on the
`/sp-red-test` path, with the artboards as the contract the blind authors are given.

**Escalate?** No. It spans two existing files and adds four components in one folder; the
seam it needs already exists and was built last step.

## Acceptance Criteria

| # | Criterion | How it is checked | Pre-flight |
|---|---|---|---|
| 1 | The list shows one row per preset with its "n / m" language count | named test | unit absent — the red run against stubs is the pre-flight |
| 2 | Expanding a row shows one line per space language, each marked configured or not set | named test | as above |
| 3 | Tapping a language line opens the form for that preset **and that language** | named test | as above |
| 4 | The star sets the default, and the call reaches the repository | named test asserting on what the fake received | as above |
| 5 | Deleting takes two presses, and the first alone removes nothing | named test | as above |
| 6 | Loading, failed-load, saving and failed-save each render their drawn state | named test | as above |
| 7 | The create form carries a language select, opening on the language being translated into | named test | as above |
| 8 | A validation error appears on its own field, and Save stays disabled | named test | as above |
| 9 | Editing a language of a preset that has others leaves the others untouched, end to end through the screen | named test asserting on the fake's document | as above |
| 10 | The picker on the translation screen lists the presets and opens on the default | named test | as above |
| 11 | The translation flow still works: `localize` sends what it sent before | named test over the existing component | **must be written before the edit — it is the regression guard** |
| 12 | The 367 committed checks stay green | `yarn test` | **367 passing now, must stay** |
| 13 | No new type errors | `npx tsc --noEmit` | **exit 0 now, must stay** |

## Pre-flight

- `npx tsc --noEmit` → exit 0 · invariant · must stay
- `yarn test` → 367 passed · invariant · must stay
- criteria 1–11 name units that do not exist; their pre-flight is the red run

## Risk notes

- **jsdom has no layout.** Nothing here can check the 300px panel width, the truncation of
  "Portuguese (Brazil)", or scrolling — the very things flagged to the designer. They are
  eyeballed once against the running plugin, and no criterion claims otherwise.
- **Colour is not checked.** The owner asked that the armed delete differ by fill and not
  only by wording. A test asserting a colour is either meaningless or brittle, so the
  checks cover the wording and that a second press is required; the fill is eyeballed.
- **Carried forward, not fixed: the armed delete replaces the whole footer**, Cancel
  included, so someone who armed it by accident sees no way out until the two-step timer
  disarms. Drawn that way, and the owner said not to redo the design, so it ships as drawn.
  The one-line fix — keep Cancel, let Delete take Save's width — is here for the morning.
- The picker holds a preset id that goes nowhere until prompt composition lands.

## Human choices

- **19 September 2026** — edit `Localization` directly rather than building the screens
  standalone; no prompt composition; commit locally in steps, do not push.
- **19 September 2026** — no preset duplication, though the artboards draw the button.

## Review log

- (empty)
