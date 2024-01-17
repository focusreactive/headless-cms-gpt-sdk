import { configurateOpenAi } from "./openAi";

interface IConfig {
  openAiToken: string;
}

export const initSDK = (config: IConfig) => {
  if (!config.openAiToken) {
    throw new Error("OpenAI token is required");
  }

  configurateOpenAi(config.openAiToken);
};
