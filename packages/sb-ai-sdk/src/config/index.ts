import { initSDK as configure } from "focusreactive-ai-sdk";
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
