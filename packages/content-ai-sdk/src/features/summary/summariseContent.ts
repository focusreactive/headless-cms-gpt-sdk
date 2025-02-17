import { getOpenAiClient } from "../../config/openAi";

interface SummariseContentProps {
  content: unknown;
  contentTitle: string;
  promptModifier?: string;
}

export const summariseContent = async ({
  content,
  contentTitle,
  promptModifier = "",
}: SummariseContentProps) => {
  const openAiClient = getOpenAiClient();

  if (!openAiClient) {
    throw new Error("OpenAI client is not configurated");
  }

  let isValidJSON = false;
  try {
    JSON.parse(JSON.stringify(content));
    isValidJSON = true;
  } catch {
    console.info("Content is not a valid JSON");
  }

  try {
    // !TODO work on symbols limitations
    const chatCompletion = await openAiClient.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You will be provided with ${
            isValidJSON ? "a JSON titled" : "an text titled"
          } '${contentTitle}'. Could you provide a detailed summary focusing on the main described things and with an attention to details? Maintain the original text style without alterations. Result should not contain any information about the content type itself. ${promptModifier}`,
        },
        { role: "user", content: JSON.stringify(content) },
      ],
      model: "gpt-4o",
      temperature: 0.3,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: { type: "text" },
    });

    return chatCompletion.choices[0].message.content as string;
  } catch {
    throw new Error("Failed to translate JSON");
  }
};
