import { configurateOpenAi } from "./openAi";

interface IConfig {
  openAiToken: string;
}

export const initSDK = (config: IConfig) => {
  configurateOpenAi(config.openAiToken);
};
