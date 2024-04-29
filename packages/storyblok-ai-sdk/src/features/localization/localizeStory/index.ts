/* eslint-disable @typescript-eslint/no-unused-vars */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { translateJSON } from "@focus-reactive/content-ai-sdk";
import { ISbContentMangmntAPI, ISbStoryData } from "storyblok-js-client";

import { SpaceInfo } from "../../../config/spaceData";
import { SBManagementClient } from "../../../config/initClient";

import { FolderTranslationData, TranslationLevels } from "../../../config";

interface LocalizeStoryProps {
  targetLanguageCode: string;
  targetLanguageName: string;
  cb: (newStoryData: { story: ISbStoryData }) => void;
  promptModifier?: string;
  mode: "createNew" | "update" | "returnData" | "test";
  translationLevel: TranslationLevels;
  folderLevelTranslation: FolderTranslationData;
}

function traverseObject(
  object,
  condition,
  optionsForKey = {
    transform: (key, value) => key,
  },
  optionsForValue = {
    transform: (key, value) => value,
  },
  path = "",
  outputArr = []
) {
  for (const [key, value] of Object.entries(object)) {
    const newPath = [path, key].filter(Boolean).join(".");

    if (condition(key, value, object, newPath)) {
      outputArr.push([
        optionsForKey.transform(newPath, value),
        optionsForValue.transform(newPath, value),
      ]);
    } else if (value && typeof value === "object") {
      traverseObject(
        value,
        condition,
        optionsForKey,
        optionsForValue,
        newPath,
        outputArr
      );
    }
  }

  return outputArr;
}

function findFieldInObject(object, pathToField, newValue) {
  const arrOfFields = pathToField.split(".");
  const lastField = arrOfFields.pop();

  for (const field of arrOfFields) {
    object = object[field];
  }

  if (newValue) {
    object[lastField] = newValue;
  }

  return object[lastField];
}

function getFieldValueFromObject(object, pathToField) {
  return findFieldInObject(object, pathToField);
}

function replaceFieldValue(object, pathToField, newValue) {
  return findFieldInObject(object, pathToField, newValue);
}

function getTranslatableFields(schema) {
  const translatableFields = traverseObject(
    schema,
    (key, value, object) =>
      key === "translatable" && typeof value === "boolean",
    {
      transform: (key, value, object) => key.split(".schema.")[0],
    },
    {
      transform: (key, value, object) =>
        key.split(".schema.")[1].replace(".translatable", ""),
    }
  );

  const componentWithTranslatableFields = {};

  for (const record of translatableFields) {
    const type = getFieldValueFromObject(
      schema,
      record[0] + ".schema." + record[1] + ".type"
    );

    if (type === "text" || type === "textarea" || type === "richtext") {
      componentWithTranslatableFields[
        getFieldValueFromObject(schema, record[0] + ".name")
      ] = {
        field: record[1],
        type,
      };
    }
  }

  return componentWithTranslatableFields;
}

function flattenFieldsForTranslation(fieldsForTranslation) {
  const mapForTranslation = traverseObject(
    fieldsForTranslation,
    (key, value, object, newPath) =>
      (key.includes("forTranlsation") && typeof value === "string") ||
      newPath.match(/forTranlsation.\d+.1/)
  );

  const arrForTranslation = mapForTranslation.map((value) => value[1]);

  return { mapForTranslation, arrForTranslation };
}

function mergeTranslatedFields(
  fieldsForTranslation,
  translated,
  object,
  mapForTranslation,
  i18nSufix
) {
  const restoredFieldsAfterTranslation = structuredClone(fieldsForTranslation);

  for (let i = 0; i < mapForTranslation.length; i++) {
    replaceFieldValue(
      restoredFieldsAfterTranslation,
      mapForTranslation[i][0],
      translated[i]
    );
  }

  const newData = structuredClone(object);

  for (const record of restoredFieldsAfterTranslation) {
    let fieldPath = record[0];

    if (i18nSufix) {
      fieldPath += i18nSufix;
    }

    const translated = record[1].forTranlsation;

    if (Array.isArray(translated)) {
      const translatedRichtext = { ...record[1].default };

      for (const field of translated) {
        replaceFieldValue(translatedRichtext, field[0], field[1]);
      }

      replaceFieldValue(newData, fieldPath, translatedRichtext);
    } else {
      replaceFieldValue(newData, fieldPath, translated);
    }
  }

  return newData;
}

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

      const componentWithTranslatableFields =
        getTranslatableFields(componentsSchema);

      const fieldsForTranslation = traverseObject(
        story,
        (key, value, object) => {
          function reolveType(type) {
            if (type === "richtext") {
              return "object";
            }

            return "string";
          }

          return Object.entries(componentWithTranslatableFields).some(
            ([component, params]) =>
              object.component === component &&
              key === params.field &&
              typeof value === reolveType(params.type)
          );
        },
        {
          transform: (key, value, object) => {
            return key;
          },
        },
        {
          transform: (key, value) => {
            if (typeof value === "object") {
              return {
                default: value,
                forTranlsation: traverseObject(
                  value,
                  (key, value, object) =>
                    key === "text" && typeof value === "string"
                ),
              };
            }

            return {
              default: value,
              forTranlsation: value,
            };
          },
        }
      );

      const { arrForTranslation, mapForTranslation } =
        flattenFieldsForTranslation(fieldsForTranslation);

      const translateJSONChunk = async (chunk: string) => {
        return translateJSON({
          targetLanguage: props.targetLanguageName,
          content: chunk,
          promptModifier: props.promptModifier ? props.promptModifier : "",
          isFlat: true,
        }).then((translatedChunk) => {
          return JSON.parse(translatedChunk);
        });
      };

      const translatedChunks = await Promise.all(
        arrForTranslation.map((chunk) => {
          return translateJSONChunk(chunk);
        })
      );
      console.log(translatedChunks);

      throw new Error("throw");
      const newStory = mergeTranslatedFields(
        fieldsForTranslation,
        translatedChunks,
        story,
        mapForTranslation,
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
