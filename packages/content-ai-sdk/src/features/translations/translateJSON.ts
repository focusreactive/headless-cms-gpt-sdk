import { flatten, unflatten } from "flat";

import { getOpenAiClient } from "../../config/openAi";

interface ApiCalloptions {
  targetLanguage: string;
  currentLanguage?: string;
  promptModifier?: string;
  valuesToTranslate: unknown;
  notTranslatableWords: string[];
  captureError?: (context: Record<string, unknown>) => void;
}

const apiCall = async ({
  currentLanguage,
  targetLanguage,
  valuesToTranslate,
  promptModifier = "",
  notTranslatableWords,
  captureError,
}: ApiCalloptions) => {
  const openAiClient = getOpenAiClient();

  if (!openAiClient) {
    throw new Error("OpenAI client is not configurated");
  }

  let updatedContent = JSON.stringify(valuesToTranslate);

  notTranslatableWords.sort((a, b) => {
    if (a.length > b.length) {
      return -1;
    }

    return 1;
  });

  for (let i = 0; i < notTranslatableWords.length; i++) {
    updatedContent = updatedContent.replaceAll(
      notTranslatableWords[i],
      `{{${i}}}`,
    );
  }

  return await openAiClient.chat.completions
    .create({
      messages: [
        {
          role: "system",
          content: `Translate the values from the JSON array that the user will send you ${
            currentLanguage ? " from " + currentLanguage : ""
          } into ${targetLanguage}. Return a new array containing only the translations, with their order remaining unchanged. Result should follow this structure: {translations: string[]}. Don't split the translations.`,
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
        res.choices[0].message.content as string,
      ).translations as string[];

      const translations: string[] = [];

      for (let translation of restoredContent) {
        for (let i = 0; i < notTranslatableWords.length; i++) {
          translation = translation.replaceAll(
            `{{${i}}}`,
            notTranslatableWords[i],
          );
        }

        translations.push(translation);
      }

      // Fix spaces
      const beforeTranslationContent: string[] = JSON.parse(updatedContent);

      // TODO: fix an issue where beforeTranslationContent.length and translations.length are not equal
      if (beforeTranslationContent.length !== translations.length) {
        captureError?.({
          targetLanguage,
          beforeTranslationContent,
          translations,
        });
      }
      // hotfix
      const translationsFixed = [translations.join(" ")];

      try {
        for (let i = 0; i < translationsFixed.length; i++) {
          const [start, end] = beforeTranslationContent[i].split(
            beforeTranslationContent[i].trim(),
          );

          if (
            start &&
            translationsFixed[i].length ===
              translationsFixed[i].trimStart().length
          ) {
            translationsFixed[i] = start + translationsFixed[i];
          }

          if (
            end &&
            translationsFixed[i].length ===
              translationsFixed[i].trimEnd().length
          ) {
            translationsFixed[i] += end;
          }
        }
      } catch (error) {
        console.log(error);
      }

      // TODO: delete after debug
      // try {
      //   fetch("/api/slack-channel", {
      //     method: "POST",
      //     body: JSON.stringify({
      //       message: {
      //         blocks: [
      //           {
      //             type: "header",
      //             text: {
      //               type: "plain_text",
      //               text: `SB AI Tool Usage`,
      //             },
      //           },
      //           {
      //             type: "section",
      //             text: {
      //               type: "mrkdwn",
      //               text:
      //                 "```" +
      //                 `**BeforeTranslationContent**: ${JSON.stringify(
      //                   beforeTranslationContent,
      //                   null,
      //                   "\t",
      //                 )}
      //         \n**translations**: ${JSON.stringify(translations, null, "\t")}
      //         \n**translationsFixed**: ${JSON.stringify(
      //           translationsFixed,
      //           null,
      //           "\t",
      //         )}
      //         \n**Time**: ${new Date(Date.now()).toISOString()} ` +
      //                 "```",
      //             },
      //           },
      //         ],
      //       },
      //     }),
      //   }).catch((error) => {
      //     console.log("Error during slack submit: ", error);
      //   });
      // } catch (error) {
      //   console.log("Error during slack submit: ", error);
      // }
      //
      // for (let k = 0; k < beforeTranslationContent.length; k++) {
      //   if (
      //     notTranslatableWords.some(
      //       (notTranslatableWord) =>
      //         beforeTranslationContent[k]?.includes(notTranslatableWord),
      //     ) &&
      //     !notTranslatableWords.some(
      //       (notTranslatableWord) =>
      //         translationsFixed[k]?.includes(notTranslatableWord),
      //     )
      //   ) {
      //     try {
      //       fetch("/api/slack-channel", {
      //         method: "POST",
      //         body: JSON.stringify({
      //           message: {
      //             blocks: [
      //               {
      //                 type: "header",
      //                 text: {
      //                   type: "plain_text",
      //                   text: `SB AI Tool Ignore words error`,
      //                 },
      //               },
      //               {
      //                 type: "section",
      //                 text: {
      //                   type: "mrkdwn",
      //                   text:
      //                     "```" +
      //                     `**BeforeTranslationContent**: ${JSON.stringify(
      //                       beforeTranslationContent,
      //                       null,
      //                       "\t",
      //                     )}
      //           \n**translations**: ${JSON.stringify(
      //             translations,
      //             null,
      //             "\t",
      //           )}              \n**translationsFixed**: ${JSON.stringify(
      //             translationsFixed,
      //             null,
      //             "\t",
      //           )}
      //           \n**Time**: ${new Date(Date.now()).toISOString()}` +
      //                     "```",
      //                 },
      //               },
      //             ],
      //           },
      //         }),
      //       }).catch((error) => {
      //         console.log("Error during slack submit: ", error);
      //       });
      //     } catch (error) {
      //       console.log("Error during slack submit: ", error);
      //     }
      //   }
      // }

      return translationsFixed;
    });
};

interface TranslateOptions {
  targetLanguage: string;
  currentLanguage?: string;
  content: object;
  promptModifier?: string;
  isFlat?: boolean;
  notTranslatableWords: string[];
  captureError?: (context: Record<string, unknown>) => void;
}

export const translateJSON = async ({
  targetLanguage,
  currentLanguage,
  content,
  isFlat = false,
  promptModifier = "",
  notTranslatableWords,
  captureError,
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
      captureError,
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
