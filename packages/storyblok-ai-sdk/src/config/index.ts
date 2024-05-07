import { initSDK as configure } from "@focus-reactive/content-ai-sdk";
import { configureClient } from "./initClient";
import { configureSpaceInfo } from "./spaceData";

interface InitSDKProps {
  pluginName: string;
  managementToken: string;
  openAiToken: string;
  spaceId: string;
}

export const initSDK = (props: InitSDKProps) => {
  if (!props.pluginName || !props.openAiToken) {
    throw new Error("Missing required parameters");
  }

  configureSpaceInfo({ pluginName: props.pluginName, spaceId: props.spaceId });
  configureClient({
    managementToken: props.managementToken,
  });
  configure({ openAiToken: props.openAiToken });
};

export const TRANSLATION_MODES = ["selected", "all"];
export const TRANSLATION_LEVELS = ["field", "folder"];

export type TranslationModes = "selected" | "all";
export type TranslationLevels = "field" | "folder";

export type FolderTranslationData = {
  targetFolderId: number | string;
  translationMode: TranslationModes;
};
