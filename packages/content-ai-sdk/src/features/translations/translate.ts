import { getOpenAiClient } from "../../config/openAi";

interface TranslateOptions {
  targetLanguage: string;
  currentLanguage?: string;
  content: string;
  promptModifier?: string;
}

export const translate = async ({
  targetLanguage,
  currentLanguage,
  content,
  promptModifier,
}: TranslateOptions) => {
  const openAiClient = getOpenAiClient();

  if (!openAiClient) {
    throw new Error("OpenAI client is not configurated");
  }

  // !TODO work on symbols limitations
  const chatCompletion = await openAiClient.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You will be provided with a text, and your task is to translate it${
          currentLanguage ? " from " + currentLanguage : ""
        } into ${targetLanguage}. Act like a native ${targetLanguage} speaker and rephase the text in a way that it sounds natural. ${promptModifier}`,
      },
      { role: "user", content },
    ],
    model: "gpt-3.5-turbo-1106",
    response_format: { type: "text" },
    temperature: 0,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });

  return chatCompletion.choices[0].message.content;
};
