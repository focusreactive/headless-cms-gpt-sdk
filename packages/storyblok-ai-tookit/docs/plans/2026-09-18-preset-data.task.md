# Preset data layer — the nested shape

## Why this is a rewrite

An earlier attempt built the flat model: a preset belonging to one language, several rows
tied only by a matching name. `docs/plans/2026-09-17-brand-voice.md` §3b had already
specified the nested shape **and** recorded why, under the heading "Why a preset holds
locales, and not the other way round" — whose rejected alternative is exactly what was
built. The section was not read. The owner confirmed the nested model.

Thrown away: the whole contract, three implementation files, and 79 blind checks plus 10
guards that encode the flat model. Kept and still green: the UI kit, the form-state
machinery, and `ApiError` — 132 checks.

## Decisions

| Decision | Chosen | Rejected, and why |
|---|---|---|
| The shape | §3b's, taken as given | Re-deriving it: it is what the storage route writes and what the prompt reads, and §3b carries signed reasons for both halves |
| `removePreset` and `defaultId` | **Leave `defaultId` alone**, even when it named the removed preset | Clearing it, which the flat attempt did: §3b chose one id over a per-item flag *precisely* so deleting is harmless, and rule 4 already reads a dangling id as unconfigured. Clearing it adds a rule the shape was designed not to need |
| A locale entry that is not an object | **Dropped** from `byLocale` | Repaired to `{}` like every other unreadable field: the list tells a person which languages a preset covers, and an empty entry claims one the preset says nothing about. Inside a readable entry, fields are still repaired — "nothing a person typed is lost" holds one level down |
| Falling back when the default preset has no entry for the locale | **Never** — `null` | Using another locale's entry, or another preset's: §3b rule 3, quietly substituting a different voice is worse than substituting none |
| What the form edits | The preset's name plus **one** locale | A language switcher inside the form: §3b in-scope item 2 settles it — one form, not one per language. Vindicated in session when the switcher was costed: our `useForm` has no nested field names, so tabs would need a side buffer holding the other locales and validation run outside the form machinery |
| Which locale the form edits | The one **named by the row that was tapped** on the list screen, or chosen in a select when creating | The locale currently being translated into, implied and shown as a label: the owner found it impossible to tell which language was being edited or added, which is the one thing this screen may not be vague about. §3b's substance is untouched — the form still edits one language — only the way that language is picked has moved, from implied to explicit |
| Writing a preset | One `savePreset(settings, draft)` taking the one-locale draft the form holds | `addPreset` / `updatePreset` taking a whole `StylePreset`: the screen would then have to rebuild `byLocale` from a form that has only seen one language, and the language it never displayed is the one it would drop. The merge belongs where it can be tested, not at the call site that cannot see what it is merging |
| The id of a new preset | Minted by the screen when it opens the create form | Minted inside `savePreset`: that makes a pure function depend on a generator, and it leaves the screen unable to name what it just wrote. Minting early also makes saving twice idempotent |
| A locale entry saying nothing | **Removed** from `byLocale` rather than written as `{}` | Writing it: the list counts the languages a preset covers, and an entry contributing nothing would inflate that count. `neutral` counts as saying nothing — with no inheritance anywhere, it states exactly what stating nothing states |
| `voice` | `{ word: string }[]` | Bare strings, as §3b shows: the owner asked for objects in session, and the artefact predates that |
| Formality set | `neutral / formal / informal` | §3b's `formal / informal / casual`: `neutral` is what a select needs for "not set", and `informal` against `casual` is a difference of degree a translation model is unlikely to act on. **This reversal must be written into §3b** — it is currently divergent and unexplained |

**Escalate?** No. One module, the shape is given, no new dependency.

**Written contract: yes** — `src/preset/preset.types.ts`, which is what puts Phase 3 on the
`/sp-red-test` path.

## Acceptance criteria

| # | Criterion | How it is checked | Pre-flight |
|---|---|---|---|
| 1 | `toSettings` gives empty settings for `undefined` and for anything unreadable | a named test | stub throws — fails now |
| 2 | A locale entry that is not an object is dropped; an unreadable field inside a readable entry is repaired | a named test | fails now |
| 3 | `removePreset` leaves `defaultId` naming the removed preset | a named test | fails now |
| 4 | `resolveStyle` is null when the default preset has no entry for the locale, and never falls back | a named test | fails now |
| 5 | `validatePreset` reports `taken` for a name another preset carries, whatever its languages | a named test | fails now |
| 6 | `savePreset` writing one locale of a preset that holds others leaves every other locale byte-identical | a named test | fails now |
| 7 | `savePreset` with an id no preset carries appends; applying the same draft twice equals applying it once | a named test | fails now |
| 8 | A draft saying nothing removes that locale from `byLocale` and leaves the rest of the preset standing | a named test | fails now |
| 9 | The `casual` reversal is recorded in §3b | read the section | absent — fails now |
| 10 | The 132 shared checks stay green | `yarn test` | **132 passing now, must stay** |
| 11 | No new type errors | `npx tsc --noEmit` | **exit 0 now, must stay** |

