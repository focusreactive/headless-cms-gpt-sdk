import { SanityClient } from "sanity";
import { initSanityClient } from "./sanityClient";
import { initSDK as configure } from "@focus-reactive/content-ai-sdk";

interface ConfigProps {
  client: SanityClient;
  openAiKey: string;
}

export const initSDK = (config: ConfigProps) => {
  initSanityClient(config.client);
  configure({ openAiToken: config.openAiKey });
};
