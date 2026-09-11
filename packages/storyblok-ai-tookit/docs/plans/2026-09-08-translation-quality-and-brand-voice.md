# Translation quality and brand voice — research before the task

Date: 8 September 2026. Trigger: client Xweather is unhappy with translation quality.
Proposed fix: add a configurable brand voice, global to the space.

## 1. What came in

- Source: a verbal brief from the client, with no examples of bad translation.
- Explicit request: store the brand voice globally; decide where to store it and whether to make it separate per locale.
- Implicit expectation: the brand voice by itself will raise quality.
- No contradictions in the input; the main gap is that the specific complaint about quality was never named.

## 2. Code map

### Storyblok plugin (this repository)

| File | Role |
|---|---|
| `packages/storyblok-ai-sdk/src/features/localization/localizeStory/index.ts` | collects translatable fields, splits them, glues them back together |
| `packages/storyblok-ai-sdk/src/features/localization/localizeStory/index.ts:351` | `flattenFieldsForTranslation` — one field per item |
| `packages/content-ai-sdk/src/features/translations/translateJSON.ts` | the actual model call, substitution of not-translatable words |
| `packages/content-ai-sdk/src/features/translations/translateJSON.ts:88` | the hotfix `translations.join(" ")` |
| `packages/content-ai-sdk/src/config/openAi.ts` | OpenAI client, `dangerouslyAllowBrowser: true` |
| `packages/storyblok-ai-tookit/src/components/Localization/index.tsx` | screen, collects not-translatable words, calls translation |
| `packages/sb-plugins-storage-sdk/src/index.ts` | Firestore: `SpaceSettings`, `UsageEvents`, limits |

Earlier attempts:
- branch `feature/add-custom-prompt` — a "Custom prompt" field with a hint about tone; **never finished**: the value never reaches the request;
- branch `feature/sb-translate-folder-script` — a `Bottleneck` queue and batching, but only in the script, not in the app.

### Payload plugin (for comparison)

`~/Documents/Projects/payload-plugins/packages/payload-plugin-translator`

| File | Role |
|---|---|
| `src/core/translation-pipeline/TranslationPipeline.ts:52` | a five-stage pipeline |
| `src/core/translation-pipeline/stages/text-expander/TextChunkExpander.ts:24` | end-to-end numbering of every text in the document |
| `src/core/translation-pipeline/stages/translation/Translation.stage.ts:15` | one model call for the entire document |
| `src/translation-providers/shared/parseAndValidateReply.ts:17` | parses and validates the model's reply |
| `src/translation-providers/shared/buildResponseSchema.ts:15` | a strict response schema |
| `src/translation-providers/shared/buildSystemPrompt.ts:26` | system prompt with room for overrides |
| `docs/plans/2026-06-15-translator-audit-findings.md` | audit: no splitting for the token limit; glossary and tone are on the roadmap |
| `docs/plans/2026-08-25-openai-provider-refresh-research.md` | lack of context and a glossary named as the main reason for the client's rejection |

## 3. Comparing the approaches

| Axis | Storyblok plugin | Payload plugin |
|---|---|---|
| Request unit | **one field — one request**, all in parallel | **the whole document — one request** |
| Context of neighbouring fields | none; only a page summary as a separate message | all the document's texts in one object, but without field names |
| Rich text | split by text node, **each node a separate request** | split by text node, **all nodes in one request** |
| Reassembly | by field paths (`replaceFieldValue`) | by numeric index through live references to the nodes |
| Response format | `json_object`, parsed without a schema | strict `json_schema` with a list of required keys |
| Response validation | none; a `join(" ")` hotfix stands in for it | parsing, type checks, key-set comparison, dedicated error classes |
| Model | `gpt-4o`, temperature 0, hardcoded | `gpt-4o` by default, set via configuration; no generation parameters forced |
| Where it runs | **in the editor's browser**, the OpenAI key in a variable prefixed `NEXT_PUBLIC_` | on the server |
| Rate limiting | none | nothing global; locales are translated strictly sequentially (deliberately, because of version overwrites) |
| Failure behaviour | `Promise.all` — one chunk failing brings down the whole translation, no retries | the task retries three times with increasing delay; no partial writes |
| Not-translatable words | **present**: `{{i}}` placeholders substituted before translation and restored after | none; a field can only be excluded entirely |
| Brand voice | none (abandoned branch) | nothing stored; there is a system-prompt function in the configuration |
| Usage accounting | present (Firestore) | none |

### What the comparison shows

Both share the same weakness — **rich text is split by node**, so a sentence with a highlighted word ends up traveling in pieces.

The key difference is **batch size**. The Payload plugin sends the whole document at once, so the model sees all the texts together and reconciles terminology on its own. The Storyblok plugin sends one field at a time, so it reconciles nothing — and this, not the missing brand voice, is the most likely cause of Xweather's complaint.

