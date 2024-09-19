import { getContentfulClient } from '../../config/contentfulClient';

export default async function getLocales() {
  const contentfulClient = getContentfulClient();
  if (!contentfulClient) {
    throw new Error('Contentful client is not initialized');
  }

  const { items } = await contentfulClient.locale.getMany({});
  return items.map(item => ({ name: item.name, code: item.code, default: item.default }));
}
