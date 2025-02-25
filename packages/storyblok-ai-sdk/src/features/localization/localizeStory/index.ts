import { translateJSON } from "@focus-reactive/content-ai-sdk";
import {
  ISbContentMangmntAPI,
  ISbRichtext,
  ISbStoryData,
} from "storyblok-js-client";

import { SpaceInfo } from "../../../config/spaceData";
import { SBManagementClient } from "../../../config/initClient";

import { FolderTranslationData, TranslationLevels } from "../../../config";

export const localizeStory = async (props: LocalizeStoryProps) => {
  if (!SpaceInfo) {
    throw new Error("SDK is not initialised");
  }

  const handleMessage = async (e: { data: { story: ISbStoryData } }) => {
    if (!SpaceInfo || !SBManagementClient) {
      throw new Error("SDK is not initialised");
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
        await SBManagementClient.get(`spaces/${SpaceInfo.spaceId}/components/`)
      ).data.components;

      const componentWithTranslatableFields = getTranslatableFields(
        componentsSchema,
        isFolderLevel && props.folderLevelTranslation.translationMode === "all"
      );

      const fieldsForTranslation = traverseObject({
        object: story,
        condition: ({ key, value, object }) => {
          function resolveType(type: string) {
            if (type === "richtext") {
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

      const { arrForTranslation } =
        flattenFieldsForTranslation(fieldsForTranslation);

      const translateJSONChunk = async (chunk: Record<string, string>) => {
        return translateJSON({
          targetLanguage: props.targetLanguageName,
          content: chunk,
          promptModifier: props.promptModifier ? props.promptModifier : "",
          isFlat: true,
          notTranslatableWords: props.notTranslatableWords,
        }).then((translatedChunk) => {
          return JSON.parse(translatedChunk);
        });
      };

      const translatedChunks = await Promise.all(
        arrForTranslation.map((chunk) => {
          return translateJSONChunk(chunk);
        })
      );

      const newStory = mergeTranslatedFields(
        fieldsForTranslation,
        translatedChunks,
        story,
        isFolderLevel ? "" : `__i18n__${props.targetLanguageCode}`
      );

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
    } catch (e) {
      console.error("Failed to localize the document", e);
      throw new Error("Failed to localize the document");
    }
  };

  window.addEventListener("message", handleMessage, { once: true });

  window.parent.postMessage(
    {
      action: "tool-changed",
      tool: SpaceInfo.pluginName,
      event: "getContext",
    },
    "*"
  );
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

export function traverseObject({
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

function replaceFieldValue(
  object: Record<string, unknown>,
  pathToField: string,
  newValue: unknown
) {
  if (object && typeof object === "object") {
    const arrOfFields = pathToField.split(".");
    const lastField = arrOfFields.pop();

    for (const field of arrOfFields) {
      object = object[field] as Record<string, unknown>;
    }

    if (lastField) {
      if (newValue) {
        object[lastField] = newValue;
      }

      return object[lastField];
    }
  }
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

export function getTranslatableFields(
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

export type FieldForTranslation = [string, FieldForTranslationData];

export function flattenFieldsForTranslation(
  fieldsForTranslation: FieldForTranslation[]
) {
  const mapForTranslation = traverseObject({
    object: fieldsForTranslation,
    condition: ({ key, value, newPath }) =>
      (key.includes("forTranslation") && typeof value === "string") ||
      newPath.match(/forTranslation.\d+.1/),
  }) as [string, string][];

  const arrForTranslation = mapForTranslation.map((value) => ({
    [value[0]]: value[1],
  }));

  return { mapForTranslation, arrForTranslation };
}

export function mergeTranslatedFields(
  fieldsForTranslation: FieldForTranslation[],
  translated: Record<string, string>[],
  object: ISbStoryData,
  i18nSuffix?: string
) {
  const restoredFieldsAfterTranslation = structuredClone(fieldsForTranslation);

  for (let i = 0; i < translated.length; i++) {
    let path = "";
    let translatedValue = "";

    Object.entries(translated[i]).forEach(([key, value]) => {
      path = key;
      translatedValue = value;
    });

    replaceFieldValue(
      restoredFieldsAfterTranslation as unknown as Record<string, unknown>,
      path,
      translatedValue
    );
  }

  const newData = structuredClone(object);

  for (const record of restoredFieldsAfterTranslation) {
    let fieldPath = record[0];

    if (i18nSuffix) {
      fieldPath += i18nSuffix;
    }

    const translated = record[1].forTranslation;

    if (Array.isArray(translated) && typeof record[1].default === "object") {
      const translatedRichtext = { ...record[1].default };

      for (const field of translated) {
        replaceFieldValue(translatedRichtext, field[0], field[1]);
      }

      replaceFieldValue(
        newData as unknown as Record<string, unknown>,
        fieldPath,
        translatedRichtext
      );
    } else {
      replaceFieldValue(
        newData as unknown as Record<string, unknown>,
        fieldPath,
        translated
      );
    }
  }

  return newData;
}
