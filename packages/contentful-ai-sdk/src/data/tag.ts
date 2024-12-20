import { getContentfulClient } from '@/config/contentfulClient';
import type { TagProps } from 'contentful-management';

export const getTags = async () => {
  const client = getContentfulClient();
  if (!client) {
    throw new Error('Contentful client is not initialized');
  }

  let left = 0;
  const tags: TagProps[] = [];
  do {
    const { items, total } = await client.tag.getMany({ query: { skip: tags.length } });
    left = total - tags.length;
    tags.push(...items);
  } while (left > 0);

  return tags.map((t) => ({
    id: t.sys.id,
    title: t.name,
  }));
};
