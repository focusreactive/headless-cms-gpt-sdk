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

  const storiesResponse = (await SBManagementClient.get(
    `spaces/${env.SB_SPACE_ID}/stories?starts_with=${folderSlug}&story_only=1&per_page=100`,
  )) as unknown as {
    data: { stories: ISbStoryData[] };
  };
  const stories = storiesResponse.data.stories.filter((story) =>
    story.full_slug.startsWith(folderSlug),
  );
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

  for (const story of stories) {
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

  const translatedChunks = await Promise.all(
    arrForTranslation.map(async (chunk) => {
      const maxRetries = 3;
      let attempt = 1;

      while (attempt <= maxRetries) {
        try {
          return await translateJSONChunk(chunk);
        } catch (error) {
          if (attempt === maxRetries) {
            console.error(
              `localizeFolder: Failed to translate chunk after ${maxRetries} attempts:`,
              `Story: ${story.full_slug}`,
              `Chunk:\n${chunk}`,
              error,
            );
            throw error;
          }
          console.warn(
            `localizeFolder: Translation attempt ${attempt} failed, retrying...`,
            `Story: ${story.full_slug}`,
            `Chunk:\n${chunk}`,
            error,
          );
          attempt++;

          await new Promise((resolve) => setTimeout(resolve, 1000)); // delay before retry
        }
      }
    }),
  );

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
        if (type === "richtext") {
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

async function main() {
  try {
    await localizeFolder({
      folderSlug: "test-the-wanderer",
    });
  } catch (error) {
    console.error(error);
  }
}

main();
