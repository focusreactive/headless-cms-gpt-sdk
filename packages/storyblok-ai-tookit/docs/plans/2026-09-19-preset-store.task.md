# Preset data access — the whole path, with a fake at the far end

## Requirements / Task restatement

Build everything between the screens and storage — a repository, the state that owns the
loaded settings, and the hooks the three screens call — and put a fake in place of the
network at the far end. The fake must be able to answer slowly and to fail, so the loading
and error states already drawn (`4-Loading`, `5-Failed`, `12-Preset-saving`,
`13-Preset-save-failed`) are reachable without Firebase.

The pure model this sits on is committed in `db313d4` and is not reopened here.

## Phase 0 — handoff found

`docs/plans/2026-09-17-brand-voice.md` §3 carries a code map and §3b the storage rules.
Adopted rather than re-derived. **One of its claims is wrong and is corrected here:** it
states that `DEV_SKIP_FIREBASE=true` in `pages/api/space-settings.ts` returns a local stub,
so everything can be exercised without Firebase. That flag does not exist — `grep` over the
package finds no occurrence. The fake repository is therefore not a convenience; it is the
only way any of this runs today.

## Phase 1 — what is there

| Path | What it does now |
|---|---|
| `pages/api/space-settings.ts` | GET and POST; destructures `{ pluginId, spaceId, notTranslatableWords }` explicitly, so a new field must be named here |
| `sb-plugins-storage-sdk/src/index.ts:209` | `saveSpaceSettings` writes `{ modified, notTranslatableWords }` only. Separately published package |
| `src/components/Localization/index.tsx:19` | `fetch` in a `useEffect` on mount, `.then` chain with **no `.catch`**, no loading state, no error state |
| `src/context/AppDataContext.ts` | supplies `languages`, `spaceId`; provided inline at `pages/index.tsx:102` |

**How this project holds state:** `React.useReducer` inside a component, plus contexts
defined in `src/context/` and provided with a bare `<Context.Provider value={…}>` at the
page root. There is no provider *component* anywhere in the plugin.

**Precedent for loading and error states: none.** The one existing fetch has neither. So
this step has no house pattern to copy and is designing that part from scratch — stated
because it is a design signal, not an oversight.

**Blast radius:** nothing existing. Every file is new; `pages/index.tsx` gains one wrapper
at the end of this step's follow-up, not in it.

**Risk: low, for this step only.** Nothing it builds touches real storage — the fake is
the only implementation. The high-risk classification belongs to the HTTP step that
replaces it, which writes a shared document, and it is recorded there rather than claimed
here.

## Decisions

| Decision | Chosen | Rejected, and why |
|---|---|---|
| Where the loaded settings live | A **provider component** in `src/preset/`, holding `useReducer` | Building the value inline in `pages/index.tsx`, which is the existing idiom: it fits a value assembled from three `useState`s, not a reducer plus a mount effect plus four async operations. That would put a subsystem in a page |
| The seam for the real implementation | `PresetRepository`, two methods, constructed with what it needs | Putting `fetch` in the hooks and faking `fetch` itself: then the route and the storage SDK must already work, which is exactly what this step exists to avoid needing |
| Optimistic writes | **No.** The state changes only after the write is accepted | Optimistic with rollback: the artboards already draw a saving state (`12`) and a failed state (`13`), so the screens were designed for the pessimistic shape. A failed optimistic write leaves the panel showing a preset that does not exist |
| How the fake misbehaves | A **control handle** the app never sees: `setDelay`, `failNextLoad`, `failNextSave`, `stored` | Random failures — flaky tests. A developer toggle — a UI nobody asked for. One-shot failures are what a test of "fail, show it, retry, succeed" actually needs |
| Shape of the loading state | A discriminated union — `loading` / `failed` / `ready` — not three independent fields | `{ settings, loading, error }` is 8 expressible states for 3 legal ones. The last two audits on this layer both turned on exactly that gap; taking it at design time costs nothing |
| Two windows racing | **Not detected.** Last write wins | Detecting it needs a version the route does not carry and the storage SDK does not return. Building half of it now is speculative; the window is one editor's panel against their own second tab |
| `saveSpaceSettings` becoming field-agnostic | **Out of scope for this step** | It lives in a separately published package and is only needed once a real HTTP implementation exists. Pulling it in now adds a yalc link and a release to a step that does not call it |

