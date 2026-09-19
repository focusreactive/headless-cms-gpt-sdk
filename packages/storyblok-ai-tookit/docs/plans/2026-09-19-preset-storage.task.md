# The real store behind the presets

## Requirements / Task restatement

Replace the fake repository with one that talks to the space-settings route, so that
presets survive closing the plugin. Finish everything that can be finished here, leaving
only the one thing that cannot: watching it write to a real Firestore.

## What cannot be done here, and why it is not a criterion

`.env.local` on this machine carries no Firebase project — `PROJECT_ID` is empty — and
`DEV_SKIP_FIREBASE=true` is set for that reason. The route answers from a stand-in and
never reaches Firestore. So nothing here can witness a write landing in the real store;
every criterion below is met by a test or by reading the code, and the last mile is a live
check against a real space, recorded as owed rather than claimed.

**Before this can ship**, `@focus-reactive/sb-plugins-storage-sdk` has to be published.
Locally it is a symlink to the package source, so the change below is already in force;
production installs 0.0.15 from npm and would drop the new field on the floor.

## Decisions

| Decision | Chosen | Rejected, and why |
|---|---|---|
| How `saveSpaceSettings` takes its settings | `{ pluginId, spaceId, ...settings }`, naming none of them | naming `stylePresets` beside `notTranslatableWords`: every future setting would then mean editing a separately published package and releasing it, which is exactly the cost the research note asked to remove |
| How the route takes them | the same, passed straight through | naming them there too, for the same reason and with the same cost |
| How the route reads a body | whichever way Next handed it — a string it parses, an object it takes as it is | parsing always, which is what it did: Next parses the body itself when the request says it is JSON, so the route answered 500 to every caller that set the header. The repository happens not to set it, which made the route's only working caller the one that knew not to |
| What a write carries | the style-presets field and nothing else | sending the whole settings document: `updateDoc` merges at the top level, so sending only what changed cannot disturb the words a translation must not touch — and two settings never have to be saved together |
| Where the raw-to-settings conversion lives | still `overStorage`, which this is built through | doing it in the repository: that is the trap the earlier audit closed, and a second implementation forgetting it is precisely what the wrapper exists to prevent |
| What runs with no Firebase | the route's stand-in **remembers what it was told**, for the life of the process | the plugin choosing the fake repository when a flag is set: that would make development exercise a path production never runs, and would need the flag on the client. This way there is one implementation above the route |
| The 500 body | the error's message | `res.status(500).json({ error })`, which serialises an `Error` to `{}` — recorded as a defect two steps ago and fixed while in the file |

**Written contract? Yes** — `CreateHttpRepository` in `presetStore.types.ts`, which owes callers
what each failure means and what a write may carry. That puts Phase 3 on the
`/sp-red-test` path.

## Acceptance Criteria

| # | Criterion | How it is checked | Pre-flight |
|---|---|---|---|
| 1 | `load` answers the style-presets field, and empty settings for a space that has none | named test | unit absent — the red run against the stub is its pre-flight |
| 2 | `save` sends that field and no other setting | named test asserting on the request body | as above |
| 3 | A request that never produced a response fails as `network` | named test | as above |
| 4 | A refusing status fails as `http`, carrying the status | named test | as above |
| 5 | A body that cannot be read fails as `malformed` | named test | as above |
| 6 | `saveSpaceSettings` writes a field it does not name | read the diff; it has no test suite of its own | **fails now — it names one field** |
| 7 | With no Firebase, a saved preset is there on the next read within the session | named test over the route's stand-in, or read the route | as above |
| 11 | An empty answer to a read is a space nobody configured, not a malformed one | named test | clause added after the blind author reported the silence; the mutation run showed it unguarded |
| 8 | The 549 committed checks stay green | `yarn test` | **549 passing now, must stay** |
| 9 | No new type errors | `npx tsc --noEmit` | **exit 0 now, must stay** |
| 10 | It writes to a real Firestore | **a live check against a real space** | **not verifiable here** — no project in the environment. Owed, not claimed |

## Risk notes

- Criterion 10 is the one that matters most to a user and the one this machine cannot
  answer. Nothing below it should be read as evidence for it.
- The stand-in is per process and not per space. Two spaces in one dev session would share
  settings. Acceptable for a stand-in, and stated in the code.
- `getSpaceSettings` invents a default document when a space has none. A space with no
  `stylePresets` therefore reads as empty settings, which is the working state §3b names,
  not a failure.

## Result — 19 September 2026

| # | Outcome | Evidence |
|---|---|---|
| 1 | met | `httpRepository.test.ts` — six checks over a configured space, an unconfigured one, and a document carrying a list outside the field |
| 2 | met | three checks over the request body; one of them loads first and shows the write still carries no `notTranslatableWords` |
| 3 | met | four checks, load and save, over a request that never answers |
| 4 | met | seven checks, including one that a refusal whose body cannot be read is still `http` |
| 5 | met | two checks over a success carrying a body nothing can read |
| 6 | met | the diff of `saveSpaceSettings`: it destructures `...settings` and names no field |
| 7 | **met, and seen** | the running route, `DEV_SKIP_FIREBASE=true`: a POST carrying `stylePresets` came back on the next GET, with `notTranslatableWords` untouched |
| 8 | met | `yarn test` — 583 of 583, the 549 committed ones among them |
| 9 | met | `npx tsc --noEmit` — exit 0 |
| 10 | **not verified — owed** | no Firebase project in this environment. Nothing above is evidence for it |
| 11 | met | `httpRepository.guards.test.ts`; breaking the clause reddens those two checks and nothing else |

### The run

- Contract written first, stub second. **Red run: 32 of 32 failed, 0 passed**, every failure
  the stub's own `not implemented — red run` — no missing module, no `TypeError`, no
  assertion mismatch. Kept at `httpRepository.red.txt` in the job's scratch directory.
- The author was blind by request, not by a worktree: the file it was told not to read was
  a five-line stub, so there was nothing in it to leak.
- **Green run: 32 of 32 on the first attempt.** Nothing was edited to make a check pass.
- **Thirteen mutations, twelve reddened their own checks.** The one that reddened nothing —
  treating an empty body as malformed — is criterion 11 above: a silence the author
  reported rather than guessed at. Closed with a guard file, and the guard was then proven
  by re-running that same mutation.

### Owed, and not claimed

- **Criterion 10.** A live check against a real space with Firebase credentials and
  `DEV_SKIP_FIREBASE=false`.
- **Publishing `@focus-reactive/sb-plugins-storage-sdk`.** Production installs 0.0.15 from
  npm, which names `notTranslatableWords` and would drop `stylePresets` on the floor.

## Human choices

- **19 September 2026** — finish everything that can be finished, leaving only the live
  Firebase check.

## Review log

- (empty)
