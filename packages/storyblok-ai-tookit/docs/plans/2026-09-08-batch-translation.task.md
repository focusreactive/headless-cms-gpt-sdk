# Task A: batching text for translation

Date: 8 September 2026. Precedes: `2026-09-08-translation-quality-and-brand-voice.md`.

## Goal

Send a story's texts for translation in batches instead of one request per field, so
the model sees the whole content and keeps terminology consistent.

## In scope

1. The exchange format with the model: a `key → text` object instead of an array of values.
2. Removing the `join(" ")` hotfix.
3. Grouping fields into batches with a size limit.
4. Retrying a batch on failure.

## Out of scope

- Switching the unit of translation to a paragraph with placeholders (Task B) — grammar
  within a paragraph isn't fixed by this task.
- Brand voice.
- Switching the model (done separately, a one-liner).
- Moving translation to the server.

## Findings that shape the decisions

**The hotfix breaks not just the future but the present too.** In `translateJSON.ts:88`:

```js
const translationsFixed = [translations.join(" ")];
```

All translations are glued into one string, then distributed back to keys by index.
With one field per request this goes unnoticed. With several, the first key gets the
concatenation of all translations, and the rest get nothing.

**The Sanity plugin is unaffected by this — verified.** `sanity-ai-sdk` is pinned to
the published `@focus-reactive/content-ai-sdk` version **0.0.4** and gets it from npm.
The hotfix only appeared in 0.0.14 (commit `73180bb`, 26 February 2025); the built code
of version 0.0.4, which is what Sanity actually has in its dependencies, doesn't have it.

Two consequences for this task follow from that:

- our changes can't break translations in Sanity — it won't see them until someone
  manually bumps the dependency version;
- the exception is local development mode: the root `yarn dev` feeds in a fresh build
  via yalc, and then Sanity does get the changed code. This has no effect on production.

So Sanity stays out of scope for this task. The external signature of `translateJSON`
is kept unchanged regardless, so a future version bump doesn't turn into a breakage.

**Consumers of `translateJSON`:**
- `storyblok-ai-sdk/.../localizeStory/index.ts:115` — flat pairs, one per call;
- `sanity-ai-sdk/.../translateFullDocument/index.ts:31` — the whole nested document;
- `sanity-ai-sdk/.../translateSelectedDocumentFields/index.ts:61` — selected fields.

The external signature of `translateJSON` (takes an object, returns a JSON string)
stays the same — only the internal request shape and response parsing change.

## Changes by step

### Step 1. Exchange format — `content-ai-sdk`

File: `packages/content-ai-sdk/src/features/translations/translateJSON.ts`

- The request now carries a `{key: text}` object instead of an array of values.
- System message: translate the values, leave the keys unchanged, return an object
  with the same keys.
- The response is parsed by key; the `join(" ")` hotfix is removed.
- **Edge whitespace restoration is kept** — carried over to the new format and applied
  to each value by its key. The `// Fix spaces` block sits next to the hotfix (both
  landed in the same commit, `73180bb`), but it does something useful: it restores the
  leading and trailing whitespace of the source value, which the model regularly eats.
  In the current per-node scheme this is the only thing keeping words from running
  together at node boundaries. Removing it along with the hotfix would make the
  translation worse.
- A response value that isn't a string counts as no response: the field stays
  untranslated. Coercing it to a string risks writing `[object Object]` into the content.
- Not-translatable word substitution (`{{i}}`) is kept, applied to each value.
- The keys in the request are sequence numbers, not field paths: paths carry meaning
  and throw the model off, plus they make the request longer.
- Keys missing from the response don't fail the translation: the corresponding fields
  stay untranslated, and the caller gets their list.

### Step 2. Batches — `storyblok-ai-sdk`

File: `packages/storyblok-ai-sdk/src/features/localization/localizeStory/index.ts`

- `flattenFieldsForTranslation` now returns a single list of pairs instead of an array
  of one-field-each objects.
- A new splitting function: pairs are grouped into batches until the combined length
  of their values would exceed the limit (12,000 characters by default) or the number
  of values would exceed 80. A value longer than the limit travels in its own batch.
- Batches are sent sequentially rather than via `Promise.all` — this removes the burst
  load on the provider that currently has nothing limiting it.
- Reassembly (`mergeTranslatedFields`) doesn't change: it already works by field paths.

### Step 3. Retry on failure

- A batch is retried up to two times with increasing delay on a network error, a
  provider failure, or an unparseable response.
- Once retries are exhausted, translating the story stops with a clear error; no
  partial write to the story happens (same as now — the write happens only after
  everything succeeds).

## Acceptance criteria

