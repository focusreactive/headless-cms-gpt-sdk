// yarn dev:sb
// cd packages/storyblok-ai-sdk
// npx tsx src/scripts/localizeStoriesBatch.ts

import StoryblokClient, { ISbStoryData } from "storyblok-js-client";
import { translateJSON } from "@focus-reactive/content-ai-sdk";
import {
  FieldForTranslation,
  flattenFieldsForTranslation,
  getTranslatableFields,
  mergeTranslatedFields,
  traverseObject,
} from "../features/localization";
import { initSDK as configure } from "@focus-reactive/content-ai-sdk";
import path from "node:path";
import z from "zod";
import { fileURLToPath } from "url";
import inquirer from "inquirer";
import Bottleneck from "bottleneck";
import * as fs from "node:fs/promises";
import * as process from "node:process";

const cyan = "\x1b[36m";
const magenta = "\x1b[35m";
const reset = "\x1b[0m";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, "../../.env");
const rawEnv = await import("dotenv").then((dotenv) =>
  dotenv.config({ path: envPath }),
);
const envSchema = z.object({
  SB_SPACE_ID: z.string(),
  SB_ACCESS_TOKEN: z.string(),
  SB_REGION: z.string(),
  OPENAI_TOKEN: z.string(),
});
const env = envSchema.parse(rawEnv.parsed);
configure({ openAiToken: env.OPENAI_TOKEN });

const NOT_TRANSLATABLE_WORDS = [
  "Firsty",
  "Firsty Free",
  "Comfort +",
  "Comfort+",
  "First Class",
  "Trustpilot",
  "firsty",
  "First-class",
  "first class",
  "comfort+",
];

const SBManagementClient = new StoryblokClient({
  oauthToken: env.SB_ACCESS_TOKEN,
  region: env.SB_REGION,
});

const limiter = new Bottleneck({
  minTime: 15,
  maxConcurrent: 50,
  reservoir: 250,
  reservoirRefreshAmount: 250,
  reservoirRefreshInterval: 60 * 1000 + 1000, // 1m + 1s just in case
});

async function localizeStoriesBatch({ startsWith }: { startsWith: string }) {
  const spaceResponse = await SBManagementClient.get(
    `spaces/${env.SB_SPACE_ID}`,
  );
  const space = spaceResponse.data.space;
  const languages = space.languages as { code: string; name: string }[];

  console.log(
    `localizeStoriesBatch: localize stories with slug starts with "${cyan}%s${reset}" in space "${cyan}%s${reset}"`,
    startsWith,
    space.name,
  );
  console.log("localizeStoriesBatch: languages", languages);

  const stories = await getAllStories({
    startsWith,
  });

  const updatedStories: ISbStoryData[] = [];

  console.log(
    "localizeStoriesBatch: localize %s stories:\n%s",
    stories.length,
    stories
      .map((story) => ` - ${story.name} (${cyan}${story.full_slug}${reset})`)
      .join("\n"),
  );

  const { proceed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "proceed",
      message: "Do you want to proceed?",
      default: false,
    },
  ]);

  if (!proceed) {
    console.log("Aborted");
    process.exit(1);
  }

  async function processStory(story: ISbStoryData) {
    const storyWithContentResponse = (await SBManagementClient.get(
      `spaces/${env.SB_SPACE_ID}/stories/${story.id}`,
    )) as unknown as { data: { story: ISbStoryData } };
    let currentStory = storyWithContentResponse.data.story;

    for (const language of languages) {
      console.log(
        `localizeStoriesBatch: localize story "%s" (${cyan}%s${reset}) in ${magenta}"%s"${reset}`,
        story.name,
        story.full_slug,
        language.name,
      );
      currentStory = await localizeStory({
        story: currentStory,
        targetLanguageName: language.name,
        targetLanguageCode: language.code,
      });
    }

    const updatedStoryResponse = await SBManagementClient.put(
      `spaces/${env.SB_SPACE_ID}/stories/${story.id}`,
      {
        story: {
          name: `${story.name}`,
          slug: `${story.slug}`,
          content: currentStory.content,
          parent_id: String(story.parent_id),
        },
      },
    );
    const updatedStory = updatedStoryResponse.story;
    updatedStories.push(updatedStory);
    console.log(
      "localizeStoriesBatch: localized %s/%s stories",
      updatedStories.length,
      stories.length,
    );
    await fs.appendFile(
      path.join(__dirname, `completed-localizeStoriesBatch.ndjson`),
      `${JSON.stringify({
        full_slug: story.full_slug,
      })}\n`,
    );
  }

  const storiesChunks = chunkArray(stories, 3);
  for (const storiesChunk of storiesChunks) {
    await Promise.all(storiesChunk.map(processStory));
  }

  console.log(
    'localizeStoriesBatch: translated %s stories in "%s" folder',
    updatedStories.length,
    startsWith,
  );
}

