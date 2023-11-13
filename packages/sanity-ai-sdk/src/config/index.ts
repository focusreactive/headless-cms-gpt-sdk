import { SanityClient } from "sanity";
import { initSanityClient } from "./sanityClient";
import { configurateOpenAi } from "focusreactive-ai-sdk";

interface ConfigProps {
  client: SanityClient;
  openAiKey: string;
}

export const initSDK = (config: ConfigProps) => {
  initSanityClient(config.client);
  configurateOpenAi(config.openAiKey);
};
