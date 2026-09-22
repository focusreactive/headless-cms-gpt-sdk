import type { ApiError } from '../shared/apiError'
import type { PresetDraft, PresetId, StyleSettings } from './preset.types'

/**
 * Reading and writing the space's style presets.
 *
 * Two methods and no third: §3b rule 1 says the `stylePresets` field is written whole,
 * because the store replaces a nested object outright rather than merging into it, so
 * there is no partial write to offer. `save` therefore means *replace what is held*, and
 * a preset absent from `settings` is a preset gone from storage, not one left alone.
 *
 * Both reject with `ApiError` and with nothing else. A caller that catches something else
 * has found a defect in an implementation, not a case to handle.
 *
 * `load` for a space nothing has ever written answers empty settings — that is a working
 * state, not a failure (§3b rule 2).
 *
 * The two calls are independent: nothing requires `load` before `save`, and an
 * implementation may not rely on having been loaded.
 *
 * Nobody implements this by hand: `overStorage` builds it from a `StorageIO`, so the
 * conversion to and from the stored shape lives in exactly one place. Callers above this
 * line deal in `StyleSettings` and never in the stored shape; implementations below it
 * deal in documents and never in `StyleSettings`.
 */
export type PresetRepository = {
  load: () => Promise<StyleSettings>
  save: (settings: StyleSettings) => Promise<void>
}

/**
 * Reading and writing the document itself — the value of the `stylePresets` field, in
 * whatever shape storage happens to hold, repaired by nobody.
 *
 * This is what an implementation actually implements. It exists so that no implementation
 * ever sees `StyleSettings`: the conversion between the two shapes is `overStorage`'s, in
 * one place, and a second implementation cannot forget it because it is never handed
 * anything to convert.
 *
 * `read` for a space nothing has ever written answers `undefined`, which is a working
 * state and not a failure. Both methods reject with `ApiError` and nothing else.
 */
export type StorageIO = {
  read: () => Promise<unknown>
  write: (document: Record<string, unknown>) => Promise<void>
}

/** Builds the repository the rest of the program uses out of raw document access. */
export type OverStorage = (io: StorageIO) => PresetRepository

/**
 * What is known about the settings. A union rather than `{ settings, loading, error }`,
 * which would express eight states to serve three: there is no "loaded and failed", and no
 * "ready with nothing".
 *
 * `failed` carries the error and no settings — a partial answer is not offered, because a
 * screen showing half a list cannot say which half is missing.
 */
export type PresetsState =
  | { kind: 'loading' }
  | { kind: 'failed'; error: ApiError }
  | { kind: 'ready'; settings: StyleSettings }

/**
 * What is happening to the settings right now. `failed` holds the error until the next
 * operation starts, so a screen has somewhere to read it from after the call returned.
 */
export type MutationState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'failed'; error: ApiError }

/**
 * How an operation ended — in the answer itself, rather than in a pair the caller has to
 * assemble out of the answer and `mutation`.
 *
 * `written` — the repository accepted it. `unchanged` — the settings already said what was
 * asked for, so nothing was written. `refused` — nothing was attempted. `failed` — the
 * repository rejected it, and the error is in `mutation`.
 *
 * Four values rather than a boolean, because `refused` and `failed` cannot be told apart
 * from a boolean plus `mutation`: a refusal does not clear a `failed` mutation, so a
 * refusal over an earlier failure and a fresh failure are **the same observation** —
 * `false` and `failed` both times. A screen reading that pair would announce a save that
 * failed when nothing had been attempted.
 */
export type Written = 'written' | 'unchanged' | 'refused' | 'failed'

