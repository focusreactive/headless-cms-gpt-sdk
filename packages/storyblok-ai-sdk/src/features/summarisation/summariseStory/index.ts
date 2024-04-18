import { summariseContent } from "@focus-reactive/content-ai-sdk";
import { ISbStoryData } from "storyblok-js-client";
import { SpaceInfo } from "../../../config/spaceData";

interface SummariseStoryProps {
  contentTitle: string;
  promptModifier?: string;
  cb: (summary: string) => void;
}

export const summariseStory = (props: SummariseStoryProps) => {
  if (!SpaceInfo) {
    throw new Error("SDK is not initialised");
  }

  const handleMessage = async (e: { data: { story: ISbStoryData } }) => {
    const story = e.data.story;
    let summary = "";

    try {
      summary = await summariseContent({
        content: story,
        promptModifier: `Do not work with technical fields. ${props.promptModifier}`,
        contentTitle: props.contentTitle,
      });
    } catch {
      throw new Error("Failed to summarise document");
    }

    props.cb(summary);
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
