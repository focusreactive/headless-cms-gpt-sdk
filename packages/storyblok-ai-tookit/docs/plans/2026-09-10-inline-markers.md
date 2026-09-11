# Task B: markup markers in rich text

Date: September 10, 2026. Predecessors: `2026-09-08-batch-translation.task.md`,
`2026-09-08-translation-quality-and-brand-voice.md`.

## The problem

Rich text is translated node by node: a sentence broken up by a highlight or a
link goes to the model in fragments. The model has to return a translation for
each fragment separately and can't reorder words or move the highlight — in
languages with different word order, that produces grammatical garbage. Batch
sending (step 2) packed the fragments into one envelope, but didn't undo the
cutting itself.

A benchmark on real Xweather text (`bench2/`, German and French) showed the gap:

| Method | German |
|---|---|
| by nodes | `Kaufen [Wetter-API] Zugriff heute und erhalten Sie…` |
| markers | `Kaufen Sie noch heute [Weather API]-Zugang und erhalten Sie…` |

Solution: serialise a block's content into a single string with numbered markers
(`Buy <1>Weather API</1> access today`), translate the whole string, and parse
the response back into nodes, pulling formatting from a table built during
serialisation. A marker is allowed to move to a different spot in the sentence —
that's the whole point.

## Codebase map

| File | What happens to it |
|---|---|
| `storyblok-ai-sdk/.../localizeStory/index.ts:101-117` | `transformValue`: the nested traversal by `key === "text"` gets replaced with block serialisation |
| `storyblok-ai-sdk/.../localizeStory/index.ts:330-334` | `FieldForTranslationData` — the **second copy** of the type, must change in sync |
| `storyblok-ai-sdk/.../applyTranslations.ts:12-20` | `CollectedField` — the real source of the type |
| `storyblok-ai-sdk/.../applyTranslations.ts:99-105` | the pinpoint write into a node gets replaced with string parsing and replacing the block's content |
| `storyblok-ai-sdk/.../collectPairs.ts:13-21` | survives almost untouched if the new shape stays an array of pairs; the JSDoc about "text nodes" goes stale |
| new serialisation/parsing module | ~40 lines; draft verified in `bench2/lib.mjs` |

**Untouched:** `getTranslatableFields` (component-schema traversal, `:297-328`),
the outer `traverseObject` (story traversal, `:71-118`, `:247-278`), `batching.ts`,
`translateInBatches.ts`, `fragmentKey.ts`, `translateJSON.ts`, the app layer
(`Localization/index.tsx` only reads `original`/`translated`/`untranslated`).

**Data shape.** `ISbRichtext` (`storyblok-js-client/dist/types/interfaces.d.ts:236`)
only requires `type: string`; `content`, `marks`, `attrs`, `text` are all
optional, and `marks` is itself an array of `ISbRichtext[]`. Formatting tags
never nest: several formats sit as an array on one node, so nested markers
can't occur.

**Prior attempts:** there's no history of serialising markup into a string. But
the "marker in a string" trick already exists in the repo — `{{N}}` placeholders
for non-translatable words (`translateJSON.ts:16-36`), along with a collision
already solved there: content can itself contain `{{0}}`. The same trap awaits
markup markers.

## Defects found (not created by this task)

1. **Code blocks get translated.** Verified: `npm install @storyblok/js` inside
   a `code_block` ends up in translation, because the traversal collects any
   `key === "text"`.
2. **The content of nested components (`blok`) doesn't get translated at all** —
   they have component fields, not `text` nodes. The opposite bug, a separate
   size of its own.
3. **The type is defined twice** — `FieldForTranslationData` and
   `CollectedField` — they'll drift apart the first time one gets edited
   without the other.

## Scope

### In scope
1. Serialising a block into a string with markers, and parsing it back.
2. Changing the unit of translation in `transformValue`, `collectPairs`,
   `applyTranslations`.
3. Instructing the model about markers (via `promptModifier`, next to the one
   about paraphrasing).
4. A fallback for a bad response: the translation gets written as a single
   node with no formatting, and the field goes into the untranslated list.
5. Protection against markers colliding with content.

### Out of scope
- Translating the content of nested components (defect 2).
- Merging the two type definitions into one (defect 3) — unless the task turns
  out to require it.
- Changing the model, brand voice.

### Non-functional scan
- **Performance**: fewer texts (a block instead of nodes) — shorter requests.
- **Security**: not applicable.
- **Accessibility**: not applicable.
- **Localization**: the whole point of the task.
- **Observability**: fallback triggers must be visible, otherwise lost
  formatting goes unnoticed.

## Acceptance criteria (draft)

1. A paragraph with a highlight inside a sentence goes to the model as one
   string with markers. Check: a serialisation test.
