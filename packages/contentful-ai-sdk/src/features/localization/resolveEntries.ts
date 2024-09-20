import { getEntry } from '../../data/entry';
import { getContentfulClient } from '../../config/contentfulClient';
import isGlobalEntry from './utils/isGlobalEntry';

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
export default async function resolveEntries(
  entryId: string
): Promise<{ global: RecognizedEntry; local: RecognizedEntry; current: RecognizedEntry }> {
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
}