async function localizeStory({
  story,
  targetLanguageName,
  targetLanguageCode,
}: {
  story: ISbStoryData;
  targetLanguageName: string;
  targetLanguageCode: string;
}) {
  // load components schema to define translatable fields
  const componentsSchema = (
    await SBManagementClient.get(`spaces/${env.SB_SPACE_ID}/components/`)
  ).data.components;

  const componentWithTranslatableFields = getTranslatableFields(
    componentsSchema,
    false,
  );

  const fieldsForTranslation = getFieldsForTranslation(
    story,
    componentWithTranslatableFields,
  );

  const { arrForTranslation } =
    flattenFieldsForTranslation(fieldsForTranslation);

  const translateJSONChunk = async (chunk: Record<string, string>) => {
    return translateJSON({
      targetLanguage:
        targetLanguageCode === "pt"
          ? `${targetLanguageName} (pt-PT)`
          : targetLanguageName,
      content: chunk,
      promptModifier: "",
      isFlat: true,
      notTranslatableWords: NOT_TRANSLATABLE_WORDS,
      captureError: (context) => {
        console.log("captureError", context);
      },
    }).then((translatedChunk) => {
      return JSON.parse(translatedChunk);
    });
  };

  const translate = async (chunk: Record<string, string>) => {
    const maxRetries = 5;
    let attempt = 1;

    while (attempt <= maxRetries) {
      try {
        return await translateJSONChunk(chunk);
      } catch (error: any) {
        if (attempt === maxRetries) {
          console.error(
            `localizeStoriesBatch: Failed to translate chunk after ${maxRetries} attempts:`,
            `\nStory: ${story.full_slug}\n`,
            error,
          );
          await fs.appendFile(
            path.join(__dirname, `error-localizeStoriesBatch.ndjson`),
            `${JSON.stringify({
              full_slug: story.full_slug,
              targetLanguageName,
              chunk,
            })}\n`,
          );
          return chunk;
        }
        console.warn(
          `localizeStoriesBatch: Translation attempt ${attempt} failed, retrying...`,
          `\nStory: ${story.full_slug}\n`,
          error,
        );
        attempt++;

        // if ("headers" in error) {
        //   const rateLimitError = error as RateLimitError;
        //   const retryAfterMs = rateLimitError.headers?.["retry-after-ms"];
        //   const delay = retryAfterMs ? Number(retryAfterMs) : 0;
        //   if (delay) {
        //     console.log("Retrying after %sms", delay + 100);
        //     await new Promise((resolve) => setTimeout(resolve, delay + 100)); // delay before retry + 100ms just in case
        //     continue;
        //   }
        // }

        await new Promise((resolve) => setTimeout(resolve, 3000)); // delay before retry
      }
    }
  };

  const translatedChunks: Record<string, string>[] = [];

  const translationPromises = arrForTranslation.map((chunk) =>
    limiter.schedule(() => translate(chunk)),
  );

  // const translationPromises = [
  //   ...arrForTranslation
  //       .slice(0, Math.ceil(arrForTranslation.length / 2))
  //       .map((chunk) => limiter.schedule(() => translate(chunk))),
  //   ...arrForTranslation
  //       .slice(0, Math.ceil(arrForTranslation.length / 2))
  //       .map((chunk) => limiter.schedule(() => translate(chunk))),
  // ];

  await Promise.all(translationPromises).then((results) => {
    translatedChunks.push(...results);
  });

  const newStory = mergeTranslatedFields(
    fieldsForTranslation,
    translatedChunks,
    story,
    `__i18n__${targetLanguageCode}`,
  );

  return newStory;
}

function getFieldsForTranslation(
  story: ISbStoryData,
  componentWithTranslatableFields: ReturnType<typeof getTranslatableFields>,
) {
  return traverseObject({
    object: story,
    condition: ({ key, value, object }) => {
      function resolveType(type: string) {
        if (type === "richtext" && typeof value == "object") {
          return "object";
        }

        return "string";
      }

      function hasComponentField(
        object: unknown,
      ): object is Record<"component", string> {
        return Boolean(
          typeof object === "object" && object && "component" in object,
        );
      }

      return Object.entries(componentWithTranslatableFields).some(
        ([component, fields]) =>
          hasComponentField(object) &&
          object.component === component &&
          fields.some(
            (field) =>
              key === field.field && typeof value === resolveType(field.type),
          ),
      );
    },
    transformValue: ({ value }) => {
      if (typeof value === "object") {
        return {
          default: value,
          forTranslation: traverseObject({
            object: value,
            condition: ({ key, value }) =>
              key === "text" && typeof value === "string",
          }),
        };
      }

      return {
        default: value,
        forTranslation: value,
      };
    },
  }) as FieldForTranslation[];
}

async function getAllStories({ startsWith }: { startsWith?: string }) {
  const stories: ISbStoryData[] = [];
  const perPage = 100;
  let page = 1;

  const initialResponse = (await SBManagementClient.get(
    `spaces/${
      env.SB_SPACE_ID
    }/stories?story_only=1&per_page=${perPage}&page=${page}${
      startsWith ? `starts_with=${startsWith}` : ""
    }`,
  )) as unknown as {
    data: {
      stories: ISbStoryData[];
    };
    total: number;
  };

  const totalPages = Math.ceil(initialResponse.total / perPage);

  stories.push(...initialResponse.data.stories);

  for (page = 2; page <= totalPages; page++) {
    const response = (await SBManagementClient.get(
      `spaces/${
        env.SB_SPACE_ID
      }/stories?story_only=1&per_page=${perPage}&page=${page}${
        startsWith ? `starts_with=${startsWith}` : ""
      }`,
    )) as unknown as {
      data: { stories: ISbStoryData[] };
    };
    stories.push(...response.data.stories);
  }

  return stories.filter((story) =>
    startsWith
      ? story.full_slug === startsWith ||
        story.full_slug.startsWith(`${startsWith}/`)
      : true,
  );
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function main() {
  try {
    await localizeStoriesBatch({
      startsWith: "test-ai-translated-gpt-4o",
    });
  } catch (error) {
    console.error(error);
  }
}

main();
