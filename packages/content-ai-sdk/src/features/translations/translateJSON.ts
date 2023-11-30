import { getOpenAiClient } from "../../config/openAi";

interface TranslateOptions {
  targetLanguage: string;
  content: unknown;
  promptModifier?: string;
}

export const translateJSON = async ({
  targetLanguage,
  content,
  promptModifier = "",
}: TranslateOptions) => {
  const openAiClient = getOpenAiClient();

  if (!openAiClient) {
    throw new Error("OpenAI client is not configurated");
  }

  try {
    // !TODO work on symbols limitations
    const chatCompletion = await openAiClient.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You will be provided with a JSON string, and your task is to translate fields values into ${targetLanguage}. Act like a native ${targetLanguage} speaker and rephase the text in a way that it sounds natural. ${promptModifier}`,
        },
        { role: "user", content: JSON.stringify(content) },
      ],
      model: "gpt-3.5-turbo-1106",
      temperature: 0,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: { type: "json_object" },
    });

    return chatCompletion.choices[0].message.content as string;
  } catch {
    throw new Error("Failed to translate JSON");
  }
};
