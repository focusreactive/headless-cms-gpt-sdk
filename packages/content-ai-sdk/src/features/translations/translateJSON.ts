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

  for (let i = 0; i < notTranslatableWords.length; i++) {
    updatedContent = updatedContent.replaceAll(
      notTranslatableWords[i],
      `{{${i}}}`
    );
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

      const translations: string[] = [];

      for (let translation of restoredContent) {
        for (let i = 0; i < notTranslatableWords.length; i++) {
          translation = translation.replaceAll(
            `{{${i}}}`,
            notTranslatableWords[i]
          );
        }

        translations.push(translation);
      }

      // Fix spaces
      const beforeTranslationContent: string[] = JSON.parse(updatedContent);

      // TODO: fix an issue where beforeTranslationContent.length and translations.length are not equal
      try {
        for (let i = 0; i < translations.length; i++) {
          const [start, end] = beforeTranslationContent[i].split(
            beforeTranslationContent[i].trim()
          );

          if (
            start &&
            translations[i].length === translations[i].trimStart().length
          ) {
            translations[i] = start + translations[i];
          }

          if (
            end &&
            translations[i].length === translations[i].trimEnd().length
          ) {
            translations[i] += end;
          }
        }
      } catch (error) {
        console.log(error);
      }

      // TODO: delete after debug

      const slackWebhookUrl = process.env.SLACK_INCOMING_WEBHOOK_URL_AI_TOOL;

      if (slackWebhookUrl) {
        try {
          fetch(slackWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              blocks: [
                {
                  type: "header",
                  text: {
                    type: "plain_text",
                    text: `SB AI Tool Usage`,
                  },
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text:
                      "```" +
                      `**BeforeTranslationContent**: ${JSON.stringify(
                        beforeTranslationContent,
                        null,
                        "\t"
                      )}          
            \n**translations**: ${JSON.stringify(
              translations,
              null,
              "\t"
            )}  \n**Time**: ${new Date(Date.now()).toISOString()} ` +
                      "```",
                  },
                },
              ],
            }),
          }).catch((error) => {
            console.log("Error during slack submit: ", error);
          });
        } catch (error) {
          console.log("Error during slack submit: ", error);
        }
      }

      for (let k = 0; k < beforeTranslationContent.length; k++) {
        if (
          notTranslatableWords.some(
            (notTranslatableWord) =>
              beforeTranslationContent[k]?.includes(notTranslatableWord)
          ) &&
          !notTranslatableWords.some(
            (notTranslatableWord) =>
              translations[k]?.includes(notTranslatableWord)
          )
        ) {
          if (slackWebhookUrl) {
            try {
              fetch(slackWebhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  blocks: [
                    {
                      type: "header",
                      text: {
                        type: "plain_text",
                        text: `SB AI Tool Ignore words error`,
                      },
                    },
                    {
                      type: "section",
                      text: {
                        type: "mrkdwn",
                        text:
                          "```" +
                          `**BeforeTranslationContent**: ${JSON.stringify(
                            beforeTranslationContent,
                            null,
                            "\t"
                          )}            
                \n**translations**: ${JSON.stringify(translations, null, "\t")}
                \n**Time**: ${new Date(Date.now()).toISOString()}` +
                          "```",
                      },
                    },
                  ],
                }),
              }).catch((error) => {
                console.log("Error during slack submit: ", error);
              });
            } catch (error) {
              console.log("Error during slack submit: ", error);
            }
          }
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
