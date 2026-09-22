# Form state — a cut-down, API-compatible react-hook-form

## Scope

`useForm` and `useController` in `src/shared/`, shaped so that swapping in the real
react-hook-form is an install plus an import change. Nothing entity-specific:
`validatePreset` and the Voice rules belong to the data-layer task and are not here. The
resolver used in the tests is a toy one, which is also the proof that the machinery knows
nothing about presets.

**Compatibility runs one way only.** Our call sites must compile and behave identically
against the real RHF; the reverse is not required. So our surface is smaller and our
types stricter. Everything supported behaves the same; everything else is simply never
called.

## Decisions

| Decision | Chosen | Rejected, and why |
|---|---|---|
| Where the rules live | A **pure core** — a reducer plus pure decision helpers — with `useForm` as `useReducer` over it and `useController` as a slice reader that dispatches | The rules inside the hooks over `useState`: the blind author of `/sp-red-test` cannot write checks against something that only exists inside a React render, and the same pure-core split was already approved for the data layer |
| Which of RHF's surface | `useForm` → `control`, `handleSubmit`, `reset`, `watch`, `getValues`, `formState`; `useController` → `field`, `fieldState`. `formState` carries six of RHF's fifteen fields | The whole surface: `register` and uncontrolled fields are most of RHF's bulk and all five of our fields are controlled MUI components, so none of it would ever run |
| `mode` | Typed `mode?: 'onTouched'` — narrower than RHF's union | RHF's full union: we implement one mode, and a value we silently ignore is worse than one the compiler refuses. Narrowing is safe in the direction that matters — our code still compiles against real RHF |
| Who owns "saving" | `formState.isSubmitting`, from the promise `handleSubmit` already holds. The data layer's mutation hook will not expose a competing flag until something else needs one | A flag in the mutation hook read by this screen: two owners of one piece of state |
| Comparing for `isDirty` | A small pure equality limited to what a form value can be — primitives and arrays of primitives | `JSON.stringify` on both sides (key order, `undefined`, `NaN` all lie) and a lodash dependency for one comparison |
| Re-render granularity | Whole-form re-render. **This is a deliberate divergence from RHF**, which subscribes per field; the semantics are identical and only the performance differs. Five fields in a 300px panel | RHF's subscription store: it is a large share of what makes RHF big, and it buys nothing at this size |

**New surface:** `useForm`, `useController`, and the pure core beneath them. One caller
today — the preset form. The usual "no abstraction without two callers" brake is noted and
deliberately not applied: this is not invented structure, it is the state of the one form,
and its shape is copied from a library rather than designed.

**Written contract: yes** — which is what puts this task on the `/sp-red-test` path.
Five things the signatures cannot state:

1. An error exists as soon as the value is invalid, but is **shown** only once the field
   is touched. `formState.errors` carries it either way; `fieldState.error` is what
   respects touched.
2. `isValid` does not depend on touched at all.
3. `isDirty` compares against `defaultValues` by value, not by reference.
4. `handleSubmit` on invalid values marks **every** field touched and does not call
   `onValid`.
5. `field.onChange` accepts either a raw value or an event, as RHF's variadic signature
   promises.

**Escalate to `/sp-architect`?** No. One package, one module, and `src/shared/` already
holds a hook of this kind. The new dev dependencies are a gate question, not an
architectural one.

## Acceptance criteria

| # | Criterion | How it is checked | Pre-flight |
|---|---|---|---|
| 1 | The suite runs and is green | `yarn test` in the package | no `test` script — fails now |
| 2 | An invalid untouched field has an entry in `formState.errors` and none in its `fieldState.error` | a named test | no files — fails now |
| 3 | `isValid` is false for an invalid form no one has touched | a named test | fails now |
| 4 | `isDirty` stays false when a value is replaced by a deep-equal array, and turns true on a real change | a named test | fails now |
| 5 | `handleSubmit` on invalid values does not call `onValid` and leaves every field touched | a named test | fails now |
| 6 | `field.onChange` takes a raw value and an event alike | a named test | fails now |
| 7 | `mode` rejects any value but `'onTouched'` | a throwaway file, then `npx tsc --noEmit` | no files — fails now |
| 8 | No new type errors | `npx tsc --noEmit` | **exit 0 — passes now, must stay** |

## Human choices

- **A DOM test environment, not vitest alone.** Asked at the Phase 2 gate. The siblings
  (`content-ai-sdk`, `sb-plugins-storage-sdk`) run vitest with no config and no DOM, but
  they test pure functions and are published libraries; this package is the Next.js app,
  so its devDependencies reach no npm consumer. The deciding argument was coverage: pure
  tests cannot reach a stale closure or a wrong `useCallback` dependency list, and that is
  precisely the class a reviewer questioned in `useTwoStepConfirm` one batch ago. Rejected:
  vitest alone — one dependency and an exact match to the siblings, but it would have made
  the React wiring the third unverified thing in a row.

