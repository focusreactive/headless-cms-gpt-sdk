import { getContentfulClient } from '@/config/contentfulClient';
import type { KeyValueMap } from '@/types';
import type { ContentTypeProps, EntryMetaSysProps, EntryProps, MetadataProps } from 'contentful-management';

type Entry = {
  fields: KeyValueMap;
  sys: EntryMetaSysProps;
  metadata?: MetadataProps;
};

export const getEntry = async (entryId: string) => {
  const client = getContentfulClient();
  if (!client) {
    throw new Error('Contentful client is not initialized');
  }

  const entry = await client.entry.get({ entryId });
  if (!entry) {
    throw new Error('Entry not found');
  }

  const schema = await client.contentType.get({
    contentTypeId: entry.sys.contentType.sys.id,
  });

  const { displayField, name } = schema;
  const locales = entry.fields[displayField] as KeyValueMap;
  const entryName = locales[Object.keys(locales)[0]] as string;

  return {
    id: entry.sys.id,
    name: entryName,

    contentType: {
      id: schema.sys.id,
      name,
      fields: schema.fields.map(field => ({
        id: field.id,
        name: field.name,
        type: field.type,
        localized: field.localized,
      })),
    },

    _entry: entry as EntryProps<KeyValueMap>,
    _schema: schema as ContentTypeProps,
  };
};

export const updateEntry = async (entry: { id: string } & Entry) => {
  const client = getContentfulClient();
  if (!client) {
    throw new Error('Contentful client is not initialized');
  }

  const { id, ...data } = entry;
  await client.entry.update({ entryId: entry.id }, data);
};

export const createEntry = async (contentTypeId: string, entry: Entry) => {
  const client = getContentfulClient();
  if (!client) {
    throw new Error('Contentful client is not initialized');
  }

  return await client.entry.create({ contentTypeId }, entry);
};
