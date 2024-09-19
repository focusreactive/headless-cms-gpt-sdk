import { getContentfulClient } from '../../config/contentfulClient';
import getLocales from './getLocales';

export default async function getEntry(entryId: string) {
  const contentfulClient = getContentfulClient();
  if (!contentfulClient) {
    throw new Error('Contentful client is not initialized');
  }

  const [entry, locales] = await Promise.all([
    contentfulClient.entry.get({
      entryId: entryId,
    }),
    getLocales(),
  ]);
  if (!entry) {
    throw new Error('Entry not found');
  }

  const schema = await contentfulClient.contentType.get({
    contentTypeId: entry.sys.contentType.sys.id,
  });

  const { displayField, name } = schema;
  const defaultLocale = locales.find(item => item.default)!;
  const entryName = entry.fields[displayField][defaultLocale.code];

  return {
    id: entry.sys.id,
    name: entryName,
    contentType: { id: schema.sys.id, name },
    defaultLocale,

    _entry: entry,
    _schema: schema,
  };
}
