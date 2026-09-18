/**
 * Style presets, in the shape `docs/plans/2026-09-17-brand-voice.md` §3b specifies. The
 * shape is not this file's to choose: it is what the storage route writes and what the
 * prompt composition reads, and §3b carries the signed reasons for both halves of it —
 * why a preset holds locales rather than the other way round, and why the default is one
 * id rather than a flag on each item.
 *
 * Two rules hold over everything below and are not repeated on each operation:
 *
 *   - **nothing here modifies what it is given.** Every operation builds its answer.
 *   - **the settings passed in and the settings returned may share sub-objects.** Only
 *     `toStored` promises otherwise, because only `toStored` hands its answer to code that
 *     will keep it.
 */

export type LanguageCode = string

export type PresetId = string

export type Formality = 'neutral' | 'formal' | 'informal'

/** One adjective. An object rather than a bare string so a word can gain a field later. */
export type VoiceWord = { word: string }

/**
 * What a preset says about one language. Every part is optional: a preset covering a
 * language only to say "be formal" is a normal thing to have.
 */
export type LocaleStyle = {
  formality?: Formality
  voice?: VoiceWord[]
  instructions?: string
}

/**
 * One preset, covering as many languages as it has been given settings for. A preset with
 * none is legal — it contributes nothing, which is the limit of §3b's rule that a preset
 * with no entry for the target locale contributes nothing.
 */
export type StylePreset = {
  id: PresetId
  name: string
  byLocale: Record<LanguageCode, LocaleStyle>
}

/**
 * `defaultId` naming no preset reads as unconfigured rather than as an error (§3b rule 4),
 * which is what lets `removePreset` leave it alone.
 *
 * Where an operation below says it "returns the settings unchanged", it returns **the same
 * object**, so a caller may compare by reference to know nothing happened.
 */
export type StyleSettings = {
  defaultId?: PresetId
  items: StylePreset[]
}

/**
 * Reads the value of the `stylePresets` field out of storage, which is schemaless.
 *
 * That value carries two keys and no others: `defaultId`, a string, and `items`, an array.
 * They are spelled as `StyleSettings` spells them.
 *
 * ## When nothing survives
 *
 * `undefined`, a value that is not a plain object, and an `items` that is not an array all
 * give `{ items: [] }` — a space written before this feature has no such field and must
 * keep working (§3b rule 2). `defaultId` goes with them: there is nothing left for it to
 * name.
 *
 * ## `defaultId`
 *
 * Kept when it is a string, **including when it names no preset in `items`** — rule 4
 * already reads that as unconfigured, and `removePreset` deliberately leaves such ids
 * behind, so reading must not tidy them away. Dropped when it is anything else.
 *
 * ## Which presets survive
 *
 * Dropped, in the order given: an element that is not a plain object; one whose `id` is
 * not a string, or is a string that trims to nothing — it could never be selected, renamed
 * or deleted; one carrying an `id` an earlier surviving preset already carries — the first
 * wins, because `savePreset` and `validatePreset` both address a preset by its id and
 * neither can mean two of them. The order of what survives is the order given.
 *
 * ## What is repaired inside a surviving preset
 *
 * A field that cannot be read is replaced by the empty value of its type and the record
 * survives — nothing a person typed is dropped for being malformed. So a `name` that is
 * not a string becomes `''`, which `validatePreset` then reports; a `byLocale` that is not
 * a plain object becomes `{}`.
 *
 * Two places drop rather than repair, both because an empty value there would be a claim
 * rather than a blank:
 *
 *   - **a locale entry that is not a plain object** — `null` and arrays included — is
 *     dropped from `byLocale`. The list tells a person which languages a preset covers,
 *     and an empty entry would claim a language the preset says nothing about;
 *   - **a `voice` element that is not a plain object, or whose `word` is not a string**, is
 *     dropped from the list. `savePreset` drops words that trim to nothing on the way in,
 *     so reading and writing agree on what counts as a word.
 *
 * Inside a surviving locale entry: a `formality` that is not one of the three values is
 * **dropped** rather than repaired — the type has no empty value, and `neutral` would
 * fabricate a choice. Nothing is lost by it: with no inheritance anywhere, an absent
 * `formality` and `neutral` say the same thing. An `instructions` that is not a string
 * becomes `''`; a `voice` that is not an array becomes `[]`.
 *
 * Fields the shape does not name are not kept, on a preset or on a locale entry —
 * `toStored` would not write them back, so keeping them would only promise a round trip
 * that does not happen.
 *
 * The answer holds no array or object from `stored`.
 */
