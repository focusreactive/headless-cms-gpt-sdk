import { translateJSON } from "@focus-reactive/content-ai-sdk";
import {
  ISbContentMangmntAPI,
  ISbRichtext,
  ISbStoryData,
} from "storyblok-js-client";

import { SpaceInfo } from "../../../config/spaceData";
import { applyTranslations } from "../applyTranslations";
import { collectPairs } from "../collectPairs";
import { translateInBatches } from "../translateInBatches";
import { SBManagementClient } from "../../../config/initClient";

import { FolderTranslationData, TranslationLevels } from "../../../config";

export const localizeStory = async (
  props: LocalizeStoryProps
): Promise<
  | {
      original: ISbStoryData;
      translated: ISbStoryData;
      /** Source texts the model never answered for; written back untranslated. */
      untranslated: string[];
    }
  | undefined
> => {
  if (!SpaceInfo) {
    return Promise.reject(new Error("SDK is not initialised"));
  }

  return new Promise((resolve, reject) => {
    const handleMessage = async (e: { data: { story: ISbStoryData } }) => {
      if (!SpaceInfo || !SBManagementClient) {
        return Promise.reject(new Error("SDK is not initialised"));
      }

      const isFolderLevel = props.translationLevel === "folder";

      let story = e.data.story;

      try {
        if (isFolderLevel) {
          const folderId = props.folderLevelTranslation.targetFolderId;

          const storyData = (await SBManagementClient.put(
            `spaces/${SpaceInfo.spaceId}/stories/${story.id}/duplicate`,
            {
              auto_create_folders: true,
              target_dimension: folderId,
              story: { group_id: story.group_id },
              same_path: true,
            } as unknown as ISbContentMangmntAPI
          )) as unknown as { data: { story: ISbStoryData } };

          story = storyData.data.story;
        }

        // load components schema to define translatable fields
        const componentsSchema = (
          await SBManagementClient.get(
            `spaces/${SpaceInfo.spaceId}/components/`
          )
        ).data.components;

        const componentWithTranslatableFields = getTranslatableFields(
          componentsSchema,
          isFolderLevel &&
            props.folderLevelTranslation.translationMode === "all"
        );

        const fieldsForTranslation = traverseObject({
          object: story,
          condition: ({ key, value, object }) => {
            function resolveType(type: string) {
              if (type === "richtext" && typeof value == "object") {
                return "object";
              }

              return "string";
            }

            function hasComponentField(
              object: unknown
            ): object is Record<"component", string> {
              return Boolean(
                typeof object === "object" && object && "component" in object
              );
            }

            return Object.entries(componentWithTranslatableFields).some(
              ([component, fields]) =>
                hasComponentField(object) &&
                object.component === component &&
                fields.some(
                  (field) =>
                    key === field.field &&
                    typeof value === resolveType(field.type)
                )
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

        const { translations, missing } = await translateInBatches(
          collectPairs(fieldsForTranslation),
          async (batch) =>
            JSON.parse(
              await translateJSON({
                targetLanguage: props.targetLanguageName,
                content: Object.fromEntries(batch),
                promptModifier: props.promptModifier ? props.promptModifier : "",
                isFlat: true,
                notTranslatableWords: props.notTranslatableWords,
              })
            )
        );

        const newStory = applyTranslations({
          fields: fieldsForTranslation,
          translations,
          story,
          i18nSuffix: isFolderLevel
            ? ""
            : `__i18n__${props.targetLanguageCode}`,
        });

        let newStoryData: { story: ISbStoryData };

        if (props.mode === "createNew") {
          newStoryData = await SBManagementClient.post(
            `spaces/${SpaceInfo.spaceId}/stories/`,
            {
              story: {
                name: `${story.name} (${props.targetLanguageName})`,
                slug: `${story.slug}-${props.targetLanguageCode}`,
                content: newStory.content,
                parent_id: String(story.parent_id),
              },
            }
          );
          props.cb(newStoryData);
        }

        if (props.mode === "update") {
          newStoryData = await SBManagementClient.put(
            `spaces/${SpaceInfo.spaceId}/stories/${story.id}`,
            {
              story: {
                name: `${story.name}`,
                slug: `${story.slug}`,
                content: newStory.content,
                parent_id: String(story.parent_id),
              },
            }
          );

          props.cb(newStoryData);
        }

        if (props.mode === "returnData") {
          newStoryData = {
            story: {
              ...story,
              name: `${story.name} (${props.targetLanguageName})`,
              slug: `${story.slug}-${props.targetLanguageCode}`,
              content: newStory.content,
              parent_id: story.parent_id,
            },
          };

          props.cb(newStoryData);
        }

        resolve({
          original: story,
          translated: newStory,
          untranslated: missing.map(([, sourceText]) => sourceText),
        });
      } catch (e) {
        console.error("Failed to localize the document", e);

        reject(new Error("Failed to localize the document"));
      }
    };

    window.addEventListener("message", handleMessage, { once: true });

    window.parent.postMessage(
      {
        action: "tool-changed",
        tool: SpaceInfo?.pluginName,
        event: "getContext",
      },
      "*"
    );
  });
};

interface LocalizeStoryProps {
  targetLanguageCode: string;
  targetLanguageName: string;
  cb: (newStoryData: { story: ISbStoryData }) => void;
  promptModifier?: string;
  mode: "createNew" | "update" | "returnData" | "test";
  translationLevel: TranslationLevels;
  folderLevelTranslation: FolderTranslationData;
  notTranslatableWords: string[];
}

type HelperFunction = ({
  key,
  newPath,
  value,
  object,
}: {
  key: string;
  newPath: string;
  value: unknown;
  object: unknown;
}) => unknown;

type TraverseObject = {
  object: unknown;
  condition: HelperFunction;
  transformKey?: HelperFunction;
  transformValue?: HelperFunction;
  path?: string;
  outputArr?: [unknown, unknown][];
};

function traverseObject({
  object,
  condition,
  transformKey = ({ newPath }) => newPath,
  transformValue = ({ value }) => value,
  path = "",
  outputArr = [],
}: TraverseObject) {
  if (object && typeof object === "object") {
    for (const [key, value] of Object.entries(object)) {
      const newPath = [path, key].filter(Boolean).join(".");

      if (condition({ key, value, object, newPath })) {
        outputArr.push([
          transformKey({ key, newPath, value, object }),
          transformValue({ key, newPath, value, object }),
        ]);
      } else if (value && typeof value === "object") {
        traverseObject({
          object: value,
          condition,
          transformKey,
          transformValue,
          path: newPath,
          outputArr,
        });
      }
    }
  }

  return outputArr;
}

type ComponentField = {
  type: string;
  translatable?: boolean;
};

type ComponentSchema = {
  name: string;
  schema: Record<string, ComponentField>;
};

type SelectedComponentsField = { field: string; type: string };

type ComponentsWithTranslatableFields = Record<
  string,
  SelectedComponentsField[]
>;

function getTranslatableFields(
  components: ComponentSchema[],
  allFields?: boolean
) {
  const componentsWithTranslatableFields: ComponentsWithTranslatableFields = {};

  for (const component of components) {
    const selectedFields = Object.entries(component.schema).flatMap(
      ([key, value]) => {
        const type = value.type;

        if (
          (value.translatable || allFields) &&
          (type === "text" || type === "textarea" || type === "richtext")
        ) {
          return {
            field: key,
            type,
          };
        }

        return [];
      }
    );

    if (selectedFields.length) {
      componentsWithTranslatableFields[component.name] = selectedFields;
    }
  }

  return componentsWithTranslatableFields;
}

type FieldForTranslationData =
  | { default: string; forTranslation: string }
  | { default: ISbRichtext; forTranslation: [string, string][] };

type FieldForTranslation = [string, FieldForTranslationData];

