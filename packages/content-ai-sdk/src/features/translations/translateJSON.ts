import { flatten, unflatten } from "flat";

import { getOpenAiClient } from "../../config/openAi";

interface ApiCalloptions {
  targetLanguage: string;
  currentLanguage?: string;
  promptModifier?: string;
  valuesToTranslate: unknown;
  notTranslatableWords: string[];
}

const apiCall = async ({
  currentLanguage,
  targetLanguage,
  valuesToTranslate,
  promptModifier = "",
  notTranslatableWords,
}: ApiCalloptions) => {
  const openAiClient = getOpenAiClient();

  if (!openAiClient) {
    throw new Error("OpenAI client is not configurated");
  }

  let updatedContent = JSON.stringify(valuesToTranslate);

  for (const word of notTranslatableWords) {
    updatedContent = updatedContent.replaceAll(word, `{{${word}}}`);
  }

  return await openAiClient.chat.completions
    .create({
      messages: [
        {
          role: "system",
          content: `Translate the values from the JSON array that the user will send you ${
            currentLanguage ? " from " + currentLanguage : ""
          } into ${targetLanguage}. Return a new array containing only the translations, with their order remaining unchanged. Result should follow this structure: {translations: [string, string, string]}.`,
        },
        {
          role: "system",
          content:
            "Words or phrases inside double curly braces (e.g., {{example}}) should remain untranslated.",
        },
        { role: "system", content: promptModifier },
        { role: "user", content: updatedContent },
      ],
      model: "gpt-4o",
      temperature: 0,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: { type: "json_object" },
    })
    .then((res) => {
      const restoredContent = JSON.parse(
        res.choices[0].message.content as string
      ).translations as string[];

      const translations = [];

      for (let translation of restoredContent) {
        for (const word of notTranslatableWords) {
          translation = translation.replaceAll(`{{${word}}}`, word);
        }

        translations.push(translation);
      }

      // Fix spaces and untranslated words
      const beforeTranslationContent = JSON.parse(updatedContent);

      for (let i = 0; i < translations.length; i++) {
        if (beforeTranslationContent[i].startsWith(" ")) {
          translations[i] = " " + translations[i];
        }

        if (beforeTranslationContent[i].endsWith(" ")) {
          translations[i] += " ";
        }

        // TODO: Fix untranslatable words for deeply nested cases

        // We assume that the words order is the same. (This is not the case)
        if (
          beforeTranslationContent[i].includes("{{") &&
          beforeTranslationContent[i].includes("}}")
        ) {
          // const re = /{{\w+}}/;
          const wordsBefore = beforeTranslationContent[i].split(/\s/);
          const wordsAfter: string[] = translations[i].split(/\s/);

          if (Array.isArray(wordsAfter) && Array.isArray(wordsBefore)) {
            for (let j = 0; j < wordsAfter.length; j++) {
              if (/{{\w+}}/.test(wordsBefore[j])) {
                translations[i] = translations[i].replace(
                  wordsAfter[j],
                  wordsBefore[j].replace("{{", "").replace("}}", "")
                );
              }
            }
          }
        }

        if (translations[i].includes("{{") && translations[i].includes("}}")) {
          translations[i] = translations[i]
            .replaceAll("{{", "")
            .replaceAll("}}", "");
        }
      }

      return translations;
    });
};

interface TranslateOptions {
  targetLanguage: string;
  currentLanguage?: string;
  content: object;
  promptModifier?: string;
  isFlat?: boolean;
  notTranslatableWords: string[];
}

export const translateJSON = async ({
  targetLanguage,
  currentLanguage,
  content,
  isFlat = false,
  promptModifier = "",
  notTranslatableWords,
}: TranslateOptions) => {
  let formattedContent;
  if (typeof content === "object" && !isFlat) {
    formattedContent = flatten(content);
  }

  if (!formattedContent && !isFlat) {
    throw new Error("The provided data is not a valid");
  }

  if (isFlat) {
    formattedContent = content;
  }

  const valuesToTranslate = Object.values(formattedContent as object);
  const keys = Object.keys(formattedContent as object);

  try {
    // !TODO work on symbols limitations
    const chatCompletion = await apiCall({
      currentLanguage,
      targetLanguage,
      valuesToTranslate,
      promptModifier,
      notTranslatableWords,
    });

    const translatedObject = keys.reduce((result, key, index) => {
      return {
        ...result,
        [key]: chatCompletion[index],
      };
    }, {});

    if (isFlat) {
      return JSON.stringify(translatedObject);
    } else {
      return JSON.stringify(unflatten(translatedObject));
    }
  } catch {
    throw new Error("Failed to translate JSON");
  }
};