export type ToSettings = (stored: unknown) => StyleSettings

/**
 * The value to write to the `stylePresets` field: `items` always, `defaultId` only when the
 * settings carry one. No other key.
 *
 * It writes the settings as they are — trimming and dropping belong to `savePreset`, which
 * is the only way a person's typing gets in. It shares no array or object with the
 * settings, because what it returns is handed to code that keeps it.
 */
export type ToStored = (settings: StyleSettings) => Record<string, unknown>

/**
 * Writes one language of one preset — the only way a preset is created or changed.
 *
 * It takes a `PresetDraft` rather than a `StylePreset` because the form holds one
 * language: handed a whole preset, the screen would have to rebuild `byLocale` itself, and
 * the language it never displayed is the one it would drop. **Every language of the preset
 * other than `draft.locale` survives untouched**, and that is this function's reason to
 * exist.
 *
 * ## The entry for `draft.locale`
 *
 * **Replaced outright, never merged** with what was there. The form shows all three fields
 * at once, so a field the draft leaves out is a field the person cleared, and merging
 * would make clearing impossible.
 *
 * An entry saying nothing is removed from `byLocale` rather than written as `{}`: the list
 * tells a person which languages a preset covers, and an entry that contributes nothing
 * would claim one it does not. Saying nothing means no instructions after trimming, no
 * voice word surviving the trim, and a formality of `neutral` or none — `neutral` states
 * exactly what stating nothing states, since §3b inherits from nowhere.
 *
 * ## Creating against changing
 *
 * An id no preset carries appends a new preset — the screen mints the id when it opens the
 * create form, so creating and editing are one operation and saving the same draft twice
 * does what saving it once did, judged by value. A draft that says nothing still appends:
 * the preset then covers no language, and the list reports that honestly rather than
 * swallowing a save. The position of an existing preset in `items` is kept, and so is
 * `defaultId`.
 *
 * ## Normalisation
 *
 * The draft is normalised on the way in, because storage is the last place that can do it:
 * `name` and `instructions` are trimmed, voice words are trimmed and the ones left blank
 * are dropped.
 *
 * A fresh settings object comes back every time. This operation writes; there is no case
 * where it reports "nothing happened" by returning what it was given.
 */
export type SavePreset = (settings: StyleSettings, draft: PresetDraft) => StyleSettings

/**
 * Whether a locale entry contributes nothing: no instructions after trimming, no voice
 * word surviving the trim, and a formality of `neutral` or none.
 *
 * It is exported, rather than being `savePreset`'s private business, because three places
 * far apart have to agree on it: `savePreset` refuses to store such an entry, `resolveStyle`
 * answers `null` for one, and the list counts how many languages a preset covers. They
 * disagreeing is not hypothetical — settings arriving from storage **can** hold such an
 * entry even though `savePreset` never writes one, because `toSettings` repairs a malformed
 * entry and keeps it rather than dropping what a person typed. So the shape exists, and
 * every reader has to answer the same way about it.
 */
export type SaysNothing = (style: LocaleStyle) => boolean

/**
 * Removes it and keeps the order of the rest. **`defaultId` is left as it is**, even when
 * it named this preset: §3b chose one id over a flag precisely so that deleting is
 * harmless, and a dangling id already reads as unconfigured. An unknown id returns the
 * settings unchanged.
 */
export type RemovePreset = (settings: StyleSettings, id: PresetId) => StyleSettings

