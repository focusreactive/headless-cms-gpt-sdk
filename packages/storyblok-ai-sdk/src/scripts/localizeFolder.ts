// yarn dev:sb
// cd packages/storyblok-ai-sdk
// npx tsx src/scripts/localizeFolder.ts

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
import { RateLimitError } from "openai/error";

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
  minTime: 15, // Minimum time between requests (in milliseconds)
  maxConcurrent: 250, // Process 500 requests at a time
  reservoir: 250, // Start with 3500 requests available
  reservoirRefreshAmount: 250, // Refill back to 3500
  reservoirRefreshInterval: 60 * 1000 + 1000, // Refill every 60 seconds (1 minute) + 1s
});

async function localizeFolder({ folderSlug }: { folderSlug: string }) {
  const spaceResponse = await SBManagementClient.get(
    `spaces/${env.SB_SPACE_ID}`,
  );
  const space = spaceResponse.data.space;
  const languages = space.languages as { code: string; name: string }[];

  console.log("localizeFolder: languages", languages);

  const foldersResponse = (await SBManagementClient.get(
    `spaces/${env.SB_SPACE_ID}/stories?starts_with=${folderSlug}&folder_only=1&per_page=100`,
  )) as unknown as {
    data: { stories: { name: string; id: number; slug: string }[] };
  };
  const folders = foldersResponse.data.stories.map((folder) => ({
    name: folder.name,
    id: folder.id,
    slug: folder.slug,
  }));
  const filteredFolders = folders.filter(
    (folder) => folder.slug === folderSlug,
  );

  if (filteredFolders.length > 1) {
    throw new Error("Multiple folders with the same slug found");
  }

  const folder = filteredFolders[0];

  if (!folder) {
    throw new Error("Folder not found");
  }

  console.log(
    `localizeFolder: localize folder "%s" (${cyan}%s${reset})`,
    folder.name,
    folder.slug,
  );

  const stories = await getAllStories({
    folderSlug: folderSlug,
  });

  const updatedStories: ISbStoryData[] = [];

  console.log(
    "localizeFolder: localize %s stories:\n%s",
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
        `localizeFolder: localize story "%s" (${cyan}%s${reset}) in ${magenta}"%s"${reset}`,
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
      "localizeFolder: localized %s/%s stories",
      updatedStories.length,
      stories.length,
    );
  }

  const storiesChunks = chunkArray(stories, 10);
  for (const storiesChunk of storiesChunks) {
    await Promise.all(storiesChunk.map(processStory));
  }

  console.log(
    'localizeFolder: translated %s stories in "%s" folder',
    updatedStories.length,
    folder.name,
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
      targetLanguage: targetLanguageName,
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
            `localizeFolder: Failed to translate chunk after ${maxRetries} attempts:`,
            `\nStory: ${story.full_slug}\n`,
            error,
          );
          await fs.appendFile(
            path.join(__dirname, `error-localizeFolder.ndjson`),
            `${JSON.stringify({
              full_slug: story.full_slug,
              targetLanguageName,
              chunk,
            })}\n`,
          );
          return chunk;
        }
        console.warn(
          `localizeFolder: Translation attempt ${attempt} failed, retrying...`,
          `\nStory: ${story.full_slug}\n`,
          error,
        );
        attempt++;

        if ("headers" in error) {
          const rateLimitError = error as RateLimitError;
          const retryAfterMs = rateLimitError.headers?.["retry-after-ms"];
          const delay = retryAfterMs ? Number(retryAfterMs) : 0;
          if (delay) {
            console.log("Retrying after %sms", delay + 100);
            await new Promise((resolve) => setTimeout(resolve, delay + 100)); // delay before retry
            continue;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 3000)); // delay before retry
      }
    }
  };

  const translatedChunks: Record<string, string>[] = [];

  const translationPromises = arrForTranslation.map((chunk) =>
    limiter.schedule(() => translate(chunk)),
  );

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

async function getAllStories({ folderSlug }: { folderSlug: string }) {
  const stories: ISbStoryData[] = [];
  const perPage = 100;
  let page = 1;

  const initialResponse = (await SBManagementClient.get(
    `spaces/${env.SB_SPACE_ID}/stories?starts_with=${folderSlug}&story_only=1&per_page=${perPage}&page=${page}`,
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
      `spaces/${env.SB_SPACE_ID}/stories?starts_with=${folderSlug}&story_only=1&per_page=${perPage}&page=${page}`,
    )) as unknown as {
      data: { stories: ISbStoryData[] };
    };
    stories.push(...response.data.stories);
  }

  return stories.filter((story) =>
    story.full_slug.startsWith(`${folderSlug}/`),
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
    await localizeFolder({
      folderSlug: "test-ai-translated-gpt-4o",
    });
  } catch (error) {
    console.error(error);
  }
}

main();
