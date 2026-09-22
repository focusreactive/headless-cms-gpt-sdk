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

## Result

| # | Criterion | Outcome |
|---|---|---|
| 1 | one row per preset with its count | met |
| 2 | expanding shows a line per space language, marked | met |
| 3 | a language line opens the form for that preset **and** that language | met, and guarded twice — the second guard exists because a mutation showed the first did not cover which of the two codes crosses |
| 4 | the star sets the default and the call reaches the repository | met |
| 5 | deleting takes two presses | met |
| 6 | loading, failed-load, saving and failed-save each render | met |
| 7 | the create form's language select opens on the language being translated into | met |
| 8 | a validation error lands on its own field, Save stays disabled | met |
| 9 | editing one language leaves the preset's others untouched, end to end | met |
| 10 | the picker lists the presets and opens on the default | met |
| 11 | the translation flow still works | met — 14 reducer checks, recorded from the code before it was touched |
| 12 | the committed checks stay green | met — 536 of 536 |
| 13 | no new type errors | met — `npx tsc --noEmit` exit 0 |

Beyond the criteria: **`npx next build` succeeds**, which is the only evidence here that the
whole app still compiles with the wiring in it — jsdom does not prove that.

### The red runs

| Screen | Checks | Red against the stub | Green |
|---|---|---|---|
| list | 39 | 39 | 39 |
| picker | 32 | 32 | 32 |
| form | 79 | 79 | 79 |

Every failure in every red run was the stub's own `not implemented — red run`; no
`TypeError`, no assertion mismatch, no timeout.

### What the checks caught that the red run could not

Four defects, each real rather than a test artefact:

- a **closed row kept its language buttons in the DOM**, focusable and clickable at zero
  height — MUI's `Collapse` does not unmount, so the rows render conditionally now;
- **"arming one row's delete disarms any other" rested on `mousedown`**, which a mouse
  sends and a keyboard never does: anyone reaching the next row by tab would have left a
  destructive control armed. Which row is armed is a fact about the list, so the list holds
  it;
- **MUI swallows an attempt to add a word already in the list** — it never reaches
  `onChange` at all — so the attempt is caught on the Enter that makes it;
- the **character counter and the over-the-limit sentence were one thing**, which showed
  the warning before the editor had left the field.

### What the mutations caught that the checks could not

Fifteen mutations over the three screens; twelve reddened only their own group. Three
reddened nothing:

- **the form's draft carried an unnormalised locale** — saving a preset for `pt-br` would
  have written the key `pt-br` while the translation reads `pt_br`. The exact class of bug
  `localeKey` exists to prevent, on the write path, and only a hyphenated language can see
  it;
- **which code the list hands the form** — the blind author had deliberately pinned nothing
  here, because the contract was silent when they wrote and I decided it afterwards;
- one that turned out to be a **false alarm**: swapping `wanted` for `value` inside the
  picker's `resolveStyle` call reddens nothing because, under the guards around it, the two
  expressions agree. Reported as equivalence, not as a gap.

Closed by `src/preset/screens.guards.test.tsx`.

### And one the guards themselves caught

Writing the guard for the first of those exposed a defect no check and no mutation had
reached: **`useForm` takes its defaults at mount and never again**, so a form mounted while
the settings were still loading captured blanks — an empty Name for a preset that has one,
with Save disabled by that emptiness, for as long as the screen stayed open. The fields are
their own component now and mount only once the settings are there.

The blind author's report had said, of prefilling: *"ни одна проверка на предзаполнение не
опирается"* — no check of theirs relied on it, because the contract did not require it. The
defect was exactly there. The contract requires it now, and two guards hold it.

### Two gaps in the kit the design required

`TagsInput` could not carry the drawn placeholder, and MUI's own chips give their delete
control no accessible name at all — a screen reader met one unlabelled button per word.
Both fixed where the gap was, in `src/ui/TagsInput.tsx`.

`Disclosure`'s `$label` was widened to a node in an earlier commit for these rows; the rows
turned out to need separate buttons inside their summary, which one `ButtonBase` cannot
hold, so that widening is now unused. Left as it is — it is strictly more general and the
Preview disclosure still uses the prop — and recorded here rather than quietly kept.

### Not done, by decision

- **prompt composition.** The chosen preset is held in state and reaches nothing. After
  this step the panel looks finished and a translation is not yet styled;
- **preset duplication**, drawn on the list rows and deliberately not built;
- the two states only an eye can judge: the 300px panel at real width, and the armed
  delete's fill. No criterion claims either.

## Open, and moved here out of the code

**What the picker should say for a preset that has been deleted.** The field shows
"No preset", because a preset that was not read cannot be named; the sentence below it
still reads "No French settings in this preset", which is about what was asked for. The two
are each defensible and together slightly incoherent, and the right wording for a deleted
preset is a design question. It was a paragraph inside `PresetPicker.tsx` until the comment
audit pointed out that an open question in code is a TODO nobody signed. It lives here now.

