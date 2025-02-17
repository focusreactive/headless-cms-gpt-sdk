import { getOpenAiClient } from "../../config/openAi";

interface Tag {
  id: string | number;
  title: string;
  description?: string;
}

interface AppplyTagsProps {
  content: unknown;
  contentTitle: string;
  promptModifier?: string;
  resultAmount?: number;
  tags: Tag[];
}

export const applyTags = async ({
  content,
  contentTitle,
  tags,
  promptModifier = "",
  resultAmount = 5,
}: AppplyTagsProps) => {
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
            isValidJSON ? "a JSON titled" : "a text titled"
          } '${contentTitle}'. ${promptModifier}`,
        },
        { role: "user", content: JSON.stringify(content) },
        {
          role: "user",
          content: `Find all tags relevant to the provided text from the following list: ${JSON.stringify(
            tags
          )}. Then sort these tags based on their relevance. Return a JSON object with only one key "tags", this should be an array of sorted tags. Tags should have exact the same format as they were provided. Return maximum ${resultAmount} tags.`,
        },
      ],
      model: "gpt-4o",
      temperature: 0,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: { type: "json_object" },
    });

    try {
      const resultTags = JSON.parse(
        chatCompletion.choices[0].message.content as string
      ).tags as Tag[];

      return resultTags.filter((tag) => tags.some((t) => t.id === tag.id));
    } catch (error) {
      throw new Error("Failed to parse result JSON");
    }
  } catch {
    throw new Error("Failed to apply tags");
  }
};
