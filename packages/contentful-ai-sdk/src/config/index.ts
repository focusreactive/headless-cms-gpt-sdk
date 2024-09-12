import { initContentfulClient } from './contentfulClient';
import { initSDK as configure } from '@focus-reactive/content-ai-sdk';
import type { CMAClient } from '@contentful/app-sdk';

interface ConfigProps {
  client: CMAClient;
  openAiKey: string;
}

export const initSDK = (config: ConfigProps) => {
  initContentfulClient(config.client);
  configure({ openAiToken: config.openAiKey });
};