| № | Criterion | How it's checked |
|---|---|---|
| 1 | Translating a story with N translatable fields produces no more than `ceil(total length / limit)` calls to the model instead of N | call counter in a test against a fake provider |
| 2 | A batch of three or more fields is distributed back to its own fields; no field gets someone else's text or is left empty | test: a stubbed response with three keys |
| 3 | There's no `join(" ")` hotfix left in the code | repository search |
| 4 | A response with missing keys: translated fields are written, missing ones keep the original, their list is returned to the caller | test: a response missing one key |
| 5 | A response with extra keys ignores the extras and doesn't fail | test: a response with an unrelated key |
| 6 | An unparseable response triggers a retry, and once retries are exhausted, an error without writing to the story | test: the provider returns garbage |
| 7 | Not-translatable words come back in the text unchanged under batching | test: two fields, each with its own not-translatable word |
| 8 | A value longer than the limit is sent as a separate batch and isn't truncated | batching test |
| 9 | A term appearing in two different fields of the story is translated the same way | manual run on a test story, before and after |
| 10 | A nested object (the Sanity case, `isFlat: false`) is translated without losing values — in case of a future version bump | test on `translateJSON` with a nested object |
| 11 | Edge whitespace of the source value is preserved, no extra whitespace is added | three tests: eaten trailing space, eaten leading space, a value with no whitespace |
| 12 | A non-string model response for a key leaves the field untranslated without affecting its neighbors | test: a response where one value is an object |

## Tests

`vitest` is wired up in `content-ai-sdk` (`test: vitest run`), there are no test files
yet — this task adds the first ones. Pure functions are covered: building the request,
parsing the response, not-translatable word substitution, batch splitting. The call to
the model is stubbed.

## Order of work

1. Tests for the current parsing behavior where it must be preserved.
2. Step 1 (exchange format) with tests — verified on the Sanity case, where the error
   shows up more clearly.
3. Step 2 (batches) with tests.
4. Step 3 (retries).
5. Manual run on a test story: compare the number of calls and terminology consistency.

Steps 1 and 2 are reversible independently; after step 1 the plugin works as before,
just with a different exchange format.

## Risks

- **The yalc link.** A change in `content-ai-sdk` requires a rebuild and re-feeding
  into the app; the verification cycle is slow.
- **Two consumers share one function.** Storyblok calls `translateJSON` with flat
  pairs, Sanity with a nested object. Right now Sanity sits on version 0.0.4 and won't
  see our changes, but the `isFlat: false` mode still needs test coverage, or a future
  version bump would surface the breakage at the client, not at us.
- **The size limit is a guess.** 12,000 characters is a starting value, to be refined
  after the first runs on real stories.
- **Terminology consistency is checked by eye.** There's no automated criterion for
  it; item 9 stays manual.

## Test status as of 8 September 2026

Tests were written by the `/sp-red-test` method, ahead of the implementation: the
contract was pulled out into a named type in `translateJSON.ts`, and the checks were
written by a blind author in a separate worktree, without the implementation file.

- `packages/content-ai-sdk/src/features/translations/translateJSON.test.ts` — 16 checks;
- red run on the stub: 16 out of 16 fail, none green;
- run on the current implementation: 15 fail, one passes (the error on an unreadable
  response).

The fifteen failures are exactly the list of gaps between the contract and the code
that step 1 closes.

Three decisions were made along the way and written into the contract, because they
hadn't existed anywhere before: an empty map doesn't call the model; an unreadable
response produces an error with the message `Failed to translate JSON`; a non-string
response counts as no response.

## Step 1 done — 8 September 2026

One file changed: `packages/content-ai-sdk/src/features/translations/translateJSON.ts`.

What changed:
- the model now receives a `sequence number → text` object; the system message asks it
  to return an object with the same keys and to leave placeholders like `{{number}}`
  untouched;
- the response is parsed by key: an unknown number is discarded, a non-string value
  counts as no response, and a missing key doesn't affect its neighbors;
- the `join(" ")` hotfix is removed;
- edge whitespace restoration is kept and extracted into `keepEdgeWhitespace`;
- not-translatable word substitution is extracted into `hideWords`/`revealWords` and
  applied to each value separately, rather than to the whole serialized string
  (previously a word matching a key name would have corrupted the structure);
- an empty `content` returns `{}` without calling the model.

### Decision made at the gate

The contract didn't specify which keys go to the model, and the blind test author
assumed the caller's keys. **Sequence numbers** were chosen (confirmed by the owner):
field paths in Storyblok are long and carry meaning that the model tries to take into
account. The contract was updated with an explicit note about this, and the stubbed
responses in seven checks were brought in line with the protocol — only the keys in
the provider's response changed, the checks' expectations stayed the same.

### Checks

