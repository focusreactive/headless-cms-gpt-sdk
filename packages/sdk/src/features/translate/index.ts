import { getOpenAiClient } from "../../config/openAi";

interface TranslateOptions {
  targetLanguage: string;
  content: string;
}

export const translate = async ({
  targetLanguage,
  content,
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
        content: `You will be provided with a text, and your task is to translate it into ${targetLanguage}.`,
      },
      { role: "user", content },
    ],
    model: "gpt-3.5-turbo",
    temperature: 0,
  });

  console.log("chatCompletion", chatCompletion);

  return chatCompletion.choices[0].message.content;
};
