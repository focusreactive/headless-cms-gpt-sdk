// cd packages/storyblok-ai-sdk
// pnpx tsx src/scripts/localizeFolder.ts

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

// TODO: fetch `notTranslatableWords`
// React.useEffect(() => {
//   fetch(`/api/space-settings?spaceId=${spaceId}`, {
//     method: 'GET',
//   })
//       .then((data) => data.json())
//       .then(
//           (spaceSettings) =>
//               spaceSettings.notTranslatableWords &&
//               dispatch({
//                 type: 'setNotTranslatableWords',
//                 payload: spaceSettings.notTranslatableWords,
//               }),
//       )
// }, [])
const notTranslatableWords = [
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

  if (folders.length > 1) {
    throw new Error("Multiple folders found");
  }

  const folder = folders[0];

  if (!folder) {
    throw new Error("Folder not found");
  }

  // TODO: remove this
  if (folder.id !== 631205228) {
    throw new Error("FOLDER DISABLED IN TEST MODE");
  }

  console.log("localizeFolder: localize folder", folder.name);

  const storiesResponse = (await SBManagementClient.get(
    `spaces/${env.SB_SPACE_ID}/stories?with_parent=${folder.id}&per_page=100`,
  )) as unknown as {
    data: { stories: ISbStoryData[] };
  };
  // const stories = storiesResponse.data.stories;
  const stories = storiesResponse.data.stories.filter(
    (story) => story.slug === "first-class",
  );
  const updatedStories: Awaited<ReturnType<typeof localizeStory>>[] = [];

  for (const story of stories) {
    const storyWithContentResponse = (await SBManagementClient.get(
      `spaces/${env.SB_SPACE_ID}/stories/${story.id}`,
    )) as unknown as { data: { story: ISbStoryData } };
    const storyWithContent = storyWithContentResponse.data.story;

    for (const language of languages) {
      console.log(
        "localizeFolder: localize story %s in %s",
        story.name,
        language.name,
      );
      const updatedStory = await localizeStory({
        story: storyWithContent,
        targetLanguageName: language.name,
        targetLanguageCode: language.code,
      });
      updatedStories.push(updatedStory);
    }
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
      notTranslatableWords,
      captureError: (context) => {
        console.log("captureError", context);
      },
    }).then((translatedChunk) => {
      return JSON.parse(translatedChunk);
    });
  };

  const translatedChunks = await Promise.all(
    arrForTranslation.map((chunk) => {
      return translateJSONChunk(chunk);
    }),
  );

  const newStory = mergeTranslatedFields(
    fieldsForTranslation,
    translatedChunks,
    story,
    `__i18n__${targetLanguageCode}`,
  );

  return await SBManagementClient.put(
    `spaces/${env.SB_SPACE_ID}/stories/${story.id}`,
    {
      story: {
        name: `${story.name}`,
        slug: `${story.slug}`,
        content: newStory.content,
        parent_id: String(story.parent_id),
      },
    },
  );
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
      folderSlug: "test-plans",
    });
  } catch (error) {
    console.error(error);
  }
}

main();