**Placement:** everything under `src/preset/`, beside the model it drives.

**New surface:** `PresetRepository` (2 callers: the fake now, the HTTP implementation next
step — named and in scope), the provider and its hooks (3 callers: the list, the form, the
prompt composer, all drawn).

**Written contract? Yes** — `PresetRepository` and the store's state shape both owe callers
things a signature cannot state. That puts Phase 3 on the `/sp-red-test` path.

**Escalate to `/sp-architect`?** One trigger fires on a strict reading — "a seam the
project doesn't have yet". Recommending against: the seam is one type with two methods
inside one folder, with both implementations named, no new dependency and no migration.
Raised at the gate rather than decided quietly.

## Acceptance Criteria

| # | Criterion | How it is checked | Pre-flight |
|---|---|---|---|
| 1 | A rejected load leaves the store in `failed` carrying the `ApiError`, never in `ready` | named test | unit absent — red run converts to a real failure |
| 2 | A rejected save leaves the settings exactly as they were, and reports the error | named test | as above |
| 3 | The store is `loading` before the first answer arrives, and `ready` only with settings | named test | as above |
| 4 | A second operation started while one is in flight does not interleave two writes | named test | as above |
| 5 | Every operation writes the **whole** settings object, never a fragment | named test asserting on what the fake received | as above |
| 6 | The fake can be made slow and made to fail once, and recovers on the next call | named test | as above |
| 7 | The 263 committed checks stay green | `yarn test` | **263 passing now, must stay** |
| 8 | No new type errors | `npx tsc --noEmit` | **exit 0 now, must stay** |

## Pre-flight

- `npx tsc --noEmit` → exit 0 · invariant · must stay
- `yarn test` → 263 passed · invariant · must stay
- criteria 1–6 name units that do not exist; the `/sp-red-test` red run against stubs is
  their pre-flight, and it must show every check failing with the stub's own error

## Risk notes

- The screens are not built, so criteria 1–7 are witnessed by tests, not by a running
  panel. Nothing here claims a screen was seen working.
- `res.status(500).json({ error })` in the existing route serialises an `Error` to `{}`.
  Out of scope here because nothing in this step goes through the route; recorded so the
  HTTP step does not rediscover it.
- One shared mutation status, not one per operation. The panel does one thing at a time
  and the artboards show one saving state. If a screen later needs two at once this is the
  thing that gives.

## Result

| # | Criterion | Outcome |
|---|---|---|
| 1 | a rejected load leaves `failed`, never `ready` | met |
| 2 | a rejected save leaves the settings as they were | met |
| 3 | `loading` before the first answer, `ready` only with settings | met |
| 4 | a second call over one in flight does not interleave | met |
| 5 | a save replaces what storage holds rather than merging | met |
| 6 | the fake can be made slow and made to fail once, and recovers | met |
| 7 | the 263 committed checks stay green | met — 368 of 368 now |
| 8 | no new type errors | met — `npx tsc --noEmit` exit 0 |

Red run: 101 of 101 failed, every failure the stub's own `not implemented — red run`, zero
passes, zero type or timeout failures. Green run: 101 of 101, after one configuration fix
(below). Thirteen mutations, one per guarded behaviour; ten reddened only their own group.

**Three reddened nothing, and all three were clauses added to the contract after the blind
authors had finished** — the same shape of gap the preset model's run produced:

- a rejected save leaving the document untouched — the silence the fake's author called the
  most important one in their report, closed in prose and then guarded by nothing;
- `setDelay` applying to a call armed to fail;
- `reload` returning `presets` to `loading`.

Closed by `src/preset/presetStore.guards.test.tsx`, 4 checks. All three redden it now.

## What the blind authors found in the contract