/**
 * What the three screens are given.
 *
 * ## The first load
 *
 * Starts on mount, so `presets` is `loading` before anything is asked for. Nothing else
 * begins a load; `reload` is how a screen asks for another, and the retry on the
 * failed-load screen is why it exists.
 *
 * `reload` returns `presets` to `loading` and then to the outcome. One rule and no special
 * case for reloading from `ready`: a deliberate refresh that shows it is refreshing is
 * right, and holding stale settings on screen while new ones are fetched would need a
 * fourth state to say which of the two a caller is looking at.
 *
 * ## One call at a time, whatever kind
 *
 * A load and a write disagree about what storage holds, and the field is written whole, so
 * a second call started over a first is refused whichever the two are. While anything is in
 * flight — the first load, a `reload`, or any of the three writers — every call is refused:
 * a writer answers `refused`, `reload` returns having done nothing. Nothing changes and no
 * error is recorded, because being refused is not a failure.
 *
 * A refused call never started, so it does **not** clear a `failed` mutation either.
 *
 * ## What an operation promises
 *
 * Each of `savePreset`, `removePreset` and `setDefaultPreset` applies its counterpart from
 * the model, hands the whole result to the repository, and **changes what callers see only
 * after the repository has accepted it**. So a failed operation leaves the settings exactly
 * as they were: the panel never shows a preset the store does not hold. This is why the
 * writes are not optimistic, and the drawn `12-Preset-saving` and `13-Preset-save-failed`
 * are the states that follow from it.
 *
 * What `ready` carries afterwards is the object the repository was handed, not a copy.
 *
 * The answer says how it ended. **The error is not returned** — it lives in `mutation`
 * and only there, so a screen has one place to read it and cannot show two different
 * failures at once. An operation never rejects.
 *
 * ## The write that does not happen
 *
 * `removePreset` and `setDefaultPreset` in the model answer **the same object** when there
 * is nothing to do — an id matching no preset, and an id that is already the default. That
 * is taken at its word, by reference rather than by case: if the model hands back what it
 * was given, no repository call is made, `mutation` never leaves `idle`, and the answer is
 * `unchanged`, because the settings already say what was asked for. `savePreset` always builds a
 * new object and so always writes, including for a draft the settings already hold.
 *
 * ## When the settings have not loaded
 *
 * Every writer answers `refused` and does nothing, and **this is decided before the
 * paragraph above**. The order is the point: with nothing loaded every id matches nothing,
 * so both rules claim the case. Answering `unchanged` there would say the settings already
 * hold what was asked for, and we do not know what they hold.
 *
 * ## Between operations
 *
 * `mutation` is `idle` at mount, and `idle` again after an operation the repository
 * accepted. Starting an operation clears a `failed` mutation, so a screen that shows the
 * error and then lets a person try again has nothing of its own to clear.
 *
 * ## The edges
 *
 * `usePresets` outside a `PresetsProvider` throws: a default value would let a screen
 * render against settings nobody is loading. The provider reads `repository` once, at
 * mount; handing it a different one later starts nothing. An answer arriving after the
 * provider has unmounted is dropped.
 */
export type Presets = {
  presets: PresetsState
  mutation: MutationState
  reload: () => Promise<void>
  savePreset: (draft: PresetDraft) => Promise<Written>
  removePreset: (id: PresetId) => Promise<Written>
  setDefaultPreset: (id: PresetId) => Promise<Written>
}

/**
 * The handle a test holds on a fake repository, and the app never does.
 *
 * `held` answers the document storage holds right now — the value of the `stylePresets`
 * field, in the shape a document carries, not a copy of the settings. It is how a caller
 * checks that a save replaced rather than merged. Before the first save it answers the
 * document the fake was made with, exactly as given: a malformed one comes back malformed,
 * because repairing it is `load`'s work and not storage's.
 *
 * `failNextLoad` and `failNextSave` arm one failure each, independently of one another. The
 * next matching call rejects with that error — the same object, not an equal one — and the
 * call after it succeeds; an armed failure that is never reached stays armed. One shot
 * rather than a mode, because what a screen has to survive is failing, showing it, and
 * succeeding on the retry.
 *
 * **A rejected save leaves the document untouched.** So a retry writes over what was there
 * before the failed attempt rather than over half of it, and a screen showing the error is
 * telling the truth about what storage holds.
 *
 * `setDelay` applies to every call started after it is set, an armed failure included — a
 * failure that arrives instantly is not the failure a screen has to survive. A call already
 * in flight keeps the delay it started with.
 */
export type FakeControl = {
  held: () => unknown
  setDelay: (ms: number) => void
  failNextLoad: (error: ApiError) => void
  failNextSave: (error: ApiError) => void
}

/**
 * A repository holding one space's settings in memory, and the handle that makes it
 * misbehave.
 *
 * `document` is what storage holds at the start — the same `unknown` `toSettings` reads, so
 * a fake takes a malformed document as readily as a good one. Absent, storage holds
 * `undefined`, which is a space nothing has ever written.
 */
export type CreateFakeRepository = (document?: unknown) => {
  repository: PresetRepository
  control: FakeControl
}

/**
 * The repository the plugin runs on, over the space-settings route.
 *
 * `read` asks the route for the whole settings document and answers the value of its
 * `stylePresets` field — `undefined` when the space has none, which is a space nobody has
 * configured and not a failure.
 *
 * `write` sends that field and no other. The route and the store beneath it write each
 * field whole and leave the rest alone, so a preset save cannot disturb the words a
 * translation must not touch, and two settings never have to be saved together.
 *
 * Everything that goes wrong arrives as `ApiError`, and its `kind` says which of three
 * things happened: `network` for a request that never produced a response, `http` for a
 * response whose status says no — carrying that status — and `malformed` for a response
 * that said yes and whose body could not be read.
 *
 * A response that said yes and carried no body at all is the first of those two and not
 * the third: the route sends an empty body for a space the store holds nothing for, so an
 * empty answer means nobody has configured the space, never that something went wrong.
 *
 * It is built through `overStorage`, so it never sees `StyleSettings`.
 */
export type CreateHttpRepository = (spaceId: number) => PresetRepository