/**
 * Names the preset the space falls back to, replacing whatever was named before.
 *
 * An unknown id returns the settings unchanged, and so does an id that is already the
 * default — in both cases there is nothing to write.
 */
export type SetDefaultPreset = (settings: StyleSettings, id: PresetId) => StyleSettings

/**
 * What a translation into `locale` should use, or `null` when nothing is configured for
 * it — the drawn case, not a failure.
 *
 * `null` covers all of: no `defaultId`, a `defaultId` naming no preset, a default preset
 * holding no entry for that locale, and one holding an entry that `saysNothing` — an entry
 * that contributes nothing is the same answer as no entry, and a caller must not have to
 * tell them apart. **There is no falling back** to another locale's entry or another
 * preset's: §3b rule 3 — quietly substituting a different voice is worse than substituting
 * none.
 *
 * What comes back is the entry the settings hold, not a copy of it. Callers read it.
 */
export type ResolveStyle = (
  settings: StyleSettings,
  locale: LanguageCode,
) => LocaleStyle | null

/**
 * What the form edits: the preset's name, and one language's settings.
 *
 * `id` is always set, for a preset being created as much as for one being edited — the
 * screen mints it when it opens the form. That is what lets `savePreset` be one operation
 * and `validatePreset` decide self-collision by id without a special case for the new.
 */
export type PresetDraft = {
  id: PresetId
  name: string
  locale: LanguageCode
} & LocaleStyle

/** Every way a draft can be wrong. A screen turns one of these into a sentence. */
export type PresetErrorType = 'required' | 'taken' | 'tooLong' | 'tooMany' | 'duplicate'

/**
 * What `validatePreset` reports: at most one entry per field, and each field naming only
 * the errors it can actually carry.
 *
 * Written out per field rather than as `Partial<Record<PresetField, { type: PresetErrorType }>>`
 * so that the pairing is held by the compiler instead of by the prose below. A screen
 * switching on `errors.name?.type` then has two cases to answer, not five, and cannot be
 * left handling three that never arrive. `id`, `locale` and `formality` cannot be got
 * wrong, so they appear nowhere.
 */
export type PresetErrors = {
  name?: { type: 'required' | 'taken' }
  voice?: { type: 'tooMany' | 'duplicate' }
  instructions?: { type: 'tooLong' }
}

/** The fields a person types into. */
export type PresetField = keyof PresetErrors

/**
 * `siblings` is every preset the settings hold, the draft's own included — a preset being
 * edited does not collide with itself, which is decided by id, not by name.
 *
 * The rules, one per reported entry:
 *
 *   - `name` **required** — empty, or only whitespace;
 *   - `name` **taken** — a name another preset carries, compared case-insensitively with
 *     both names trimmed. There is no per-language qualification: a preset has one name,
 *     and the collision holds whatever languages either preset covers;
 *   - `instructions` **tooLong** — longer than `INSTRUCTIONS_MAX` code units, measured
 *     before trimming, because that is the length the person is looking at;
 *   - `voice` **tooMany** — more than `VOICE_MAX` words, counting only those that do not
 *     trim to nothing. `savePreset` drops the blank ones, so counting them here would
 *     refuse a list that would have been stored within the limit, and name no word the
 *     person could remove;
 *   - `voice` **duplicate** — the same word twice, compared on `word` case-insensitively
 *     after trimming, with entries that trim to nothing taking no part.
 *
 * One entry per field, so where two rules claim one: on `name`, `required` before `taken`;
 * on `voice`, `tooMany` before `duplicate`. The first of those is load-bearing rather than
 * cosmetic — `toSettings` repairs an unreadable name to `''`, so two presets repaired that
 * way collide with each other, and reporting `taken` there would send a person looking for
 * a name nobody typed.
 *
 * No `message` is set — the wording belongs to the screen, which interpolates the
 * offending name.
 */
export type ValidatePreset = (
  draft: PresetDraft,
  siblings: readonly StylePreset[],
) => PresetErrors

export const INSTRUCTIONS_MAX = 500

export const VOICE_MAX = 20