**One self-contradiction, and it was real.** Two clauses claimed the same case with no order
between them: "the settings have not loaded → `false`" and "the id matches nothing →
`true`". With nothing loaded every id matches nothing. Fixed by naming the precedence —
not-loaded is decided first, because answering `true` would say the settings already hold
what was asked for when we do not know what they hold. The author had routed around it by
testing only `savePreset`, which has no id-matching branch.

**A clause narrower than its own reason.** The store took the model at its word about "the
same object" but named only the id-matches-nothing case, while the model returns the same
object for an id that is already the default too. Restated by the mechanism — *if the model
hands back what it was given* — rather than by enumerating cases.

**`reload` "answers nothing" was unfalsifiable.** Its type is `() => Promise<void>`, so a
refused reload and a completed one are indistinguishable by their answer. The clause now
points at the observable consequence: no `load` call was made.

**Twenty silences, closed together** by three rulings rather than one clause each:

- *one call at a time, whatever kind* — replaces separate rules for loads and writes, and
  closes what a load during a reload, an operation during a reload, and a reload during a
  reload each do;
- *`reload` always returns to `loading`* — closes what `presets` shows during a reload and
  after a rejected one, with no fourth state to say which of two settings is on screen;
- *a refused call never started* — closes whether a refusal clears a `failed` mutation.

Plus: `mutation` is `idle` at mount and after an accepted operation; `usePresets` outside a
provider throws; the repository is read once at mount; an answer arriving after unmount is
dropped; `ready` carries the object the repository was handed.

**A naming fault worth recording.** `stored` meant two different things — the document at
the start (a parameter) and the document right now (a method). The fake's author named it,
and the silence about what `stored()` answers before the first save grew directly out of it:
the two read as one thing, so the question never got asked. The method is now `held`.

## Two defects in the blind test file, fixed mechanically and reported

Neither changes what any check asserts.

- `createElement(PresetsProvider, { repository }, children)` does not type-check when
  `children` is a required prop; children moved into the props object.
- **`startOperation` was broken, not merely mistyped.** It was `async` and returned the
  operation's promise, which an async function absorbs — so `await startOperation(...)`
  waited for an operation the test had deliberately gated open, and every such check would
  have hung to a timeout. The helper now returns `{ settled }`; 21 call sites destructure
  it. The red run could not have caught this: everything threw at the stub before reaching
  the gate.

## One configuration fix

`tsconfig.json` says `"jsx": "preserve"` because Next transforms JSX at build time with the
automatic runtime. The test run fell back to the classic transform, so every component not
importing React by name failed to render — 59 checks failing with `React is not defined`.
`vitest.config.ts` now sets `esbuild: { jsx: 'automatic' }`, which is what the build does.
This is the first React component the package has under test; nothing was broken before.

## `resolveStyle` changed signature before the audits ran

The Localization screen lets an editor pick a preset per translation, and `resolveStyle`
only ever read `defaultId` — the pick had nowhere to go. It now takes the preset it must
use: `resolveStyle(settings, preset, locale)`.

The default did not move into the caller as a rule; it **stopped being a rule**. The
screen's select opens on `settings.defaultId`, and from then on the selection is the
selection. `resolveStyle` answers one question instead of two, and settings with no default
are no longer a case it can be asked about.

One clause is new and is the reason the change is not just a reshuffle: **no falling back
to the default when the named preset has gone.** A preset deleted in another window gives a
translation with no style, which an editor notices, rather than one in someone else's
voice, which they do not.

