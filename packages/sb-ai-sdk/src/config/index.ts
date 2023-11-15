import { configurateOpenAi } from "focusreactive-ai-sdk";
import { configureClient } from "./initClient";
import { configureSpaceInfo } from "./spaceData";

interface InitSDKProps {
  pluginName: string;
  token: string;
  openAiToken: string;
}

export const initSDK = (props: InitSDKProps) => {
  if (!props.pluginName || !props.token || !props.openAiToken) {
    throw new Error("Missing required parameters");
  }

  configureSpaceInfo({ pluginName: props.pluginName });
  configureClient(props.token);
  configurateOpenAi(props.openAiToken);
};
