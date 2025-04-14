import { summariseContent } from "@focus-reactive/content-ai-sdk";
import { ISbStoryData } from "storyblok-js-client";
import { SpaceInfo } from "../../../config/spaceData";

interface SummariseStoryProps {
  contentTitle: string;
  promptModifier?: string;
  cb: (summary: string) => void;
}

export const summariseStory = async (props: SummariseStoryProps) => {
  if (!SpaceInfo) {
    return Promise.reject(new Error("SDK is not initialised"));
  }

  return new Promise((resolve, reject) => {
    const handleMessage = async (e: { data: { story: ISbStoryData } }) => {
      const story = e.data.story;

      try {
        const summary = await summariseContent({
          content: story,
          promptModifier: `Do not work with technical fields. ${props.promptModifier}`,
          contentTitle: props.contentTitle,
        });

        props.cb(summary);
        resolve("Success");
      } catch (err) {
        reject(new Error("Failed to summarise document"));
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
