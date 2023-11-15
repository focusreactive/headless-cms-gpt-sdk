import { summariseContent } from "focusreactive-ai-sdk";
import { getSpaceInfo } from "../../../config/spaceData";
import { ISbStoryData } from "storyblok-js-client";

interface SummariseStoryProps {
  contentTitle: string;
  promptModifier?: string;
  cb: (summary: string) => void;
}

export const summariseStory = (props: SummariseStoryProps) => {
  const spaceInfo = getSpaceInfo();

  if (!spaceInfo) {
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

    window.removeEventListener("message", handleMessage, false);
  };

  window.addEventListener("message", handleMessage, false);

  window.parent.postMessage(
    {
      action: "tool-changed",
      tool: spaceInfo.pluginName,
      event: "getContext",
    },
    "*"
  );
};
