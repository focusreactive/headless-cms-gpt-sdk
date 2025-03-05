import { flatten, unflatten } from "flat";

import { getOpenAiClient } from "../../config/openAi";

interface ApiCalloptions {
  targetLanguage: string;
  currentLanguage?: string;
  promptModifier?: string;
  valuesToTranslate: unknown;
  notTranslatableWords?: string[];
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

  let valueToTranslate = (valuesToTranslate as string[])[0];

  if (notTranslatableWords) {
    notTranslatableWords.sort((a, b) => {
      if (a.length > b.length) {
        return -1;
      }

      return 1;
    });

    for (let i = 0; i < notTranslatableWords.length; i++) {
      valueToTranslate = valueToTranslate.replaceAll(
        notTranslatableWords[i],
        `{{${i}}}`,
      );
    }
  }

  return await openAiClient.chat.completions
    .create({
      messages: [
        {
          role: "system",
          content: `You're content translator. Translate text ${
            currentLanguage ? " from " + currentLanguage : ""
          } into ${targetLanguage} and response with translated version, don't add any additional information. Use informal tone for translations.`,
        },
        ...(promptModifier
          ? [{ role: "system" as const, content: promptModifier }]
          : []),
        { role: "user", content: valueToTranslate },
      ],
      model: "gpt-4o",
      temperature: 0,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: { type: "text" },
    })
    .then((res) => {
      let translatedValue = res.choices[0].message.content as string;

      if (notTranslatableWords) {
        for (let i = 0; i < notTranslatableWords.length; i++) {
          translatedValue = translatedValue.replaceAll(
            `{{${i}}}`,
            notTranslatableWords[i],
          );
        }
      }

      const translatableValues: string[] = [valueToTranslate];
      const translatedValues = [translatedValue];

      if (translatableValues.length !== translatedValues.length) {
        captureError?.({
          targetLanguage,
          beforeTranslationContent: translatableValues,
          translationsFixed: translatedValues,
        });
      }

      try {
        for (let i = 0; i < translatedValues.length; i++) {
          const [start, end] = translatableValues[i].split(
            translatableValues[i].trim(),
          );

          if (
            start &&
            translatedValues[i].length ===
              translatedValues[i].trimStart().length
          ) {
            translatedValues[i] = start + translatedValues[i];
          }

          if (
            end &&
            translatedValues[i].length === translatedValues[i].trimEnd().length
          ) {
            translatedValues[i] += end;
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

      return translatedValues;
    });
};

interface TranslateOptions {
  targetLanguage: string;
  currentLanguage?: string;
  content: object;
  promptModifier?: string;
  isFlat?: boolean;
  notTranslatableWords?: string[];
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
  } catch (error) {
    console.log(error);
    throw error;
  }
};
