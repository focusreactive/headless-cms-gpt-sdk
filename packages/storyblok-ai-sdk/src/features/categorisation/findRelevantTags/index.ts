import { ISbStoryData } from "storyblok-js-client";
import { SpaceInfo } from "../../../config/spaceData";
import { SBManagementClient } from "../../../config/initClient";
import { applyTags } from "@focus-reactive/content-ai-sdk";

interface Tag {
  id: string;
  title: string;
}

interface FindRelevantTagsProps {
  contentTitle: string;
  promptModifier?: string;
  cb: (summary: Tag[]) => void;
}

export const findRelevantTags = async (props: FindRelevantTagsProps) => {
  if (!SpaceInfo || !SBManagementClient) {
    throw new Error("SDK is not initialised");
  }

  const handleMessage = async (e: { data: { story: ISbStoryData } }) => {
    const story = e.data.story;
    let tags: Tag[] = [];

    if (!SpaceInfo || !SBManagementClient) {
      throw new Error("SDK is not initialised");
    }

    try {
      const existingTags = await SBManagementClient.get(
        `spaces/${SpaceInfo.spaceId}/tags/`
      );

      tags = await applyTags({
        content: story,
        promptModifier: `Do not work with technical fields. ${props.promptModifier}`,
        contentTitle: props.contentTitle,
        tags: existingTags.data.tags.map((tag: { name: string }) => ({
          title: tag.name,
          id: tag.name,
        })),
        resultAmount: 5,
      });
    } catch {
      throw new Error("Failed to apply tags");
    }

    props.cb(tags);

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
