import { createEntry, getEntry, updateEntry } from '@/data/entry';
import { getLocales } from '@/data/locale';
import { setProperty, traverseObject } from '../utils/traverse';
import { translateJSON } from '@focus-reactive/content-ai-sdk';
import addLocalization from '../utils/addLocalization';
import isGlobalEntry from '../utils/isGlobalEntry';
import { ExtendedError } from '@/errors';

export default async function localizeEntry({
  globalEntryId,
  localEntryId,
  targetLanguage,
}: {
  localEntryId: string;
  globalEntryId: string;
  targetLanguage: string;
}) {
  const [localEntry, locales] = await Promise.all([getEntry(localEntryId), getLocales()]);

  const defaultLocale = locales.find((item) => item.default)!;
  const targetLocale = locales.find(
    (item) => item.code === targetLanguage || item.name === targetLanguage
  )!;

  const {
    _entry: { fields },
  } = localEntry;
  const propertyIndex: Array<[string, string]> = [];

  // transform deeply nested entry object into property index (array of strings, where first element - path, second - value)
  traverseObject(fields, ({ key, value, parent, path }) => {
    if (path.length === 1 && key !== defaultLocale.code) {
      return false;
    }

    if (typeof value === 'string' && value) {
      switch (key) {
        case defaultLocale.code:
          propertyIndex.push([path.concat(key).join('.'), value]);
          return false;
        case 'value':
          if (parent.nodeType === 'text') {
            propertyIndex.push([path.concat(key).join('.'), value]);
            return false;
          }
      }
    }
  });

  const values = propertyIndex.map(([_path, value]) => value);

  const translatedValues: string[] = await translateJSON({
    targetLanguage: targetLocale.name,
    content: values,
  }).then((rawJson) => JSON.parse(rawJson));
  if (translatedValues.length !== values.length) {
    throw new ExtendedError(`Arrays lengths mismatch`, null, {
      original: values,
      translated: translatedValues,
    });
  }

  const translatedPropertyIndex = propertyIndex.map(
    ([path], index) => [path, translatedValues[index]] as [string, string]
  );

  const newFields = addLocalization({
    mode: 'replace',
    fields,
    properties: translatedPropertyIndex,
    defaultLocale,
    targetLocale,
  });
  const newLocalEntry = await createEntry(localEntry.contentType.id, {
    ...localEntry._entry,
    fields: newFields,
  });

  const globalEntry = await getEntry(globalEntryId);
  const { result: isGlobal, linkField } = isGlobalEntry(globalEntry);
  if (!(isGlobal && linkField)) {
    throw new Error('Entry is not recognized as global');
  }

  setProperty(globalEntry._entry.fields, [linkField.id, targetLocale.code], {
    sys: { type: 'Link', linkType: 'Entry', id: newLocalEntry.sys.id },
  });
  await updateEntry({ id: globalEntry.id, ...globalEntry._entry });
}
