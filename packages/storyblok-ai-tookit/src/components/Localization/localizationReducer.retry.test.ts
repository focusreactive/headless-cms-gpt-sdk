import { describe, expect, it } from "vitest";

import { INITIAL_STATE, mainReducer, type LocalizationState } from "./index";

/**
 * Whether the Localize button comes back after a failure — and it depends on the level,
 * because the two levels fail differently.
 *
 * **Field level** writes once, at the very end, into the story's own `__i18n__` fields.
 * A failed run leaves nothing behind, so pressing Localize again just tries again.
 *
 * **Folder level** duplicates the story into the target folder as its *first* action,
 * before a word is translated. A failure anywhere after that leaves the duplicate behind,
 * untranslated, and nothing removes it. Pressing Localize again duplicates it a second
 * time. Until the ordering in `localizeStory` is changed, the button has to stay disabled
 * there, and reopening the plugin is the way out — which is how it behaved before the
 * button-hang fix.
 */

const LANGUAGES = [{ code: "fr", name: "French" }];

const fieldLevelReady = (): LocalizationState =>
  mainReducer(INITIAL_STATE, {
    type: "setTargetLanguage",
    payload: { language: "fr", languages: LANGUAGES },
  });

const folderLevelReady = (): LocalizationState => {
  const atFolderLevel = mainReducer(INITIAL_STATE, {
    type: "setTranslationLevel",
    payload: "folder",
  });

  const withFolder = mainReducer(atFolderLevel, {
    type: "setTargetFolderId",
    payload: 12345,
  });

  return mainReducer(withFolder, {
    type: "setUserTypedLanguage",
    payload: "French",
  });
};

const failed = (state: LocalizationState): LocalizationState =>
  mainReducer(state, { type: "endedWithError", payload: "Nope" });

describe("retrying after a failed translation", () => {
  describe("field level (contract: a failed run leaves nothing behind, so retry is safe)", () => {
    it("is ready again, so the button comes back", () => {
      const state = failed(fieldLevelReady());

      expect(state.isLoading).toBe(false);
      expect(state.isReadyToPerformLocalization).toBe(true);
    });
  });

  describe("folder level (contract: a failed run leaves a duplicate story behind, so retry would make a second one)", () => {
    it("is ready before anything fails", () => {
      expect(folderLevelReady().isReadyToPerformLocalization).toBe(true);
    });

    it("is NOT ready after a failure, so the button cannot duplicate the story again", () => {
      const state = failed(folderLevelReady());

      expect(state.isLoading).toBe(false);
      expect(state.errorMessage).toBe("Nope");
      expect(state.isReadyToPerformLocalization).toBe(false);
    });
  });
});
