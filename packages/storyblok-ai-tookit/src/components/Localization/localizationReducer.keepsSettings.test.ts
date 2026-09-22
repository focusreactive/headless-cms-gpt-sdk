/**
 * What a finished translation leaves behind: `endedSuccessfully` changes only what
 * finishing means and keeps everything else, so a field added to the state later survives
 * without this branch being edited.
 *
 * A check here failing after a new field is added to the panel means the branch has gone
 * back to naming what survives rather than spreading.
 */

import { describe, expect, it } from "vitest";

import { INITIAL_STATE, mainReducer, type LocalizationState } from "./index";

const LANGUAGES = [
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
];

const finish = (state: LocalizationState): LocalizationState =>
  mainReducer(state, { type: "endedSuccessfully", payload: "Done" });

const afterPickingFrench = (): LocalizationState =>
  mainReducer(INITIAL_STATE, {
    type: "setTargetLanguage",
    payload: { language: "fr", languages: LANGUAGES },
  });

describe("what a successful translation keeps", () => {
  describe("the target language, which is held in three places at once", () => {
    it("keeps the code", () => {
      expect(finish(afterPickingFrench()).targetLanguageCode).toBe("fr");
    });

    it("keeps the name", () => {
      expect(finish(afterPickingFrench()).targetLanguageName).toBe("French");
    });

    it("keeps the copy the API is called with", () => {
      expect(finish(afterPickingFrench()).fieldLevelTranslation.targetLanguage).toBe("fr");
    });
  });

  describe("the style preset, the setting this defect was found through", () => {
    it("keeps a preset the editor picked", () => {
      const picked = mainReducer(afterPickingFrench(), {
        type: "setStylePreset",
        payload: { said: true, preset: "brand" },
      });

      expect(finish(picked).stylePreset).toEqual({ said: true, preset: "brand" });
    });

    it("keeps the editor having picked no preset, which is not the same as saying nothing", () => {
      const picked = mainReducer(afterPickingFrench(), {
        type: "setStylePreset",
        payload: { said: true, preset: null },
      });

      expect(finish(picked).stylePreset).toEqual({ said: true, preset: null });
    });
  });

  describe("the folder settings, which are a different screen's and were wiped with the rest", () => {
    const atFolderLevel = (): LocalizationState => {
      const level = mainReducer(INITIAL_STATE, {
        type: "setTranslationLevel",
        payload: "folder",
      });
      const folder = mainReducer(level, { type: "setTargetFolderId", payload: 12345 });

      return mainReducer(folder, { type: "setUserTypedLanguage", payload: "French" });
    };

    it("keeps the translation level", () => {
      expect(finish(atFolderLevel()).translationLevel).toBe("folder");
    });

    it("keeps the target folder", () => {
      expect(finish(atFolderLevel()).folderLevelTranslation.targetFolderId).toBe(12345);
    });

    it("keeps the typed language", () => {
      expect(finish(atFolderLevel()).folderLevelTranslation.userTypedLanguage).toBe("French");
    });
  });

  describe("the words that must be left alone, which survived even before", () => {
    it("keeps them", () => {
      const typing = mainReducer(afterPickingFrench(), {
        type: "setNewNotTranslatableWord",
        payload: "Checkout",
      });
      const added = mainReducer(typing, { type: "addNotTranslatableWord" });

      expect(Array.from(finish(added).notTranslatableWords.set)).toEqual(["Checkout"]);
    });
  });

  describe("what finishing does change", () => {
    it("carries the message", () => {
      expect(finish(afterPickingFrench()).successMessage).toBe("Done");
    });

    it("stops loading", () => {
      const running = mainReducer(afterPickingFrench(), { type: "loadingStarted" });

      expect(running.isLoading).toBe(true);
      expect(finish(running).isLoading).toBe(false);
    });

    it("clears a message left by an earlier failure", () => {
      const failed = mainReducer(afterPickingFrench(), {
        type: "endedWithError",
        payload: "Nope",
      });

      expect(finish(failed).errorMessage).toBe("");
    });

    it("leaves the button ready, the language still being set", () => {
      expect(finish(afterPickingFrench()).isReadyToPerformLocalization).toBe(true);
    });
  });
});