## Result

| # | Criterion | Outcome |
|---|---|---|
| 1 | `toSettings` empty for `undefined` and for anything unreadable | met |
| 2 | non-object locale entry dropped, unreadable field inside a readable entry repaired | met |
| 3 | `removePreset` leaves a `defaultId` naming the removed preset | met |
| 4 | `resolveStyle` null with no fallback | met — **and it was unguarded until a mutation said so**, see below |
| 5 | `validatePreset` reports `taken` whatever the languages | met |
| 6 | `savePreset` leaves every other locale untouched | met |
| 7 | unknown id appends; the same draft twice equals once | met |
| 8 | a draft saying nothing removes that locale | met |
| 9 | the `casual` reversal recorded in §3b | met — §3b now carries "Reversals since this was signed", covering formality and `voice` |
| 10 | the 132 shared checks stay green | met |
| 11 | no new type errors | met — `npx tsc --noEmit` exit 0 |

Red run: 117 of 117 failed, every failure the stub's own `not implemented — red run`,
zero passes, zero module-resolution errors. Green run: 117 of 117, first time.

Fifteen mutations, one per guarded behaviour. Twelve reddened only their own group.
**Three reddened nothing, and all three were real gaps:**

- `toSettings` keeping two presets with one id — a clause added to the contract after the
  blind authors had finished, so nothing covered it;
- `setDefaultPreset` rebuilding when the id is already the default — likewise;
- **`resolveStyle` falling back to the first preset** — the serious one. Every no-fallback
  check in `presetSet.test.ts` used settings whose default preset was also the first, so a
  fallback to the first preset gave the same answer as no fallback at all. The flagship
  rule of §3b was running on the one fixture where the distinction could not arise.

Closed by `src/preset/preset.guards.test.ts`, 5 checks, labelled with why they exist. All
three mutations redden it now.

## Contract gaps the blind authors found, and how each was closed

The three authors returned 28 places where the contract was silent or admitted two
readings. The ones that changed the contract:

- **`savePreset`: replace the locale entry or merge it with what was there?** Two opposite
  implementations were both legal. Chosen: replace. The form shows all three fields at
  once, so a field the draft leaves out is a field the person cleared, and merging would
  make clearing impossible.
- **`validatePreset` counting voice words "as given" against `savePreset` dropping blank
  ones.** Twenty real words plus one blank would have been refused as `tooMany` though
  exactly twenty would have been stored — and the person could not see the word they were
  being told to remove. Now both agree on what a word is.
- **Whose name is trimmed when comparing for `taken`.** Symmetric: both.
- **The storage keys.** The contract pointed at §3b for them, which made the file
  unimplementable on its own. `defaultId` and `items` are now named in it.
- **`formality` has no empty value**, so the "repair to the empty value" rule could not
  apply to it. An unreadable formality is dropped; nothing is lost, because `neutral` and
  absence say the same thing.
- **"not a plain object"** now says that `null` and arrays are not plain objects.
- **A `voice` element whose `word` is not a string** is dropped rather than repaired to
  `''`, so reading and writing agree.
- **Duplicate ids in storage** — the first wins.
- **`defaultId` on read** — kept even when it names no preset, because `removePreset`
  deliberately leaves such ids behind and reading must not tidy them away.
- **`instructions` trimmed on write**, like `name`.
- **`setDefaultPreset` with a known id**, and with an id already the default.
- **`resolveStyle` returns the entry the settings hold**, not a copy.

Two blind-authored checks encoded clauses that these changes reversed. Both were edited,
each with its `describe` name rewritten to the new clause: the blank-word count in
`validatePreset.test.ts`, and `{ word: 7 }` in `presetDto.test.ts`.

Left undecided on purpose, recorded rather than guessed: how case folding handles Turkish
`I` and German `ß`; Unicode normalisation; which characters count as whitespace; whether
`voice: []` differs from an absent `voice`; two siblings sharing an id in `validatePreset`;
whether `savePreset` should refuse a name that trims to nothing (`validatePreset` reports
it, and the screen will not call `savePreset` while it does).

## `/sp-complexity`, and what it found

Run in assumption mode — the layer has no history, so nothing was edited under the skill's
own authority; all three findings went back as proposals and the owner chose one.

**Applied: the rule "a language nobody has said anything about is not a language the preset
covers" was enforced on the write path only.** `savePreset` refuses to store such an entry;
`toSettings` repairs a malformed one and keeps it, because a separate contract rule says
nothing a person typed is dropped for being malformed. The two disagree on the same shape,
and the read path won silently. Probed on the running code:

    in:  byLocale: { fr: {}, de: { formality: "neutral" } }
    out: byLocale: { fr: {}, de: { formality: "neutral" } }   languages counted: 2
    resolveStyle(fr): {}    ← not null

