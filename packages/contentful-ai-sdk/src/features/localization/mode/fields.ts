import { getEntry, updateEntry } from '@/data/entry';
import { getLocales } from '@/data/locale';
import { traverseObject } from '../utils/traverse';
import { translateJSON } from '@focus-reactive/content-ai-sdk';
import addLocalization from '../utils/addLocalization';
import { ExtendedError } from '@/errors';

export default async function localizeFields({
  entryId,
  targetLanguage,
}: {
  entryId: string;
  targetLanguage: string;
}) {
  const [entry, locales] = await Promise.all([getEntry(entryId), getLocales()]);

  const defaultLocale = locales.find((item) => item.default)!;
  const targetLocale = locales.find(
    (item) => item.code === targetLanguage || item.name === targetLanguage
  )!;

  const translatableFields = entry.contentType.fields.filter((field) => field.localized);

  const {
    _entry: { fields },
  } = entry;
  const propertyIndex: Array<[string, string]> = [];

  // transform deeply nested entry object into property index (array of strings, where first element - path, second - value)
  // include localizable fields only
  traverseObject(fields, ({ key, value, parent, path }) => {
    if (path.length === 0 && !translatableFields.some((field) => field.id === key)) {
      return false;
    }

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
    mode: 'add',
    fields,
    properties: translatedPropertyIndex,
    defaultLocale: defaultLocale,
    targetLocale,
  });
  await updateEntry({ id: entryId, ...entry._entry, fields: newFields });
}
