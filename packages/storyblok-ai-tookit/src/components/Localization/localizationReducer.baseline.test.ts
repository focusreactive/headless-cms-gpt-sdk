import { describe, expect, it } from "vitest";

import { INITIAL_STATE, mainReducer, type LocalizationState } from "./index";

/**
 * A baseline, not a specification. Every value below was **recorded from the reducer as it
 * stood before the style-preset work touched this file** — so a change here that alters
 * the translation flow fails these checks rather than being noticed in production. Where
 * the recorded behaviour is wrong, it is marked; the checks still hold it, because their
 * job is to catch an accidental change, not to assert what the flow ought to do.
 *
 * The reducer is the seam because it is pure. `localize` is not testable at anything like
 * this cost — it calls the SDK and four routes — and it is also the thing this work does
 * not touch.
 */

const LANGUAGES = [
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
];

const withLanguage = (code: string, languages = LANGUAGES): LocalizationState =>
  mainReducer(INITIAL_STATE, {
    type: "setTargetLanguage",
    payload: { language: code, languages },
  });

describe("the translation state as it stood before the preset work", () => {
  describe("readiness, which gates the Localize button", () => {
    it("is not ready before a target language is chosen", () => {
      expect(INITIAL_STATE.isReadyToPerformLocalization).toBe(false);
    });

    it("is ready once a field-level target language is chosen", () => {
      expect(withLanguage("fr").isReadyToPerformLocalization).toBe(true);
    });

    it("is not ready while a translation is running", () => {
      const running: LocalizationState = mainReducer(withLanguage("fr"), {
        type: "loadingStarted",
      });

      expect(running.isLoading).toBe(true);
      expect(running.isReadyToPerformLocalization).toBe(false);
    });

    it("is not ready at folder level until both the folder and the typed language are set", () => {
      const folder: LocalizationState = mainReducer(withLanguage("fr"), {
        type: "setTranslationLevel",
        payload: "folder",
      });

      expect(folder.isReadyToPerformLocalization).toBe(false);
    });
  });

  describe("the target language a translation is sent with", () => {
    it("keeps the code the editor picked and looks its name up", () => {
      const picked: LocalizationState = withLanguage("fr");

      expect(picked.targetLanguageCode).toBe("fr");
      expect(picked.targetLanguageName).toBe("French");
    });

    /**
     * The code that reaches the API has its hyphen replaced, because that form is what
     * builds the `__i18n__<code>` field name. The raw code the editor picked is kept
     * separately. A preset's `byLocale` has to be keyed the same way, which is why the
     * screens normalise a space language before they look one up.
     */
    it("replaces a hyphen in the code and keeps the raw one beside it", () => {
      const picked: LocalizationState = withLanguage("pt-br", [
        { code: "pt-br", name: "Portuguese (Brazil)" },
      ]);

      expect(picked.targetLanguageCode).toBe("pt_br");
      expect(picked.fieldLevelTranslation.targetLanguage).toBe("pt-br");
      expect(picked.targetLanguageName).toBe("Portuguese (Brazil)");
    });
  });

  describe("how a translation ends", () => {
    it("clears the chosen language on success and carries the message", () => {
      const done: LocalizationState = mainReducer(withLanguage("fr"), {
        type: "endedSuccessfully",
        payload: "Done",
      });

      expect(done.successMessage).toBe("Done");
      expect(done.targetLanguageCode).toBe("");
      expect(done.isReadyToPerformLocalization).toBe(false);
    });

    /**
     * **The defect this used to hold, fixed on 2026-09-21 after an editor hit it.**
     * `endedWithError` set `isLoading: true`, so a failed translation left the panel in
     * its loading state and the Localize button never came back — the plugin had to be
     * reopened. The check was pinned here to keep that wrong until somebody fixed it
     * deliberately; somebody has, and it records the working behaviour now.
     */
    it("clears isLoading on failure, so the button comes back ready to retry", () => {
      const failed: LocalizationState = mainReducer(withLanguage("fr"), {
        type: "endedWithError",
        payload: "Nope",
      });

      expect(failed.errorMessage).toBe("Nope");
      expect(failed.isLoading).toBe(false);
      // Derived from isLoading by mainReducer: with the loading state cleared the
      // Localize button is enabled again, which is the point — a failed translation
      // should be retryable without reopening the plugin.
      expect(failed.isReadyToPerformLocalization).toBe(true);
    });
  });

  describe("the words a translation must leave alone", () => {
    it("holds a typed word before it is added", () => {
      const typing: LocalizationState = mainReducer(withLanguage("fr"), {
        type: "setNewNotTranslatableWord",
        payload: "Checkout",
      });

      expect(typing.notTranslatableWords.new).toBe("Checkout");
      expect(Array.from(typing.notTranslatableWords.set)).toEqual([]);
    });

    it("adds the typed word to the set", () => {
      const typing: LocalizationState = mainReducer(withLanguage("fr"), {
        type: "setNewNotTranslatableWord",
        payload: "Checkout",
      });
      const added: LocalizationState = mainReducer(typing, {
        type: "addNotTranslatableWord",
      });

      expect(Array.from(added.notTranslatableWords.set)).toEqual(["Checkout"]);
    });
  });

  describe("the style preset the editor picks, added by the preset work", () => {
    it("starts with nothing said, so the space default applies", () => {
      expect(INITIAL_STATE.stylePreset).toEqual({ said: false });
    });

    it("remembers a preset the editor picked", () => {
      const picked: LocalizationState = mainReducer(withLanguage("fr"), {
        type: "setStylePreset",
        payload: { said: true, preset: "brand" },
      });

      expect(picked.stylePreset).toEqual({ said: true, preset: "brand" });
    });

    it("remembers that the editor picked no preset at all, which is not the same as saying nothing", () => {
      const none: LocalizationState = mainReducer(withLanguage("fr"), {
        type: "setStylePreset",
        payload: { said: true, preset: null },
      });

      expect(none.stylePreset).toEqual({ said: true, preset: null });
    });

    it("does not disturb readiness, which is what the baseline above pins", () => {
      const picked: LocalizationState = mainReducer(withLanguage("fr"), {
        type: "setStylePreset",
        payload: { said: true, preset: "brand" },
      });

      expect(picked.isReadyToPerformLocalization).toBe(true);
      expect(picked.targetLanguageCode).toBe("fr");
    });
  });
});