Both consequences land on code about to be written: the list counter says "2 / 5" for a
preset that configures nothing, and `resolveStyle` answers "a style exists and it says
nothing" where §3b rule 3 wants "no style".

Two ways out were costed against the checks rather than argued:

- **drop such entries on read as well** — strongest invariant, but it flips three
  blind-authored checks (`presetDto.test.ts:168`, `:177`, `:184`), each tracing to the
  contract's own "nothing a person typed is dropped" sentence. Three independent checks on
  one rule is the authors saying it is load-bearing;
- **share one predicate and fix the readers** — flips none, verified against every
  `resolveStyle` check before choosing.

The second was taken, and for a reason beyond cost: a wrong drop on the read path is
invisible — the data is simply gone — while a wrong `resolveStyle` shows up immediately as
a translation with no style.

`SaysNothing` is now in the contract and exported from `presetSet.ts`; `entryOf` and
`resolveStyle` both call it, and the list counter will. Nine guard checks, four mutations,
each reddening only its own group.

| Counter, for "a reader acts on which languages a preset covers" | Promised | Delivered |
|---|---|---|
| CHANGE | 3 → 1 | 3 → 1 |
| READ | 3 → 1 | 3 → 1 |
| STATE | 3 → 2 | 3 → 2 **for a reader that calls the predicate** |

The last row is short of its promise and is recorded as such: the shape `byLocale: { fr: {} }`
is still expressible in `StyleSettings`, so a future reader that iterates the keys without
the predicate can still see it. Dropping on read was the option that would have made it
unrepresentable, and it was rejected above.

**Reported, not applied:**

- `FORMALITIES` in `presetDto.ts` is annotated `readonly unknown[]`, which is what lets
  `.includes` compile and also severs the only link to the `Formality` union. A fourth
  value added to the union would be silently dropped on read with no build error. The set
  has already changed once (§3b, "Reversals since this was signed"). `Record<Formality, true>`
  plus a type guard would make the omission a compile error. STATE 3 → 2, READ 2 → 1.
- "What counts as a voice word" — trim, drop the blanks — is implemented twice, in
  `presetSet.ts:20` and `validatePreset.ts:32`, and the contract requires them to agree.
  One of the deliberately-undecided points ("which characters count as whitespace") would
  have to be applied in both. CHANGE 2 → 1, READ unchanged.

## `/sp-abstraction`, and what it found

Boundary: the exported surface of `src/preset/` — 8 functions, 2 constants, 15 types.
Depth: surface 37 against 325 hidden. Drift: not taken — no history and no second caller
for anything but `saysNothing`.

**Applied: `validatePreset` returned a type twelve times looser than its contract.**
`Partial<Record<PresetField, { type: PresetErrorType }>>` says any of three fields may
carry any of five errors — 216 expressible states against 18 the contract allows. The
pairing lived in prose, so a screen switching on `errors.name?.type` would face five cases
where two are possible, and would either answer three that never arrive or cast.

Replaced by `PresetErrors`, which names per field the errors that field can carry:
expressible 216 → 18, ratio 12 → 1, the type is now the contract. READ falls from four
places (the `ValidatePreset` type, `PresetField`, `PresetErrorType`, the prose table) to
one. Zero checks flipped — they only read `errors.name` and compare against `{ type: … }`.

**Measured and found healthy**, recorded so it is not re-litigated:

- `PresetDraft` as `{ id, name, locale } & LocaleStyle` is honest: `LocaleStyle` is a
  *part* of a draft, not a second concept glued to it;
- `saysNothing` is not premature — two real callers already in the tree, `entryOf` and
  `resolveStyle`;
- the three-file split is boundaries, not filing: `presetDto` is the only place touching
  `unknown`, `validatePreset` the only one knowing error types, `presetSet` the operations.

**Notes, not findings** — no caller exists yet to demonstrate either:

- `ToSettings` takes `unknown` and `ToStored` returns `Record<string, unknown>`; a caller
  must know by meaning, not by type, that this is the value of the `stylePresets` field and
  not the whole document — writing it at the document root would clear its neighbours. When
  the storage layer arrives, exporting the field name as a constant turns that agreement
  from meaning into name.
- `PresetId = string` admits `''`. `savePreset` would append such a preset and `toSettings`
  would drop it on the next read, so it would vanish on reload, silently. Unreachable today
  because the screen mints the id. A branded type costs every caller a constructor —
  measured and decided against, recorded here so it is not a surprise later.

## Human choices

- **The nested shape itself** — the owner confirmed it against §3b after the flat attempt
  was built and thrown away.
- **Explicit language selection on the list screen** — the owner rejected an implied
  language with a label ("непонятно какой мы редактируем/добавляем"), then rejected tabs
  inside the form once the list-level alternative was drawn. Chosen: an expanding preset
  row whose language lines are themselves the control.
- **`casual` dropped from the formality set** — recorded as a deliberate reversal of §3b
  rather than restored.

## Review log

- (empty)
