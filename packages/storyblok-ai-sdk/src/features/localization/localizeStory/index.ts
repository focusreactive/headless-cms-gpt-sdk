import { translateJSON } from "@focus-reactive/content-ai-sdk";
import { ISbContentMangmntAPI, ISbStoryData } from "storyblok-js-client";
import lodashGet from "lodash.get";
import lodashSet from "lodash.set";

import { SpaceInfo } from "../../../config/spaceData";
import { SBManagementClient } from "../../../config/initClient";
import { flatten, unflatten } from "flat";
import { FolderTranslationData, TranslationLevels } from "../../../config";

interface LocalizeStoryProps {
  cb: (newStoryData: { story: ISbStoryData }) => void;
  promptModifier?: string;
  mode: "createNew" | "update" | "returnData" | "test";
  translationLevel: TranslationLevels;
  targetLanguageCode: string;
  targetLanguageName: string;
  folderLevelTranslation: FolderTranslationData;
}

export const localizeStory = async (props: LocalizeStoryProps) => {
  if (!SpaceInfo) {
    throw new Error("SDK is not initialised");
  }

  let inProgress = false;

  const handleMessage = async (e: { data: { story: ISbStoryData } }) => {
    if (!SpaceInfo || !SBManagementClient) {
      throw new Error("SDK is not initialised");
    }

    // in case more than one handleMessage started, skip
    if (inProgress) {
      return;
    }

    inProgress = true;

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

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _editable, _uid, component, ...restContentToTranslate } =
        story.content;

      // load components schema to define translatable fields
      const componentsSchema = (
        await SBManagementClient.get(`spaces/${SpaceInfo.spaceId}/components/`)
      ).data.components as {
        schema: { [key: string]: { type: string; translatable: boolean } };
        translatable: boolean;
        name: string;
      }[];

      // filter fields that can be translated
      const fieldsThatCanBeTranslated = componentsSchema.reduce(
        (acc, component) => {
          const translatableFields = Object.keys(component.schema)
            .filter((key) => {
              const schema = component.schema[key];

              return (
                (schema.translatable ||
                  (isFolderLevel &&
                    props.folderLevelTranslation.translationMode === "all")) &&
                (schema.type === "text" ||
                  schema.type === "richtext" ||
                  schema.type === "textarea")
              );
            })
            .map((key) => ({
              name: key,
              component: component.name,
              type: component.schema[key].type,
            }));

          return [...acc, ...translatableFields];
        },
        [] as { name: string; component: string; type: string }[]
      );

      // flat the content to chunk be able to chunk and process it
      const flattenContent: { [key: string]: unknown } = flatten(
        restContentToTranslate
      );

      const initialValue: { [key: string]: unknown } = {};

      // rich text is a complex field, we need to handle it separately
      // here we create a list of rich text fields to be able to restore them after translation
      const richTextDefautFieldValues: {
        key: string;
        fields: unknown;
      }[] = [];

      const i18nSuffix = `__i18n__${props.targetLanguageCode}`;

      // then we need to find all the text fields that should be translated
      const filteredTextFields = Object.keys(flattenContent as object).reduce(
        (acc, cur) => {
          const value = flattenContent[cur] as string;

          // if the value is empty or not a string or already translated, we skip it
          if (
            !value ||
            typeof value?.match !== "function" ||
            cur.includes("__i18n__")
          ) {
            return acc;
          }

          // define key variables from string like "content.component.0.type", etc.
          const fieldPath = cur.split(".");
          const fieldName = fieldPath.pop();
          const fieldPathString = fieldPath.join(".");

          const componentName = fieldPathString
            ? flattenContent[`${fieldPathString}.component`]
            : component;

          // try ti find the field in the list of translatable fields
          const isCanBeTranslated = fieldsThatCanBeTranslated.find(
            (field) =>
              field.name === fieldName && field.component === componentName
          );

          // if we are ok to translate the field, we add it to the list
          if (isCanBeTranslated) {
            acc[
              `${fieldPathString ? `${fieldPathString}.` : ""}${fieldName}${
                isFolderLevel ? "" : i18nSuffix
              }`
            ] = value;

            return acc;
          }

          // next we need to work with rich text fields
          // they are way more complex and we need to handle them separately
          // mostly because we don't know the structure of the rich text field
          // first we need to detect if the field is part of the rich text
          const isPartOfRichText =
            flattenContent[`${fieldPath.join(".")}.type`] === "text" &&
            fieldName === "text";

          // then define some temporary variables to handle rich text defining logic
          let isRichTextTranslable = false;
          let richTextRootPath = "";

          if (isPartOfRichText) {
            // this function is used in recusive way few lines below
            const recoursiveKeysCheckForRichTextDetection = (key: string[]) => {
              const keyCopy = [...key];

              // we need to find the root of the rich text field
              const isRichTextRoot =
                flattenContent[`${keyCopy.join(".")}.type`] === "doc";

              if (!isRichTextRoot) {
                return false;
              }

              richTextRootPath = keyCopy.join(".");
              const fieldName = keyCopy.pop();

              // then we need to find the component where it used
              const componentName =
                keyCopy.length > 0
                  ? flattenContent[`${keyCopy.join(".")}.component`]
                  : component;

              // then we need to check if the field is translatable
              return fieldsThatCanBeTranslated.find(
                (field) =>
                  field.name === fieldName && field.component === componentName
              );
            };

            // run the recoursive function to detect if the field is part of the rich text
            fieldPath.forEach((_key, index) => {
              if (isRichTextTranslable) {
                return;
              }

              const keyToCheck = fieldPath.slice(0, index + 1);

              if (recoursiveKeysCheckForRichTextDetection(keyToCheck)) {
                isRichTextTranslable = true;
              }
            });
          }

          // in case the field is part of the rich text, we need to add it to the list of rich text default values
          // this part is requered to restore the rich text field after translation
          if (isPartOfRichText && isRichTextTranslable) {
            const richTextFieldPath = richTextRootPath.split(".");

            if (
              !richTextDefautFieldValues.find(
                (key) => key.key === richTextRootPath
              )
            ) {
              richTextDefautFieldValues.push({
                key: richTextRootPath,
                fields: lodashGet(restContentToTranslate, richTextFieldPath),
              });
            }

            acc[cur] = value;

            return acc;
          }

          // const isTextContent = value.split(" ").length > 1;

          return acc;
        },
        initialValue
      );

      // then we need to chunk the flatten story data
      const indexArray: string[][] = [];
      const chunks = Object.keys(filteredTextFields).reduce(
        (resultArray, item, index) => {
          const chunkIndex = Math.floor(index / 40);

          if (!resultArray[chunkIndex]) {
            resultArray[chunkIndex] = []; // start a new chunk
          }

          resultArray[chunkIndex].push(item);

          return resultArray;
        },
        indexArray
      );

      // then we need to convert each chunk to an object
      const objectsChunks = chunks.map((chunk) => {
        return chunk.reduce((result, item) => {
          return {
            ...result,
            [item]: filteredTextFields[item],
          };
        }, {});
      });

      // then we need to translate each chunk

      const translateJSONChunk = async (chunk: { [key: string]: string }) => {
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
        objectsChunks.map((chunk) => {
          return translateJSONChunk(chunk);
        })
      );

      // then we need to merge all translated chunks into one object
      const localizedJSON = translatedChunks.reduce(
        (result, chunk) => {
          return {
            ...(result as object),
            ...(chunk as object),
          };
        },
        { ...flattenContent }
      );

      // we mostly done with the translation, now we need to restore the rich text fields
      let newStoryData: { story: ISbStoryData };

      const storyContent: {
        component: string | undefined;
        _uid?: string | undefined;
        _editable?: string | undefined;
        [key: string]: unknown;
      } = {
        ...story.content,
        ...(unflatten(localizedJSON) as object),
        component,
      };

      if (props.mode === "test") {
        return objectsChunks;
      }

      // restore rich text fields and replace the translated values key
      richTextDefautFieldValues.forEach((field) => {
        const translatedRichTextData = lodashGet(
          storyContent,
          field.key.split(".")
        );

        lodashSet(
          storyContent,
          `${field.key}${isFolderLevel ? "" : i18nSuffix}`.split("."),
          translatedRichTextData
        );

        lodashSet(storyContent, field.key.split("."), field.fields);
      });

      // next just process the story

      if (props.mode === "createNew") {
        newStoryData = await SBManagementClient.post(
          `spaces/${SpaceInfo.spaceId}/stories/`,
          {
            story: {
              name: `${story.name} (${props.targetLanguageName})`,
              slug: `${story.slug}-${props.targetLanguageCode}`,
              content: storyContent,
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
              content: storyContent,
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
            content: storyContent,
            parent_id: story.parent_id,
          },
        };

        props.cb(newStoryData);
      }
    } catch (e) {
      console.error("Failed to localize the document", e);
      throw new Error("Failed to localize the document");
    } finally {
      inProgress = false;

      window.removeEventListener("message", handleMessage, false);
    }
  };

  window.addEventListener("message", handleMessage, false);

  window.parent.postMessage(
    {
      action: "tool-changed",
      tool: SpaceInfo.pluginName,
      event: "getContext",
    },
    "*"
  );
};
