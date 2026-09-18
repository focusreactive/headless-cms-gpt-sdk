# Brand voice and tone — research before the task

Date: 17 September 2026.

**This continues [2026-09-08-translation-quality-and-brand-voice.md](./2026-09-08-translation-quality-and-brand-voice.md).**
That research put four items in scope. Three have shipped since; brand voice is the one
left. It also left two *blocking* questions unanswered — both are answered below, one by
events and one by reading the code, so this work is no longer blocked.

## 1. What came in

- Source: the owner, in conversation, plus a pointer to Sanity's AI-translations product
  page as a reference for what such a feature usually carries.
- Explicit request: let the user set translation style and brand voice; consider a
  glossary of terms.
- Implicit expectation: this is the original customer ask (Xweather) that has still not
  been built.
- Constraint stated: the owner's model budget is a few dollars; anything that multiplies
  request cost has to be counted.
- The owner is away and asked for a decision rather than questions.

## 2. What changed since 8 September

| September plan item | Status |
|---|---|
| 1. Batching — one request per story instead of per field | **shipped** (PR #36) |
| 2. Strict response schema, `join(" ")` hotfix removed | **shipped** (PR #35, merged) |
| 3. **Brand voice: a stored setting** | **not built** — this task |
| 4. Model update | **shipped** |

### The two blocking questions, closed

**Q1 — "what exactly is the client's complaint?"** *Closed by events, not by an answer.*
September's reasoning was that the complaint was most likely caused by the pipeline
(one request per field, no shared context) rather than by a missing brand voice, and
that this decided the order of work. That hypothesis was acted on: batching, inline
markers, embedded components and the re-translation defect are all fixed and measured.
Whatever remains is now the part brand voice was always meant to cover. The ordering
question the blocker existed to settle no longer has two sides.

**Q2 — "Firestore next to the not-translatable words, or a document inside Storyblok?"**
*Closed by code.* The route already exists and is proven in production use:

- `packages/storyblok-ai-tookit/pages/api/space-settings.ts` → `getSpaceSettings` /
  `saveSpaceSettings` from `@focus-reactive/sb-plugins-storage-sdk`, keyed by
  `spaceId` + `pluginId`;
- it already carries `notTranslatableWords: { set: string[], limit: 50 }`;
- `Localization/index.tsx` reads it on mount (GET) and writes on translate (POST);
- `DEV_SKIP_FIREBASE=true` gives a local stub, so development needs no Firebase.

A Storyblok-side document would need new plumbing, new permissions and a second source of
truth, and buys nothing. **Decision: store beside `notTranslatableWords`.**

## 3. Code map

| Path | Role in this task |
|---|---|
| `packages/storyblok-ai-tookit/pages/api/space-settings.ts` | storage route; destructures accepted fields explicitly, so a new field must be added here |
| `packages/storyblok-ai-tookit/src/components/Localization/index.tsx` | GET on mount, POST on translate; owns the reducer state |
| `packages/storyblok-ai-tookit/src/components/Localization/modes/Story/index.tsx` | the story-mode form — where the not-translatable words UI lives, and where the new fields belong |
| `packages/storyblok-ai-tookit/src/context/AppDataContext.ts` | already supplies `languages: {code, name}[]` — the source a per-locale variant would need |
| `packages/storyblok-ai-sdk/src/features/localization/localizeStory/index.ts` | composes the prompt: `[props.promptModifier, MARKER_INSTRUCTION].filter(Boolean).join("\n")` — the injection point |
| `packages/storyblok-ai-sdk/src/features/localization/batching.ts` | `DEFAULT_MAX_CHARACTERS = 12000`, `DEFAULT_MAX_TEXTS = 80` — the budget any added prompt text is charged against, once per batch |
| `packages/content-ai-sdk/src/features/translations/translateJSON.ts` | `promptModifier?: string` becomes the system message; **its signature does not need to change** |

**Prior art:** `feature/add-custom-prompt` (PR #33, base `main`, 8 commits behind, one
commit) adds a `CustomPromptInput.tsx` and its checklist is the requirement source:
split prompt modifier and custom prompt; one field for brand voice, one for tone; make
the model understand which is which; tests; the same params for Sanity; issues for the
Contentful and Payload plugins. Issue #24 has a title and no body.

**Branch:** this work stacks on `feat/batch-and-markers` (PR #36), not on `main`.
`localizeStory/index.ts` differs between them by −246/+69 — the prompt composition point
on `main` is a function #36 deletes.

## 3b. Stored shape

One document in the existing Firestore collection `SpaceSettings`, one per
(`spaceId`, `pluginId`) — the same document `notTranslatableWords` already lives in.
Firestore is schemaless: the field appears on first write, nothing is declared anywhere.

```json
{
  "pluginId": 123,
  "spaceId": 293915,
  "createdAt": "<Timestamp>",
  "modified": "<Timestamp>",

  "notTranslatableWords": { "set": ["Weather API"], "limit": 50 },

  "stylePresets": {
    "defaultId": "p1",
    "items": [
      {
        "id": "p1",
        "name": "Product pages",
        "byLocale": {
          "fr": {
            "formality": "formal",
            "voice": ["precise", "technical", "plain-spoken"],
            "instructions": "Audience: developers integrating a weather API."
          },
          "de": { "formality": "formal", "voice": ["precise", "technical"] }
        }
      },
      { "id": "p2", "name": "Legal",
        "byLocale": { "fr": { "formality": "formal", "voice": ["literal", "precise"] } } }
    ]
  }
}
```

| | |
|---|---|
| `stylePresets` | the only new top-level field |
| `defaultId` | id of the preset used when the editor picks nothing |
| `items[].byLocale` | keyed by the Storyblok language code — the same code that forms `__i18n__<code>` |
| `formality` | `formal` / `informal` / `casual`, optional |
| `voice` | 3–5 adjectives, optional — the brand-voice half, kept structured on purpose |
| `instructions` | free text, capped at 500 characters, optional |
| `notTranslatableWords` | unchanged, stays global — it is this plugin's `protectedPhrases` |

### Why a preset holds locales, and not the other way round

The preset is what the editor selects, so it must have one identity. Grouping by locale
would make "Legal" a separate row per language tied only by a matching name — rename one
and the link breaks, delete one and that language silently loses it. Grouping by preset
also makes the frequent operation cheap (adding a preset is one entry, not one per
locale) and leaves the rare one — adding a language — to degrade quietly.

### Why `defaultId` and not a boolean on each item

An array with a `default: true` flag can hold zero defaults or two, and nothing in the
data prevents it; the invariant would have to be maintained by every writer. One field
holding one id makes both states unrepresentable, and makes deleting a preset harmless.

### Rules a writer must honour

1. **Write `stylePresets` whole.** Firestore's `updateDoc` merges at the top level but
   replaces a nested object outright, so sending one preset drops the others. The plugin
   loads the whole object on mount, so it has it.
2. **An absent `stylePresets` is a working state.** Documents written before this change
   have none, and for them the request must be byte-identical to today's — no empty
   labels, no stray separators.
3. **A preset with no entry for the target locale contributes nothing.** No falling back
   to the default preset's entry: quietly substituting a different voice is worse than
   substituting none.
4. **A `defaultId` naming no existing preset is treated as unconfigured**, by the same
   rule.

### Storage code that has to change

`saveSpaceSettings` in `@focus-reactive/sb-plugins-storage-sdk` names its fields
explicitly (`{ pluginId, spaceId, notTranslatableWords }`) and will not carry a new one.
Make it indifferent to the field set — `{ pluginId, spaceId, ...settings }` — so the next
setting needs no change there. That package is in this monorepo but is **published
separately**, making it the third package in the release order; local development already
runs all of them through yalc, so this adds a link, not a blocker.

`DEV_SKIP_FIREBASE=true` in `pages/api/space-settings.ts` returns a local stub, so the
form, the preset picker and the prompt assembly can all be built and exercised with no
Firebase access at all. In that mode writes are a no-op, so persistence itself is the one
thing that can only be checked against the real store.

### When the glossary arrives

It lands as a sibling top-level field and disturbs none of the above:

```json
"glossary": {
  "sourceLanguage": "en",
  "terms": [{ "term": "forecast", "translations": { "fr": "prévision" } }]
}
```

## 4. Task definition

### Problem statement

An editor cannot tell the translator how the brand should sound. Every translation of
every space uses the same neutral voice the model defaults to, and the only lever that
exists — `promptModifier` — is not exposed in the UI, so in practice it is always empty.
The customer asked for this first and it is the last unbuilt item of the agreed plan.

### In scope

1. A stored style guide **per target locale**, with four parts — the shape Sanity's own
   Studio uses, seen in the product video:
   - **formality** — a closed choice (formal / informal / casual), not free text;
   - **voice** — a short list of 3–5 adjectives, not a paragraph. An earlier draft cut
     this, arguing free text covers it. It does, literally, and that is the problem: the
     free-text field already exists as `promptModifier`, has existed for months, and has
     never been filled in by anyone. The constraint is the feature — three orthogonal
     words make a crisp line in the prompt where a paragraph makes marketing copy;
   - **instructions** — free text, for what the structure cannot hold;
   - keyed by the target language code.
2. UI in the localization screen showing **only the locale being translated into** —
   the editor already picks the target language before translating, so this is one form,
   not one per language.
3. Persisted through the existing `/api/space-settings` route; loaded on mount, applied
   to every subsequent translation into that locale.
4. Composed into the prompt in `localizeStory`, alongside `MARKER_INSTRUCTION`, each part
   under a label that names what it is.
5. A length cap on the free-text part, enforced in the UI.
6. Pass `currentLanguage` to `translateJSON`. The parameter already exists and is already
   wired into the system message; the plugin has never sent it. See §7.

### Out of scope

- **Glossary of terms** — deferred, with reasons in §6.
- Applying brand voice to `summariseStory` and `findRelevantTags` — both already take
  their own `promptModifier`; widening that is a separate decision.
- Any change to `translateJSON`'s signature. `content-ai-sdk` shipped 0.0.16 with a
  breaking protocol change; a second breaking change in a row is not warranted when
  composition in the SDK achieves the same result.
- The same params for Sanity, and issues for Contentful/Payload (PR #33's checklist
  items 4–5) — follow-ups, not this task.

### Non-functional review

- **Performance / cost** — relevant. The fields enter the system message of **every
  batch**. At `DEFAULT_MAX_CHARACTERS = 12000`, 500 characters of instruction is ~4%
  overhead per batch; 5000 characters would be ~42%. This is what the cap in scope
  item 5 is for, and why it is a criterion rather than a nicety.
- **Security** — N/A for this change. The pre-existing browser key exposure
  (`NEXT_PUBLIC_OPENAI_TOKEN`) is unchanged and remains a separate task.
- **Accessibility** — relevant but low: two labelled text inputs in an existing MUI form;
  follow the labelling already used by the not-translatable words field.
- **i18n / localization** — the subject of the task; the plugin UI itself is English-only
  and stays so.
- **Observability** — relevant. Usage events already go to Firestore; the instrumentation
  in `debug/measure.ts` can report the added prompt size, but no new telemetry is in scope.

### Acceptance criteria (draft)

1. Given a locale with a saved style guide, when a story is translated into it, then
   formality, voice and instructions appear in the request's system message, each under a
   label that names which it is. Check: a unit test on the prompt composition in
   `localizeStory`.
1b. Given two locales with different style guides, translating into each uses its own and
   not the other's. Check: the same test, two locales.
2. Given a space with no saved settings, when a story is translated, then the request is
   byte-identical to today's. Check: the same test, empty case — no stray separators or
   empty labels.
3. Brand voice and tone survive a reload: saved once, they apply to every later
   translation in that space without being re-entered. Check: save, reload the plugin,
   translate, inspect the request.
4. The free-text part is capped, and the UI prevents exceeding the cap rather than
   truncating silently. Check: a UI test at the boundary.
4b. `currentLanguage` reaches the request, naming the source language. Check: a unit test
   on the call; and one live run over a story containing Latin filler, which today comes
   back as invented French.
5. **Negative path** — if the settings store is unavailable, translation proceeds without
   brand voice and says so, instead of failing. Check: a test with the store rejecting.
   *(carried over from September's AC 6)*
6. **Negative path** — a brand voice containing the marker syntax (`<1>`, `</1>`) does not
   corrupt the marker contract. Check: a test with such a value.
7. The translated output for a fixed story differs between "no brand voice" and "a brand
   voice set" — the feature demonstrably reaches the model. Check: one live run per
   variant on one story, outputs compared by hand.

### Open questions

Coverage scan, with every item either answered or listed:

1. **Failure and error states** — answered: AC 5 fixes the behaviour when the store is
   down; the existing retry and `unparsedBlockKeys` reporting are unchanged.
2. **Empty / first-run states** — answered by AC 2: an unset space behaves exactly as now.
3. **Boundaries and limits** *[non-blocking]* — what the cap should be. Proposed: **500
   characters per field**, from the cost arithmetic above (~4% of a batch). Nobody has
   stated a requirement; this is `[inferred]` from the batch size constant.
4. **Permissions and roles** *[non-blocking]* — any editor who can open the plugin can
   change the brand voice for the whole space; `notTranslatableWords` already works this
   way, so this matches existing behaviour rather than introducing a new exposure.
5. **Concurrency / compatibility** — answered: two editors saving concurrently is
   last-write-wins, as `notTranslatableWords` already is; spaces with no saved value keep
   working (AC 2).
6. **Restate check** — "brand voice" here means a persistent, space-wide instruction about
   voice and register, not a per-story custom prompt; "tone" means register (formal,
   playful, technical) as distinct from identity. If PR #33's author meant a per-story
   field, AC 3 is wrong. `[inferred]` from PR #33's checklist wording.
7. **September's AC 5 — per-locale additions** — *now in scope.* An earlier draft of this
   document deferred it, arguing that a per-locale field means a form per language nobody
   fills in. Two things overturned that. First, register is a property of the **target
   language**, not a preference: Sanity's own example for Mexican Spanish reads "use 'tú'",
   "Latin American, not Castilian" — instructions that mean nothing in French, while French
   has its own tu/vous and German its du/Sie. Second, the objection was about UI, and the
   UI answers it: the editor picks the target language before translating, so the form
   shows one locale, not N. Recorded so the reversal is visible rather than silent.

Unresolved **blocking** questions: **0**.

### Risks and constraints

- The prompt is charged per batch, not per story — the cap is the only thing between a
  verbose brand voice and a multiplied bill.
- `space-settings.ts` destructures accepted fields by name; forgetting to add the new ones
  there makes the POST silently drop them, with no error anywhere. This is the most likely
  way to ship a feature that appears to work and saves nothing.
- `content-ai-sdk` is published by hand with no CI, and the owner will not publish until
  the functionality is finished. Local work runs through yalc, and the dependency
  substitutions in `package.json` must stay uncommitted.
- PR #33's branch is 8 commits behind `main` and based on `main`, not on #36. Its one
  commit will need re-doing rather than merging.

## 5. Readiness

- Unresolved `[blocking]` questions: **0**
- In-scope items with no acceptance criterion: **0**

Soft spots, stated plainly: the 500-character cap is inferred from the batch constant
rather than requested, and the brand-voice/tone split follows PR #33's checklist rather
than a stated user need.

**Next step: `/sp-task`.** Not `/sp-architect`: the storage question that sent September's
research toward design is now answered by existing code, no module boundary moves, no data
model is introduced (one more field on a document that already exists), and
`translateJSON`'s contract does not change. Vector hint: **structure only**.

## 6. Why the glossary is deferred

The glossary was the more valuable of the two on first look. Three findings moved it down,
and the first is the one that matters.

1. **Batching already bought most of it.** The glossary's main argument was that the model
   reconciles terminology only within one request, so a term could come back two ways on
   one page. With `DEFAULT_MAX_CHARACTERS = 12000` and `DEFAULT_MAX_TEXTS = 80`, a typical
   marketing page is a single batch — the model sees every text at once and reconciles on
   its own. What remains is cross-*story* consistency and stories large enough to split.
   Real, but much smaller than the problem as originally framed.
2. **Sanity's hard-constraint trick does not transfer.** Their `protectedPhrases` is a
   separate API parameter because the translation runs inside their own Agent API. Ours
   calls OpenAI chat completions directly, where there is no channel other than the
   prompt. Copying the shape would give the appearance of a hard constraint and the
   behaviour of a soft one.
3. **Half of it already exists.** `notTranslatableWords` is Sanity's `doNotTranslate`,
   already stored, already exposed, already reaching the request. The genuinely missing
   half is "translate this term *this way*" — worth building, but on its own evidence.

### The shape, as their Studio actually shows it

A glossary is a **named document** ("Ecommerce Terminology"), bound to a **source locale**
(en-US — the language the terms are written in), holding a list of entries, each carrying a
**status** ("Approved"). More than one glossary can exist per project.

The sample glossary holds **six terms**, and that number corrects an argument made earlier
in this document. The cost case for deferral assumed a glossary large enough that injecting
it whole would crowd the batch, and that filtering entries against each batch's text was
therefore required. A real glossary is a small curated list: six terms is a few hundred
characters, cheaper than the marker instruction already in every request. **Filtering is
premature optimisation at that size** — inject the whole thing, and revisit only if a
customer's list passes a few hundred entries.

So when it is built: `{ term, translations: Record<lang, string> }` bound to a source
locale, injected whole. The status field is not decoration in their product — it is what
separates an approved term from a provisional one before injection — but it presumes an
editorial review process, and this plugin has one customer and no such process. Skip it
until someone needs it, and keep part-of-speech, definition and context out entirely.