Cost: 15 checks touched — 3 deleted, because the state they guarded ("no `defaultId` is
set") cannot arise any more, and 2 added: "returns the named preset's entry, not the
default preset's", and the deleted-in-another-window guard. Two mutations prove the new
rule: falling back to the default reddens 2, ignoring the named preset reddens 3.

## `/sp-complexity`, and what it found

Assumption mode — no history over the layer, so nothing was edited under the skill's own
authority and every finding went back as a proposal.

**Applied: the conversion between the stored shape and `StyleSettings` was held by prose.**
The contract said every implementation owns `toStored`/`toSettings`; one implementation did
it, and the HTTP one would have had to remember unprompted, with no compiler and no test to
say otherwise — `load` would answer unrepaired settings and `save` would write the wrong
shape.

`overStorage` now builds a `PresetRepository` from a `StorageIO` — `read` and `write` over
raw documents. An implementation never sees `StyleSettings`, so it cannot forget to
convert; there is nothing handed to it to convert.

| Counter, for "the stored shape changes" | Before | After |
|---|---|---|
| CHANGE | 3 — `presetDto.ts`, the fake, the coming HTTP one | 2, at any number of repositories |
| READ | 3 — the contract clause, `presetDto.ts`, the fake as the only worked example | 2 |
| STATE | unchanged | unchanged |

**Declared as a trade:** READ falls for that scenario and **rises by one** for anyone
reading a single implementation — to know what the fake's `load` answers you now open
`overStorage` too.

Zero checks flipped. Two mutations: skipping the read conversion reddens 9, the write
conversion 1.

**Measured and declined**, recorded so they are not re-raised: `busy` as a ref cannot be
derived from state (between `setMutation` and the re-render a state-mirroring ref still
reads `idle`, so a second call in the same tick would not be refused — the exact defect it
prevents); the one-at-a-time rule in two places would cost a 7-line generic wrapper with a
sentinel to save two guard lines; `held.current = presets` is unavoidable because the value
is needed before the decision to call and a state updater must be pure; none of the four
refs merge.

## `/sp-abstraction`, and what it found

Boundary: `PresetsProvider`, `usePresets`, `createFakeRepository` and six types. Depth:
surface 31 against 155 hidden. Drift: not taken — no history, and no symbol has a second
caller yet.

**Applied: `false` meant two different things, and in one reachable case they could not be
told apart.** Two branches answered `false` — refused, and rejected by the repository — and
the contract distinguishes them sharply: a refusal records no error. But a refusal also
does not *clear* a `failed` mutation, so proven on the running code:

    after a real failure:  answer = false  mutation = failed
    after a refusal:       answer = false  mutation = failed

Bit for bit the same. The form's Save button would announce "save failed: E1" when nothing
had been attempted and E1 belonged to an earlier try.

`Written` — `'written' | 'unchanged' | 'refused' | 'failed'` — puts the outcome in the
answer. The decision that the error lives only in `mutation` is untouched; `mutation` is
now for display alone.

| Measure | Before | After |
|---|---|---|
| Honesty (the answer) | 2 outcomes expressible where the contract names 4 | 4 of 4, ratio 1 |
| Agreement | **meaning** — the caller had to read the answer and `mutation` as a pair | **type** — the answer alone says which |

Re-probed afterwards: `failed` then `refused`, distinguishable. Cost: 15 checks reworded,
none weakened. Three mutations, each swapping one outcome for another, redden 3, 2 and 1.

**Measured and declined:** `FakeControl` is reachable from `pages/index.tsx`, which must
call `createFakeRepository` to build the fake and receives the control with it — 4 methods
expressible, 0 legal. Closing it costs two factories sharing a closure; and when the HTTP
implementation lands, `createFakeRepository` leaves `pages/index.tsx` entirely. Splitting
`Presets` per caller (the list needs no `savePreset`, the form no `reload`) has no caller to
demonstrate it yet — the screens are unwritten. `PresetsState` × `MutationState` is 9
expressible against 7 legal, ratio 1.29, under the threshold; the two illegal pairs are
excluded by `busy` and the `kind !== 'ready'` guard, neither visible in the type.

## Human choices

- **19 September 2026 — no preset duplication.** The button exists in the artboards; the
  designer added it unprompted and it was never in the model's contract. The screens keep
  the drawing as it is, and the control is not implemented. Recorded here so the screens
  step reads this as a decision rather than as something forgotten.
- **19 September 2026 — no escalation to `/sp-architect`.** The trigger fires only on a
  strict reading of "a seam the project doesn't have yet". The owner's words: there is
  nothing to design in one type with two methods.

## Review log

- (empty)