2. The response is parsed back into nodes; formatting is pulled from the table
   by marker number, not by position. Check: a test where the marker sits in a
   different spot in the response.
3. The number of nodes after parsing can differ from the original, and that's
   not a bug. Check: a test on a response where two markers merge into one
   phrase.
4. A paragraph with no formatting produces one pair and comes back with no
   structural changes. Check: a test.
5. Textless nodes inside a paragraph (`hard_break`, an image) survive
   translation. Check: a test.
6. **Negative path:** a dropped marker → the block keeps its original text
   with its formatting, goes into the untranslated list, the tree isn't
   damaged. Check: a test.
7. **Negative path:** a duplicated marker → the same fallback. Check: a test.
8. **Negative path:** a stray marker that wasn't in the source → the same
   fallback. Check: a test.
9. **Negative path:** content that itself contains `<1>` isn't mistaken for a
   marker. Check: a test.
10. An empty paragraph and a field that isn't a tree don't crash the
    translation. Check: a test.
11. A run on the real model in German: the highlight lands on the word that
    moved, the prefix stays in place. Check: a manual run on the test rig.

## Open questions

1. **Marker collision** *[non-blocking]* — apply the trick from `{{N}}`: pick a
   format or numbering that isn't present in the content.
2. **Marker collision** *[non-blocking]* — apply the trick from `{{N}}`: pick a
   format or numbering that isn't present in the content.
2. **Nested components** *[non-blocking]* — confirm we're leaving this as is.
3. **Two type definitions** *[non-blocking]* — merge now or separately.
4. **Length threshold** *[non-blocking]* — a very long paragraph becomes one
   pair; batching survives this fine (the pair travels in its own batch), test
   at the limit.

## Risks

- String parsing is the one place with real risk: the model's response is
  unpredictable, and what can get broken is the content tree.
- The tests `collectPairs.test.ts` (3 checks) and `applyTranslations.test.ts`
  (2 checks) describe the old unit and will be rewritten — that's expected, but
  needs care: rewrite for the new shape, don't just fit them to the
  implementation.
- The code-block defect might turn out to be someone's feature; ask.

## Readiness

- Unresolved blocking questions: **0**
- Scope items without an acceptance criterion: **0**

Next step: `/sp-red-test` on the serialisation/parsing module, then `/sp-task`.

## Clarifications (September 10, 2026)

| Question | Decision |
|---|---|
| Serialisation unit | **any block containing text nodes** — a paragraph, a heading, a quote, a list item. Headings and list items are sentences too, and they have the same problem |
| Code blocks | **exclude from translation**. Right now `npm install @storyblok/js` goes to the model; this changes behavior, but for the better, and Xweather has a developer section where this case isn't hypothetical |

Both decisions expand the scope:

- the scope gains a definition of "a block containing text" and how it's
  separated from blocks whose content shouldn't be translated;
- an acceptance criterion is added: the content of `code_block` doesn't get
  translated and comes back unchanged (check: a test on a tree with a code
  block).

## Review findings (September 11, 2026)

Three reviews from three angles — correctness, regressions, contracts and test
strength. Seven findings; six confirmed by follow-through and fixed, one
deferred by decision.

| Finding | How it showed up | Outcome |
|---|---|---|
| Collision at a node boundary | text `"Price is <"` + `"1>"` forms `<1>` only once joined; the number got assigned to a marker, and the block broke **on its own output**, with no translation involved | number availability is checked against the joined text; verified with a round-trip test |
| An empty response wiped the block | `parseInline("")` returned `[]`, and the paragraph's content got wiped | an empty response to a non-empty block is now a refusal; the contract was fixed — it had promised the opposite and wasn't covered by anything |
| An empty translation wiped the field | `??` lets an empty string through, and the field got zeroed out; the old code never did that | an empty translation no longer wipes a non-empty source |
| Markers leaking into the editor warning | the string `Buy <1>Weather API</1> access today.` was going into `untranslated` | marker stripping was added; the format stays internal to the module |
| Weak numbering check | the check "number 1 wasn't assigned" also passed on an empty table | two checks on exact numbers were added |
| Criteria 6-8 drifted from the decision | the document described the fallback "translation as a single node with no formatting," which had been cancelled in step 3 | the criteria were brought in line with the decision that was actually made |
| Nested components (`blok`) | the old traversal collected a field named `text` inside `attrs.body`, the new one doesn't | **deferred**, see below |

### Deferred finding

The traversal no longer goes inside nested components. Before, only fields
literally named `text` ended up there — a narrow, accidental slice: a `label`
or `title` field on the same component was never translated anyway. So what's
lost isn't a capability, but a fragment of one.

Full translation of nested components was carved out of this task's scope
during research (defect 2) and stays carved out. Worth filing separately.
