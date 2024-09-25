import { getEntry, updateEntry } from '@/data/entry';

type ApplyTagsProps = {
  entryId: string;
  tags: { id: string }[];
};

export default async function applyTags(props: ApplyTagsProps) {
  const entry = await getEntry(props.entryId);

  const tags = props.tags.map(tag => ({ sys: { type: 'Link' as const, linkType: 'Tag' as const, id: tag.id } }));
  console.log('update entry', { id: entry.id, ...entry._entry, metadata: { ...entry._entry.metadata, tags } });
  await updateEntry({ id: entry.id, ...entry._entry, metadata: { ...entry._entry.metadata, tags } });
}
