import { getContentfulClient } from '@/config/contentfulClient';
import type { KeyValueMap } from '@/types';
import type {
  EntryMetaSysProps,
  MetadataProps,
  EntryProps,
  ContentTypeProps,
} from 'contentful-management';

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
      fields: schema.fields.map((field) => ({
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
  try {
    await client.entry.update({ entryId: entry.id }, data);
  } catch (error) {
    throw new EntryMutationError('Failed to update entry', entry.id, data, { cause: error });
  }
};

export const createEntry = async (contentTypeId: string, entry: Entry) => {
  const client = getContentfulClient();
  if (!client) {
    throw new Error('Contentful client is not initialized');
  }

  try {
    return await client.entry.create({ contentTypeId }, entry);
  } catch (error) {
    throw new EntryMutationError('Failed to create entry', contentTypeId, entry, error);
  }
};

export class EntryMutationError extends Error {
  id: string;
  data: any;

  constructor(message: string, entityId: string, data: any, cause: unknown) {
    super(message, { cause });

    this.id = entityId;
    this.data = data;
  }
}
