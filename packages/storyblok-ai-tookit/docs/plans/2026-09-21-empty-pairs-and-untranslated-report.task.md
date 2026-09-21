# Empty values out of the batch, and a findable untranslated report

Branch `feat/ui-kit` (draft PR #38) · package `storyblok-ai-sdk`, with one consumer in `storyblok-ai-tookit`

## Requirements / Task restatement

Two defects found live today while translating a real Xweather page.

**D-1.** `collectPairs` sends empty values to the model. The `hero` component's `title` is
empty on that page (its text lives in a sibling `text` field), the schema marks `title`
translatable, so an empty string goes out, comes back unanswered, and is reported as a
failure. On a client page with a dozen unfilled optional fields the notice reads
"Translated, except 12 field(s)" and looks broken while nothing is wrong.

**D-2.** The untranslated report carries the source *text* and not the *path*, so the user
saw literally `Translated, except 1 field(s), which kept the original text: ""`. With an
empty source there is nothing left to identify the field by.

Contracts and red tests already exist (`/sp-red-test` ran first); this task is the
implementation. **The tests are input and may not be rewritten to fit the code.**

## Phase 1 — Investigation

**Files**

| File | Part |
|---|---|
| `src/features/localization/collectPairs.ts` | D-1 — contract written, no filter |
| `src/features/localization/untranslatedFields.ts` | D-2 — contract + stub, **new** |
| `src/features/localization/localizeStory/index.ts:199-204` | D-2 — where the key is discarded |
| `packages/storyblok-ai-tookit/src/components/Localization/index.tsx:22` | the consumer, `untranslatedNotice` |

**Data flow.** story → `collectFields` → `collectPairs` → `splitIntoBatches` →
`translateBatch` → `translateInBatches` returns `{ translations, missing }` →
`applyTranslations` returns `{ story, unparsedBlockKeys }` → `localizeStory` assembles the
report → the toolkit renders the notice.

**The key is already there and is thrown away.** `translateInBatches` returns
`missing: TranslationPair[]` — `[key, text]` pairs. `localizeStory` destructures past it:
`missing.map(([, sourceText]) => …)`. D-2 is not about recovering a path, it is about
stopping its loss.

**Precedent.** The habit in this package is a small pure module, a doc-comment contract
above the exported type, and a colocated `*.test.ts`. Both fixes sit inside it exactly;
`withoutMarkers` already exists for stripping markers. No new pattern is needed.

**Measured facts that decide the design**

| Character | `.trim()` removes it? |
|---|---|
| space, tab, newline | yes |
| non-breaking space `U+00A0` | **yes** |
| BOM `U+FEFF`, ideographic `U+3000` | yes |
| zero-width space `U+200B`, ZWNJ `U+200C`, ZWJ `U+200D` | **no** |

So the contract clause as written ("every kind of space a document can carry, the
non-breaking one included") is satisfied by a plain `.trim()`. Zero-width characters are
a separate decision — and not a hypothetical one: this very space carried a **186,000
character** watermark built from `U+200B`, `U+200C`, `U+200D` and `U+FEFF`, which is what
pushed the summary request over the model's per-minute ceiling.

**Blast radius.** `localizeStory` is exported publicly (`src/features/index.ts`) and the
SDK is published to npm as `@focus-reactive/storyblok-ai-sdk`. Changing the shape of
`untranslated` is a **breaking change to a published API**. The only consumer in this
repository is the toolkit; external consumers are unknown.

**Risk: HIGH** — a published API boundary crossing two packages, and the field the user
reads when a translation partly fails.

## Phase 2 — Design

**D1 — the empty filter goes in `collectPairs`, not `collectFields`.**
*Rejected:* filtering during collection.
*Constraint:* `collectFields` produces two shapes — a plain field's string and a rich
text field's fragment list — so the same rule would have to be written twice and kept in
step. `collectPairs` is the one place where both become the flat `[key, text]` list that
actually goes to the model, which is also exactly the thing the rule is about.

**D2 — "empty" means: no text left after stripping markers and trimming.**
*Rejected:* `trim()` on the raw string.
*Constraint:* a rich text block that holds only a standalone marker — `<2/>`, an image or
another non-text node — has `text` of `"<2/>"`, which `trim()` keeps. Sending it costs a
key and a round trip for something the model cannot translate, and the node is written
back unchanged either way. `withoutMarkers` already exists, so this reuses it rather than
inventing a second notion of emptiness.

**D3 — zero-width characters count as empty.** *(the user's call — see Human choices)*
*Rejected:* leaving them to `trim()`, i.e. treating a field of zero-width characters as
real text.
*Constraint:* the watermark incident above. A field holding only invisible characters has
no text a translator could act on, and sending it is precisely the waste this task exists
to remove.

**D4 — a key is reported once, wherever the repeat came from.**
*Rejected:* deduplicating only across the two inputs, as the contract literally says.
*Constraint:* one rule is cheaper to hold than two, and the reader's problem is identical
either way — a key listed twice says there were two problems. This is a superset of the
written clause, so it does not contradict it.

**D5 — the report shape.** *(the user's call — see Human choices)*
Option A: `untranslated: UntranslatedField[]` — a breaking change to the published SDK.
Option B: keep `untranslated: string[]` and add a second field alongside it.
*Recommendation: A.* B leaves two shapes of one fact in a published API forever, and the
code standard here forbids a back-compatibility shim without a named consumer — there is
none. The package is at `0.0.14`, pre-1.0, and the branch is unreleased.

**D6 — the test helper's typing is repaired, not its checks.**
The blind author's `field` helper widens to `{ default: string | Fragments }`, which is
neither arm of `CollectedField`'s union, so `tsc` rejects it. This is scaffolding, not a
check: the fix is an overload so each call lands on the right arm. **No expected value and
no assertion changes.**

**New surface:** one module, `untranslatedFields.ts`, with one caller (`localizeStory`).
Below the two-caller bar — justified because it is not an abstraction over anything, it is
the extraction that makes the report testable at all. `localizeStory` needs `SpaceInfo`,
the management client and a `window` message event, so the logic cannot be reached where
it currently sits.

**Escalate to `/sp-architect`?** No. Two pure functions and one rewire inside one package.

## Acceptance Criteria

| # | Criterion | How it is checked | Passes when |
|---|---|---|---|
| 1 | Empty and whitespace-only values contribute no pair | `npx vitest run src/features/localization/collectPairs.empty.test.ts` | 11/11 pass |
| 2 | The report carries a key that locates the field | `npx vitest run src/features/localization/untranslatedFields.test.ts` | 11/11 pass |
| 3 | Nothing already working broke | `npx vitest run src/features/localization` | 143 pre-existing checks still pass |
| 4 | A value of only zero-width characters is dropped | a new check in `collectPairs.empty.test.ts`, proven red first | red before, green after |
| 5 | A fragment of only markers is dropped | a new check in `collectPairs.empty.test.ts`, proven red first | red before, green after |
| 6 | A key repeated **within one input** is reported once | a new check in `untranslatedFields.test.ts`, proven red first | red before, green after |
| 7 | Types pass across both packages | `npx tsc --noEmit` in `storyblok-ai-sdk` and in `storyblok-ai-tookit` | no error |
| 8 | The notice names the field | read the rendered string for a report of one entry with an empty text | contains the key; does not read `: ""` |

## Pre-flight

| # | Result now | Polarity | Verdict |
|---|---|---|---|
| 1 | 9 of 11 fail (`AssertionError` against the real code) | change | ✔ fails as required |
| 2 | 11 of 11 fail (`not implemented`) | change | ✔ fails as required |
| 3 | 143 pass | invariant | ✔ passes as required |
| 4, 5, 6 | checks do not exist yet | change | written and proven red in Phase 3 |
| 7 | **FAILS** — `TS2322` on the new test helper | invariant | ✘ **broken by my own scaffolding, not by the repo** — D6 |
| 8 | reads `: ""` | change | ✔ fails as required |

The two green checks in criterion 1 are `keeps a … that is only partly whitespace` — they
guard against over-filtering and must stay green.

## Risk notes

- Criterion 7 is red before any implementation exists, and the cause is the test helper I
  placed, not the repository. Repairing it is part of this task (D6) and touches no
  assertion.
- D5 breaks a published API. Unknown external consumers of
  `@focus-reactive/storyblok-ai-sdk` would need to update.
- D2 and D3 widen what counts as empty beyond what the tests currently assert, which is
  why criteria 4 and 5 add checks rather than assuming.
- Zero-width characters inside otherwise real text are **not** touched — only a value that
  is *entirely* invisible is dropped.

## Human choices

**2026-09-21 — D5, the report shape: break it.** `untranslated` becomes
`UntranslatedField[]`. The rejected option was keeping `string[]` and adding a second
field beside it; it lost because it leaves two shapes of one fact in a published API
forever, with no consumer asking for the old one. The package is at `0.0.14`, pre-1.0,
and this branch is unreleased.

**2026-09-21 — D3, zero-width characters count as empty.** A value that is *entirely*
invisible — zero-width space, ZWNJ, ZWJ — is dropped alongside ordinary whitespace. The
rejected option was to stop at what `.trim()` removes. It lost to the measured incident
in this space: a 186,000-character watermark built from exactly these characters, which
pushed a request over the model's per-minute ceiling. A zero-width character sitting
*inside* real text is untouched; only a wholly invisible value is dropped.

---

# Follow-up — the three review findings

Same branch, same day. The review of the work above returned three findings; this section
is their contract. Everything above stands.

## What the review found

**F-1 (critical) — a pinned test was broken.** Earlier the same day the reducer's
`endedWithError` was changed from `isLoading: true` to `false`, so the button stops hanging
on "Localizing…" after a failure — the defect the user reported. There is a deliberate pin
for it, `localizationReducer.baseline.test.ts:94-110`, whose own comment reads: *"A
recorded defect, not an intention… held here so that it stays exactly as wrong as it was
until somebody fixes it deliberately."* **The pin did its job.** The fix was deliberate and
user-requested; the pin simply had not been updated with it.

**How it got past me:** I ran only the SDK's suite and reported "172/172 pass" without
saying that figure covered one package of two. The toolkit's 583 checks were never run.
That is the miss, not the reducer change.

**F-2 (major) — marker-shaped text disappears silently.** `holdsText` strips markers with
`withoutMarkers`, a blind `/<\/?\d+\/?>/g`. A field whose real content is literally `<3>`
is therefore read as empty and dropped — not translated, and not listed as untranslated
either. Verified on the real path: `serializeInline([{text:"<3>"}])` yields `text: "<3>"`,
`withoutMarkers` yields `""`, `holdsText` yields `false`.

**F-3 (out of scope) — `describeCause` has no test.** The helper that turns
`storyblok-js-client`'s plain rejection object into a readable message arrived with the
morning's fixes, has no criterion, and `localizeStory` has no test file at all.

## Design

**D7 — strip only the markers a block actually has.**
*Rejected:* keeping `withoutMarkers` and accepting the collision as a documented edge case.
*Constraint:* markers exist in exactly one of the three shapes that reach `holdsText`. A
plain field's string and an embedded component's text field carry **no markers at all**, so
`<3>` there is always content. A `MarkedBlock` carries markers *and already records which
numbers are its own*, in `nodes` — `serializeInline` reserves numbers precisely so that
literal marker-shaped text is not mistaken for one (`inlineMarkers.ts:85-102`, "such text
is content, not a marker, and must survive translation as itself"). Reading `nodes` uses
the answer the serializer already computed instead of guessing it again. This is also the
*simpler* rule: it strips less, in fewer cases.

*Worked through:*

| Block | `nodes` | emptiness verdict |
|---|---|---|
| `"Buy <1>now</1>"` | `{1}` | strip `<1>`,`</1>` → `"Buy now"` → **send** |
| `"<2/>"` (an image alone) | `{2}` | strip `<2/>` → `""` → **drop** |
| `"<3>"` (a user writing about tags) | `{}` | nothing to strip → `"<3>"` → **send** |
| `"<3> and <1>bold</1>"` | `{1}` | strip only `1` → `"<3> and bold"` → **send** |

**D8 — `describeCause` moves to its own module.**
*Rejected:* testing it where it sits, inside `localizeStory`.
*Constraint:* `localizeStory` needs `SpaceInfo`, the management client and a `window`
message event — the same reason `collectUntranslated` was extracted an hour ago. The
function is pure; the module beside it is where every other pure piece of this feature
lives.

**Escalate?** No. Two small pure changes and a test update.

**Risk: HIGH**, for F-2 only: `collectPairs` sits on every translation path and its failure
mode is *silent loss of a user's text*. F-1 and F-3 are low. The classification is carried
at the higher of the two — three review angles, tests before code, an evidenced sweep.

## Acceptance Criteria

| # | Criterion | How it is checked | Passes when |
|---|---|---|---|
| 9 | A block whose real text is `<3>` is sent for translation | new check in `collectPairs.empty.test.ts`, proven red first | red before, green after |
| 10 | A block that is only a real marker is still dropped | the existing `drops a fragment whose whole content is a standalone marker` | stays green |
| 11 | `describeCause` reports `401 Unauthorized` for the user's real rejection object | new `describeCause.test.ts`, proven red against a stub | red before, green after |
| 12 | The pin records the fixed behaviour | `localizationReducer.baseline.test.ts` asserts `isLoading === false`, comment rewritten | check passes, comment no longer calls it a live defect |
| 13 | **Both** suites green | `npx vitest run` in `storyblok-ai-sdk` **and** in `storyblok-ai-tookit` | zero failures in each |
| 14 | Types clean in both packages | `npx tsc --noEmit` in each | no error |

## Pre-flight

| # | Result now | Polarity | Verdict |
|---|---|---|---|
| 9 | check does not exist; probe shows `holdsText("<3>") === false` | change | ✔ written and proven red in Phase 3 |
| 10 | green | invariant | ✔ passes as required |
| 11 | check does not exist | change | ✔ written and proven red in Phase 3 |
| 12 | **fails** — asserts `isLoading === true` | change | ✔ fails as required |
| 13 | SDK 172/172 green; **toolkit 582 green, 1 red** | change (toolkit) | ✔ fails as required |
| 14 | both clean | invariant | ✔ passes as required |

## Human choices — follow-up

**2026-09-21 — F-1, update the pin rather than revert the fix.** The hanging button is the
defect the user reported; the fix is deliberate and wanted, which is precisely the
condition the pin's own comment named. The rejected option was reverting `isLoading` to
`true` and carrying the fix in a separate PR — it lost because the button would go back to
hanging on every failed translation, which is what prompted the work. The pin is rewritten
to record the fixed behaviour, and its comment no longer describes a live defect.

## Review log

### 2026-09-21 · `sp-review-iteration` · three angles · 1 critical, 1 major, 1 out-of-scope

- **critical** — the reducer change broke the pinned baseline test; the SDK-only test run
  hid it. Addressed as F-1.
- **major** — `holdsText`'s blind marker regex drops literal marker-shaped content.
  Addressed as F-2.
- **out-of-scope** — `describeCause` untested. Addressed as F-3.
- Confirmed clean and not re-verified: the `holdsText` operation order, a zero-width
  character inside real text surviving, the export chain for `UntranslatedField`,
  `collectUntranslated` against its own contract, and 172/172 in the SDK.

### 2026-09-21 · `sp-review-iteration` · three angles, second pass · 1 major

**major — retrying after a failed folder-level translation duplicates the story again.**
Traced and confirmed: `localizeStory` duplicates the story into the target folder as its
*first* action (`localizeStory/index.ts:57-71`), before the schema is fetched or a word is
translated. Anything failing after that — a rate limit, a network blip, the model erroring —
leaves the duplicate behind untranslated, and nothing removes it. The F-1 pin fix made the
Localize button clickable again immediately after such a failure, so one more press makes a
second duplicate. Field level is unaffected: it writes once at the very end.

Everything else on the three angles came back clean, including the exact-token safety of
`withoutOwnMarkers` (stripping `<1>` cannot match inside `<12>`), the three shapes reaching
the predicate, the separation between the stripped form used for the decision and the
`collected.text` actually sent, and the `describeCause` extraction and its single caller.

**Flagged for visibility, not filed:** `collectUntranslated` still cleans the *displayed*
text with the blind `withoutMarkers`, so a field whose real content is literally `<3>` would
show an empty text in the notice. The key is still shown, so nothing is lost — cosmetic.

---

# Follow-up 2 — the duplicate-on-retry guard

## What was decided

**2026-09-21 — option B: gate the button by level, do not reorder `localizeStory`.**

Three options were put to the user:

| | |
|---|---|
| A | record the risk, change nothing |
| **B** | **disable the button after a failure in folder mode only** |
| C | move the duplication in `localizeStory` to after the translation is ready |

C fixes the cause and A fixes nothing, so B was chosen as the honest middle: it closes the
window this work opened, in a few lines, without touching a production path that has **no
tests at all**. The cost of C was estimated at roughly two hours, half of it manual
verification of a mode that had not been exercised once that day, plus an unresolved
question — whether Storyblok regenerates `_uid`s on duplication, which decides whether
translating the original and writing into the copy is even safe. **C remains open as its
own task; it fixes a defect that predates this work.**

## D9 — the guard reads `errorMessage`, and the escape is reopening the plugin

*Rejected:* keying the guard on the `endedWithError` action rather than on state.
*Constraint:* `mainReducer` derives readiness from the state it just produced, so an
action-shaped condition would not survive the next dispatch — the button would come back on
any subsequent interaction. `errorMessage` persists exactly as long as the error is shown
(only `endedSuccessfully` clears it), which is the lifetime the guard needs. The consequence
is deliberate and matches the pre-fix behaviour for this mode: after a failed folder
translation the way out is to reopen the plugin.

## Acceptance Criteria

| # | Criterion | How it is checked | Passes when |
|---|---|---|---|
| 15 | After a failure at **field** level the button comes back | `localizationReducer.retry.test.ts` | `isReadyToPerformLocalization === true` |
| 16 | After a failure at **folder** level the button stays disabled | same file | `isReadyToPerformLocalization === false` |
| 17 | Folder level is ready before anything fails | same file | `true` — the guard is about failure, not about the mode |
| 18 | Both suites green | `npx vitest run` in each package | zero failures |

## Pre-flight

| # | Result now | Polarity | Verdict |
|---|---|---|---|
| 15 | green | invariant | ✔ passes as required |
| 16 | **fails** | change | ✔ fails as required |
| 17 | green | invariant | ✔ passes as required |
| 18 | SDK 185/185; toolkit 583/583 before the new file | invariant | ✔ passes as required |

## Results — follow-up 2

All met. SDK 185/185, toolkit 586/586, `tsc` clean in both. One mutation: disabling the new
guard reddens criterion 16 and nothing else; reverted and both suites re-run green.