## Risks and constraints

- `strict: false` in this package's tsconfig: `error?: FieldError` is not enforced at call
  sites the way it would be under RHF's own strict build. The types are still written as
  RHF writes them — the swap has to stay type-compatible — and no assertion is added to
  paper over it.
- `target: es5` for the app build. The test run goes through vitest's own transform and is
  not bound by it, so a construct that passes the suite can still fail the build; anything
  new here stays inside what es5 can express.
- `package.json` is clean of yalc links right now and matches HEAD, so dependencies can be
  added and committed. That window closes the moment `yarn dev:sb` runs and rewrites the
  deps to `link:.yalc/...` — after that, `package.json` and `yarn.lock` must not be
  committed, per the kit contract.

## Review log

### 2026-09-18 · sp-red-test

Contract written, then a blind author over three rounds. Red run captured before any
implementation existed: **99 of 99 failed**, none passed, no module-resolution error, every
failure the stub's own. Artefact: `red-run-final.txt`.

The author's real value was not the checks. It found a **contradiction in the contract**:
`reset` was said to "clear errors" while `errors` was "every error the resolver currently
reports" and `isValid` was "errors being empty". A form reset to invalid defaults could not
satisfy both. Resolved from the design — artboard 9 shows an untouched empty name with Save
disabled and no error visible — so `reset` recomputes errors and clears only touched and
`isSubmitted`. It also listed 25 silences across two rounds; nine were decided, the rest are
recorded at the foot of the contract as not promised.

### 2026-09-18 · sp-complexity

History mute (0 commits), so assumption mode. Found the resolver stored in reducer state and
captured once — which breaks the "a preset called X already exists" rule, whose sibling list
changes while the form is open. The fix went deeper than proposed: **`errors` stopped being
state at all**, since they are a pure function of values and resolver. Guarded by
`formState.resolverIdentity.test.tsx`.

### 2026-09-18 · sp-abstraction

One finding, failing both Agreement and Honesty on the same field: `TouchedFields` admitted
`false`, which the contract forbids, so `useController` had to defend with `=== true`.
Expressible states 27 against 8 legal. Narrowed to `Partial<Record<keyof T, true>>` — 8
against 8, and the defence became unnecessary.

### 2026-09-18 · sp-review-comments

27 comment blocks judged, 8 survived. The contract file was carrying 9.5 prose lines per
export, about 45 of them restating types or arguing to a reviewer. Two fixes were code, not
prose: `isValidating` became the literal type `false` so no comment is needed, and the pair
`defaultValues`/`initialDefaults` became `baselineValues`/`creationDefaults` because the
comment existed only to say which of the two moves on reset.

### 2026-09-18 · sp-task phase 5 — three reviewers, high risk

| Finding | Verdict |
|---|---|
| `onInvalid` not wrapped, so the promise the contract says never rejects could reject (major) | **accepted** |
| `revealAllErrors` took field names from values only, so an optional key absent from the defaults could hold the only error and never be revealed — a dead end with nothing shown (major) | **accepted** — names now come from the errors too |
| `Object.keys(errors).length` counted keys, not reported errors; under `strict: false` a resolver writing `errors[k] = undefined` made the form permanently invalid with nothing visible (minor) | **accepted** — `hasErrors` counts defined values |
| `handleSubmit` judged values captured at render (needs-verification) | **accepted anyway** — `TagsInput` commits a word on blur and Save is clicked straight after; the loss would be silent, so values are read live |
| `field.value` typed `unknown` would not assign to `Select` or `TagsInput`, forcing casts at the one call site this exists for (major) | **accepted** — `useController` is parameterised by field name, `value: T[N]`. Proved with a throwaway composition of both controls: zero casts, `tsc` 0 |
| `UseForm`/`UseController` aliases enforced nothing and were referenced nowhere (minor) | **accepted** — deleted |
| `Resolver` prose promised coercion everywhere; it holds only on the submit path (minor) | **accepted** — narrowed |
| Five mutations the 102 checks would not have caught (major ×3) | **accepted** — guarded in `formState.guards.test.tsx` and a fourth check in the resolver file |

Suite: 99 blind + 10 written after the fact, labelled as such. **109 of 109.**

## Human choices

- **Two checks are tautological and stay.** `isValidating` is the literal type `false`, so
  no compiling implementation can fail them. Left as documentation, not as a guard — and
  the test file may not be edited, being the blind suite.
- **One comment is duplicated verbatim in the blind suite** (`useForm.test.tsx`, twice) and
  was judged DELETE by the comment audit. Not applied: that file is protected. Debt.