**A preset chosen before the settings finish loading does not show on screen** until they
arrive — the field reads "No preset" in the meantime. The choice is not lost; it is in the
reducer. Noticed by the comment auditor while reading, and left as it is: naming a preset
we have not read is the alternative, and it is worse.

## The regression sweep

Mandatory here, because Phase 1 called this high risk: it edits working code that has no
tests and carries the product's one feature. Every surface the change touched, grepped for
its call sites, and each one read:

| Surface | Call sites | Where |
|---|---|---|
| `TagsInput` | 1 | `PresetForm.tsx` (plus the barrel) |
| `useTwoStepConfirm` | 2 | `PresetForm.tsx`, and `PresetList.tsx` for the constant only |
| `DEFAULT_TIMEOUT_MS` (newly exported) | 1 | `PresetList.tsx` |
| `LocalizationState` | 2 | `modes/Story/index.tsx`, the baseline test |
| `LocalizationAction` | 1 | `modes/Story/index.tsx` |
| `mainReducer`, `INITIAL_STATE` (newly exported) | 1 each | the baseline test, and nothing else |
| `Disclosure` | 1 | `PresetForm.tsx` (plus the barrel) |
| `PresetChoice` | 2 | `Localization/index.tsx`, `PresetPicker.test.tsx` |

Nothing outside this change consumes any of them: every new export has exactly the callers
it was added for, and the two pre-existing types kept the two they had. The only widened
surface with no caller is `Disclosure`'s `$label`, recorded above.

`npx next build` → **Compiled successfully**, with Next's own lint and type pass. That is
the one check here that covers the whole app rather than a component in jsdom.

## The comment audit

31 comment blocks judged by a fresh reader, plus 2 it said were missing. Its verdict on the
whole change was **too dense** — 119 comment lines over 903 of code — with a diagnosis
worth keeping: the inline comments were fine at 0.25 per ten lines, and the weight was all
in docblocks, 96 lines over 18 exported symbols. *"Не «код не объясняет себя», а «в
докблоки переехал протокол задачи»"* — the design arguments and the plans for later steps
had migrated out of this file and into the source.

Applied: 13 deleted, 11 shortened, 2 replaced by code — a named `COUNTER_FROM` for the bare
`400`, and `DEFAULT_TIMEOUT_MS` exported from `useTwoStepConfirm` so the list imports the
number instead of a comment promising it matches. 2 additions it asked for: `newPresetId()`,
which gives the minting's two magic numbers a name, and `saved()`, because `'unchanged'`
counting as success is not obvious from the value names.

Three survived, all of them one line about someone else's library and each with a deletion
test the auditor wrote out: MUI swallowing a duplicate commit; MUI putting its own
`onClick` on whatever is handed to `deleteIcon`; and `TagsInput`'s `value` having to stay
required, which is a rule TypeScript cannot hold.

**One verdict refused, visibly.** It proposed renaming `onDone` to `onClose` so the comment
listing "saved, cancelled, or deleted" would have nothing left to say. Declined: `onClose`
reads as dismissal, and the callback also fires on a save that landed, which is the case
most worth not hiding. The comment was shortened instead, to *"Called on any way out of the
form, a save included."*

## Human choices

- **19 September 2026** — edit `Localization` directly rather than building the screens
  standalone; no prompt composition; commit locally in steps, do not push.
- **19 September 2026** — no preset duplication, though the artboards draw the button.

## Review log

**19 September 2026 — fresh-eyes review of `9629d75..HEAD`.** One defect, and a destructive
one:

The form has two two-step mechanisms and they could cross. Edit a field, press Delete once,
then leave — the discard prompt takes the footer and *hides* the armed delete without
ending it. Press "Keep editing" and the footer comes back as a lone
**"Delete for all languages?"**. It is the only control on screen, so pressing it is the
obvious thing to do, and it is the second press: the whole preset goes, every language of
it.

A real mouse hides this — `useTwoStepConfirm` disarms on a `mousedown` outside its element,
and the back arrow is outside — but a keyboard sends no `mousedown`, which is the same
class of fault the list had and the same reason it was moved there. Fixed by ending the
arming when the leaving flow starts, guarded by a check written red against the broken code
first.

The reviewer also ruled out, so a later pass need not: the voice cap's silence on an
untouched field and the duplicate note persisting until blur (both specified); `minted` and
the read-once defaults (`PresetsPanel` never swaps one form target for another under a
mounted form); the list's timer (cleaned up on change and unmount); the fake built once;
and `describeStyle` / `counterOf` for doubled spaces, missing stops and negative counts.
