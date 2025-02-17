import { getEntry } from '@/data/entry';
import { EntryField } from '@/types';

/**
 * Determines if an entry is a globally translatable entry.
 * This function checks if any field in the entry is a localized link according to the content schema.
 *
 * @param entry - The entry to check.
 * @returns An object containing the result and the link field if applicable.
 */
export default function isGlobalEntry(entry: Awaited<ReturnType<typeof getEntry>>) {
  const {
    _entry: { fields },
    contentType: { fields: schemaFields },
  } = entry;

  for (const [id, locales] of Object.entries(fields) as [string, EntryField][]) {
    for (const [_locale, value] of Object.entries(locales)) {
      const isLink = typeof value === 'object' && 'sys' in value && value.sys.type === 'Link';
      const isLocalized = schemaFields.find(item => item.id === id)!.localized;
      if (isLink && isLocalized) {
        return { result: true, linkField: { id, value: value.sys.id } };
      }
    }
  }

  return { result: false, linkField: null };
}
