import { getLocales } from '@/data/locale';
import { getProperty, setProperty } from './traverse';
import { KeyValueMap } from '@/types';

type Locale = Awaited<ReturnType<typeof getLocales>>[number];

export default function addLocalization({
  mode,
  fields,
  properties,
  defaultLocale,
  targetLocale,
}: {
  mode: 'add' | 'replace';
  fields: KeyValueMap;
  properties: [string, any][];
  targetLocale: Locale;
  defaultLocale: Locale;
}) {
  const newFields = structuredClone(fields);

  if (mode === 'add') {
    // duplicate default locale nested structure to safely modify it
    const uniqueLocalizedFields = new Set(
      properties.map(([path]) => path.slice(0, path.indexOf(defaultLocale.code) + defaultLocale.code.length))
    );
    uniqueLocalizedFields.forEach(path => {
      const propertiesPath = path.split('.');
      const localizedPath = [...propertiesPath.slice(0, propertiesPath.length - 1), targetLocale.code];

      const originalData = getProperty(newFields, propertiesPath);
      setProperty(newFields, localizedPath, structuredClone(originalData));
    });
  }

  properties.forEach(([path, value]) => {
    const setPath = mode === 'add' ? path.replace(defaultLocale.code, targetLocale.code).split('.') : path.split('.');
    // update either duplicated fields or existing ones
    setProperty(newFields, setPath, value);
  });

  return newFields;
}
