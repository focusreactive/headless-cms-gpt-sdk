import { translateJSON } from "@focus-reactive/content-ai-sdk";
import { ISbStoryData } from "storyblok-js-client";

import { SpaceInfo } from "../../../config/spaceData";
import { SBManagementClient } from "../../../config/initClient";
import { flatten, unflatten } from "flat";

interface LocalizeStoryProps {
  targetLanguage: string;
  cb: (newStoryData: { story: ISbStoryData }) => void;
  promptModifier?: string;
  hasToCreateNewStory?: boolean;
}

export const localizeStory = (props: LocalizeStoryProps) => {
  if (!SpaceInfo) {
    throw new Error("SDK is not initialised");
  }

  const handleMessage = async (e: { data: { story: ISbStoryData } }) => {
    if (!SpaceInfo || !SBManagementClient) {
      throw new Error("SDK is not initialised");
    }

    const story = e.data.story;

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _editable, _uid, component, ...restContentToTranslate } =
        story.content;

      // we need to chunk the story data because of the API limitations
      // first step is to flatten the story data
      const flattenContent: { [key: string]: unknown } = flatten(
        restContentToTranslate
      );

      const textValueRegex = /\b\w+\s+\w+\b/g;
      const initialValue: { [key: string]: unknown } = {};

      const filteredTextFields = Object.keys(flattenContent as object).reduce(
        (acc, cur) => {
          const value = flattenContent[cur] as string;
          if (!value || typeof value?.match !== "function") return acc;
          const matches = value?.match(textValueRegex);

          if (matches && matches.length >= 1) {
            acc[cur] = value;
          }

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
            [item]: flattenContent[item],
          };
        }, {});
      });

      // then we need to translate each chunk
      const translatedChunks = await Promise.all(
        objectsChunks.map((chunk) =>
          translateJSON({
            targetLanguage: props.targetLanguage,
            content: chunk,
            promptModifier: `Examine each value within the JSON structure. Translate only the textual content within each value, while preserving the original JSON format. Refrain from translating any HTML tags, structures, and attributes embedded within these values. Important: Do not translate JSON keys! The keys and overall structure of the JSON must remain unchanged. ${
              props.promptModifier ? props.promptModifier : ""
            }`,
          }).then((translatedChunk) => flatten(JSON.parse(translatedChunk)))
        )
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

      // then simply create a story with the translated unflattened content
      let newStoryData: { story: ISbStoryData };
      if (props.hasToCreateNewStory) {
        newStoryData = await SBManagementClient.post(
          `spaces/${SpaceInfo.spaceId}/stories/`,
          {
            story: {
              name: `${story.name} (${props.targetLanguage})`,
              slug: `${story.slug}-${props.targetLanguage}`,
              content: {
                ...unflatten(localizedJSON),
                component,
              },
              parent_id: String(story.parent_id),
            },
            publish: 0,
          }
        );
      } else {
        newStoryData = {
          story: {
            ...story,
            name: `${story.name} (${props.targetLanguage})`,
            slug: `${story.slug}-${props.targetLanguage}`,
            content: {
              ...story.content,
              ...unflatten(localizedJSON),
            },
            parent_id: story.parent_id,
          },
        };
      }

      props.cb(newStoryData);
    } catch (e) {
      console.error("Failed to localize the document", e);
      throw new Error("Failed to localize the document");
    }

    window.removeEventListener("message", handleMessage, false);
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
