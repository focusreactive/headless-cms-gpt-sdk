import OpenAI from "openai";

let openAiToken: string = "";

export const configurateOpenAi = (token: string) => {
  openAiToken = token;
};

export const getOpenAiClient = () => {
  return new OpenAI({
    apiKey: openAiToken,
    dangerouslyAllowBrowser: true,
  });
};
