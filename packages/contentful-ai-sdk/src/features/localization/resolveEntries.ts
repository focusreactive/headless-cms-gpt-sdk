import { EntryField } from '../../types';
import getEntry from '../../core/queries/getEntry';
import { getContentfulClient } from '../../config/contentfulClient';

type RecognizedEntry = {
  id: string;
  name: string;
  contentType: { id: string; name: string };
};

/**
 * Identifies global, local, and current (currently focused) entries based on the given entry ID.
 * This approach uses separate local entries for each locale, while global entries reference these local entries.
 *
 * @param entryId - The ID of the entry to recognize.
 * @returns An object containing global, local, and current entry details.
 * @throws Will throw an error if no translatable entries can be recognized.
 */
const resolveEntries = async (
  entryId: string
): Promise<{ global: RecognizedEntry; local: RecognizedEntry; current: RecognizedEntry }> => {
  const entry = await getEntry(entryId);

  const { result: isGlobal, linkField } = isGlobalEntry(entry);
  if (isGlobal && linkField) {
    const referencedEntry = await getEntry(linkField.value);

    const global = { id: entry.id, name: entry.name, contentType: entry.contentType };
    const local = { id: referencedEntry.id, name: referencedEntry.name, contentType: referencedEntry.contentType };

    return { global, local, current: global };
  }

  const client = getContentfulClient()!;
  // TOOD: pagination
  const { items } = await client.entry.getMany({ query: { links_to_entry: entry.id } });
  for (const item of items) {
    const parentEntry = await getEntry(item.sys.id);
    const { result: isGlobal, linkField } = isGlobalEntry(parentEntry);

    if (isGlobal && linkField?.value === entry.id) {
      const global = { id: parentEntry.id, name: parentEntry.name, contentType: parentEntry.contentType };
      const local = { id: entry.id, name: entry.name, contentType: entry.contentType };

      return { global, local, current: local };
    }
  }

  throw new Error('Failed to recognize translatable entries');
};

/**
 * Determines if an entry is a globally translatable entry.
 * This function checks if any field in the entry is a localized link according to the content schema.
 *
 * @param entry - The entry to check.
 * @returns An object containing the result and the link field if applicable.
 */
const isGlobalEntry = (entry: Awaited<ReturnType<typeof getEntry>>) => {
  const {
    defaultLocale,
    _schema: { fields: schemaFields },
    _entry: { fields: entryFields },
  } = entry;

  for (const [id, locales] of Object.entries(entryFields) as [string, EntryField][]) {
    const _field = locales[defaultLocale.code];
    const isLink = typeof _field === 'object' && 'sys' in _field && _field.sys.type === 'Link';
    const isLocalized = schemaFields.find(item => item.id === id)!.localized;

    if (isLink && isLocalized) {
      return { result: true, linkField: { id, value: _field.sys.id } };
    }
  }

  return { result: false, linkField: null };
};

export default resolveEntries;
