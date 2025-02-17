import { getEntry } from '@/data/entry';
import { getTags } from '@/data/tag';
import { applyTags } from '@focus-reactive/content-ai-sdk';

type CategorizeProps = {
  entryId: string;
  contentTitle?: string;
};

export default async function findTags(props: CategorizeProps) {
  const [entry, existingTags] = await Promise.all([getEntry(props.entryId), getTags()]);

  const tags = await applyTags({
    content: entry._entry.fields,
    contentTitle: props.contentTitle ?? entry.name,
    tags: existingTags,
    promptModifier: 'Do not work with technical fields of the data like `nodeType`.',
  });

  return tags as typeof existingTags;
}
