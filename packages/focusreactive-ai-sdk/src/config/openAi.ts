import OpenAI from "openai";

let openAi: OpenAI | null = null;

export const configurateOpenAi = (token: string) => {
  openAi = new OpenAI({
    apiKey: token,
    dangerouslyAllowBrowser: true,
  });
};

export const getOpenAiClient = () => {
  return openAi;
};