| Criterion | How it was checked | Result |
|---|---|---|
| 2, 4, 5, 7, 10, 11, 12 | `vitest run` | 16 out of 16 green |
| 3 (no hotfix) | search for `join(" ")` in the file | 0 matches |
| Types | `tsc --noEmit` | clean |
| Linter | `eslint` on changed files | clean |
| Package and consumer build | `yarn build` in `content-ai-sdk` and `storyblok-ai-sdk` | both passed |
| Live run on the real model | three fields in one request | each field in its place, not-translatable word and edge whitespace preserved |

Criteria 1, 6, 8, 9 belong to steps 2–3 (batches and retries) and weren't checked here.

## Step 2 done — 8 September 2026

Batch sending. Translation logic was pulled out of `localizeStory/index.ts` into three
modules next to it, each with its own contract and tests (25 checks, all written
before the implementation):

| Module | Role | Checks |
|---|---|---|
| `localization/collectPairs.ts` | collected fields → flat `key → text` list | 4 |
| `localization/batching.ts` | list of pairs → batches (12,000 characters or 80 values) | 14 |
| `localization/applyTranslations.ts` | translations → back into the story | 7 |

`localizeStory/index.ts` shrank from 425 lines to 329: `flattenFieldsForTranslation`,
`mergeTranslatedFields`, and `replaceFieldValue` were removed; instead of `Promise.all`
with one request per field, batches are now sent sequentially.

### Translation keys

The key describes the text's location **in the story**, not in the sending list: a
regular field uses its own path (`content.body.0.headline`), a rich-text fragment uses
the field's path, a `#` sign, and the path of the node inside the field's document
(`content.body.1.body#content.0.content.0.text`).

The option "key = path inside the temporary structure of collected fields"
(`1.1.forTranslation.0.1`) was rejected: it wouldn't have required changes to the
collection step, but it's tied to the shape of the sending list, which this same step
rewrites. The owner chose story-based keys.

### Checks

| Criterion | How it was checked | Result |
|---|---|---|
| 1 (number of calls) | end-to-end run: 5 texts → 1 call | met |
| 6 (batch failure) | sequential loop, an error stops translation before the write | met |
| 8 (value longer than the limit) | batching test | met |
| Returning all translations of a batch | 7 `applyTranslations` checks | met |
| Types, linter, SDK build, app type-checking | `tsc`, `eslint`, `yarn build` | all clean |
| `content-ai-sdk` untouched | 16 checks | green |

Mutations: applying only the first translation turns the "fifty translations is fifty
fields" check red; removing the character limit turns 4 batching checks red.

End-to-end run on the real model: 5 texts in one call, fields distributed to their
places, the locale suffix set, the product name preserved, the source story untouched.

### What this step doesn't fix

Rich text is still translated node by node, so grammar within a paragraph hasn't
improved: "Kaufen | Xweather Horizon | heute und erhalten Sie…" instead of "Kaufen Sie
Xweather Horizon noch heute…". That's Task B — translating the whole paragraph with
placeholders.

## Step 3 done — 10 September 2026

Failure resilience. Key observation: "the model didn't answer a key" and "the whole
batch failed" are the same state (the key is missing from the result), so they're
handled by one mechanism.

A new module, `localization/translateInBatches.ts` (7 checks): sends pairs in
batches, collects the responses, and retries **once** for whatever came back
unanswered — including the keys of a failed batch. A failed batch doesn't stop the
pass. An empty string from the model counts as an answer: otherwise a field with no
content would get retried forever.

### Decisions from the owner

| Question | Decision |
|---|---|
| How many retries | one |
| What to do with untranslated content | write the original into the target field and show a warning with the list |
| Empty string | counts as an answer |

Substituting the original isn't a convenience, it's an integrity requirement: a
required field left without a value in a locale can get the whole entry rejected.
Storyblok has a locale fallback (`fallback_lang`), and the documentation doesn't
describe required-field validation on writes through the management API — we chose
not to find out the hard way and picked the safe behavior.

The `applyTranslations` contract changed: a field without a translation is now
**written** with the original text, instead of being skipped.

### Outward

`localizeStory` now returns a third field — `untranslated: string[]` (the source texts
the model didn't answer for). The extension is backward compatible, but the package's
public version will need to be bumped. Instead of "Success!", the app shows a message
like "Translated, except 2 field(s), which kept the original text: …".

### Checks

33 checks are green, types and the linter are clean, the SDK build passes, and the
app type-checks.

End-to-end run with a model that stubbornly refuses to answer one field: two calls
(the main pass and the retry for what came back unanswered), the untranslated field
written with the original, the list returned outward.

### Known limitation

Re-running translation after partial success translates the whole story again from
scratch, including what's already translated. Fixed by storing translation state —
separate work, deliberately out of scope.