Reverse-transfer works the other way too: the not-translatable words list is implemented in the Storyblok plugin and missing from the Payload plugin, where it's still on the roadmap.

## 4. Task definition

The client is complaining about translation quality. Brand voice is the proposed remedy, but the research shows the main cause lies in how the pipeline is built: the model translates each field in isolation, with no neighbours and no markup. Brand voice is worth adding, but as one of three measures, not the only one.

### In scope

1. Batching: gather a story's texts into one request instead of one request per field.
2. Strict response schema and key validation; remove the `join(" ")` hotfix.
3. Brand voice: a stored setting, a base part plus per-locale additions.
4. Model update.

### Out of scope

- Moving translation to the server (closing the key leak) — a separate task, see risks.
- Merging neighbouring rich-text nodes into one sentence — a separate, more expensive task.
- Porting the not-translatable words list to the Payload plugin.

### Non-functional review

- **Performance**: one request instead of a hundred cuts both latency and the risk of hitting provider limits. Splitting by size is needed if a story is large.
- **Security**: the OpenAI key goes to the browser (`NEXT_PUBLIC_OPENAI_TOKEN`, `dangerouslyAllowBrowser: true`). For Xweather this means their dedicated key is visible to any editor. Significant, but out of scope for this task.
- **Accessibility**: not applicable.
- **Localization**: the whole point of the task.
- **Observability**: events are written to Firestore; batching should record the request size.

### Acceptance criteria (draft)

1. A story with N translatable fields produces at most `ceil(volume / threshold)` model requests instead of N. Check: the call log when translating a test story.
2. The model's reply is validated against the key list; on a mismatch, translation ends with a clear error instead of silently corrupting data. Check: a test with a fake response.
3. The `join(" ")` hotfix is removed, and a batch translation of several fields is distributed to its own fields. Check: a test on a batch of three fields.
4. Brand voice persists across sessions and applies to every subsequent translation in the space. Check: save, reload the plugin, translate.
5. A locale-specific addition to the brand voice is appended to the base, not a replacement for it. Check: a request-building test.
6. Negative path: if the settings store is unavailable, translation proceeds without the brand voice and reports this, instead of failing. Check: a test with an unavailable store.
7. Negative path: if the model returned not all the keys, the translated fields that came back are written, and the missing ones are reported. Check: a test with an incomplete response.

## 5. Open questions

1. **Client's complaint** *[blocking]* — what exactly is wrong: inconsistent terminology, broken grammar in rich text, wrong tone, invented content? Matters because the answer decides the order of work: tone is fixed by brand voice, everything else by batching.
2. **Brand voice storage** *[blocking]* — Firestore next to the not-translatable words, or a document inside Storyblok itself? Matters because moving it later costs more than choosing now.
3. **Split by locale** *[non-blocking]* — a base part plus additions is proposed; needs confirmation.
4. **Batch size threshold** *[non-blocking]* — by field count or by character count; a limit is needed so it doesn't run into the model's window.
5. **Scope of application** *[non-blocking]* — does brand voice affect only translation, or also the page summary and tags?
6. **Model change** *[non-blocking]* — which model replaces `gpt-4o`, and who covers the price difference.
7. **Brand voice length limit** *[non-blocking]* — a limit is needed, otherwise it enters every request and inflates usage.
8. **Compatibility** *[non-blocking]* — spaces without a saved brand voice must keep working as before.

## 6. Risks and constraints

- The `join(" ")` hotfix **will silently corrupt data** as soon as a batch holds more than one field: the first field gets all the translations glued together, the rest get nothing. It must be removed in the same change as batching.
- The OpenAI key is exposed in the browser — a separate task, but the client should be told.
- The app has neither retries nor rate limiting; with batching, one failure brings down the whole translation.
- The schema bypass relies on the `translatable` flag on Storyblok components; if it isn't set in the client's space, part of the text won't be translated at all — worth checking with Xweather before any improvements.

## 7. Readiness

- Unresolved blocking questions: **2**
- Scope items without an acceptance criterion: **0**

Next step: **answers are needed** for questions 1 and 2, then `/sp-architect` — the work touches module boundaries (content SDK, Storyblok SDK, app, storage) and changes the contract for exchanging data with the model. Likely angles to break down: `contract` (the exchange format with the model, the response schema), `data-model` (where the brand voice lives).

## 8. Clarifications (8 September 2026)

Four questions were asked, three of them deferred:

| Question | Answer |
|---|---|
| Where to store the brand voice | deferred, not yet decided |
| Task scope (fix the pipeline together with brand voice, or not) | not decided |
| One voice for all locales, or per-locale additions | deferred, next step |
| What exactly is wrong with the quality, in the client's view | no answer |

Status: research complete, not moving to design yet. There are still two blocking
questions (the client's complaint and the storage), and both remain open.

What's needed before continuing: two or three examples of bad translation from Xweather with links
to specific stories and locales. Without them, choosing between the three measures (batching,
merging rich-text nodes, brand voice) would be a guess.
