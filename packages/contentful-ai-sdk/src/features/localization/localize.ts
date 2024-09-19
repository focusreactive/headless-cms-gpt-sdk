import getEntry from '../../core/queries/getEntry';
import { ContentTypeProps } from 'contentful-management';
import { deleteProperty, getProperty, setProperty, StopTraversalError, traverseObject } from './utils/traverse';
import { translateJSON } from '@focus-reactive/content-ai-sdk';
import getLocales from '../../core/queries/getLocales';
import { getContentfulClient } from '../../config/contentfulClient';

type LocalizeFieldsProps = {
  translationLevel: 'field';
  targetLanguage: string;
  entryId: string;
};

type LocalizeEntryProps = {
  translationLevel: 'entry';
  targetLanguage: string;
  localEntryId: string;
  globalEntryId: string;
};

type LocalizeProps = LocalizeFieldsProps | LocalizeEntryProps;

const localize = async (props: LocalizeProps) => {
  console.log('trigger', props);
  if (props.translationLevel === 'field') {
    return await localizeFields(props);
  }
  return await localizeEntry(props);
};

const localizeFields = async (props: LocalizeFieldsProps) => {
  const client = getContentfulClient();
  if (!client) {
    throw new Error('Contentful client is not initialized');
  }

  const translatedEntry = await translateEntryFields(props.entryId, props.targetLanguage);

  console.log('will update fields', JSON.stringify(translatedEntry._entry.fields));
  await client.entry.update({ entryId: translatedEntry.id }, translatedEntry._entry);
};

const localizeEntry = async (props: LocalizeEntryProps) => {
  const client = getContentfulClient();
  if (!client) {
    throw new Error('Contentful client is not initialized');
  }

  const translatedEntry = await translateEntryFields(props.localEntryId, props.targetLanguage, {
    replaceDefault: true,
    allFields: true,
  });

  console.log('will create entry', JSON.stringify(translatedEntry._entry.fields));
  const newEntry = await client.entry.create(
    { contentTypeId: translatedEntry.contentType.id },
    { fields: translatedEntry._entry.fields, metadata: translatedEntry._entry.metadata }
  );

  const [globalEntry, locales] = await Promise.all([getEntry(props.globalEntryId), getLocales()]);
  const targetLocale = locales.find(item => item.code === props.targetLanguage || item.name === props.targetLanguage)!;
  const translatableFields = getTranslatableFields(globalEntry._schema);

  let linkField = null;
  traverseObject(globalEntry._entry.fields, ({ key, path }) => {
    const shouldTranslate = !path.length && translatableFields.some(field => field.field === key);
    if (shouldTranslate) {
      linkField = key;
      throw new StopTraversalError();
    }
  });

  if (linkField) {
    setProperty(globalEntry._entry.fields, [linkField, targetLocale.code], {
      sys: { id: newEntry.sys.id, linkType: 'Entry', type: 'Link' },
    });
    console.log('will update global entry', JSON.stringify(globalEntry._entry.fields));
    await client.entry.update({ entryId: globalEntry.id }, globalEntry._entry);
  }
};

const translateEntryFields = async (
  entryId: string,
  targetLanguage: string,
  options: { replaceDefault?: boolean; allFields?: boolean } = {}
) => {
  const [entry, locales] = await Promise.all([getEntry(entryId), getLocales()]);

  const { _entry, _schema, defaultLocale } = entry;
  const targetLocale = locales.find(item => item.code === targetLanguage || item.name === targetLanguage)!;
  const translatableFields = getTranslatableFields(_schema);

  console.log('# before traversal', _entry.fields);
  const fieldsForTranslation: Array<[string, string]> = [];
  traverseObject(_entry.fields, ({ key, value, parent, path }) => {
    const shouldTranslate = !path.length && translatableFields.some(field => field.field === key);
    // skip non-translatable fields
    if (!options.allFields && !shouldTranslate) {
      console.log('skip translatable', path, key, options.allFields);
      return false;
    }
    // skip non-default locales
    if (locales.map(locale => locale.code).includes(key) && key !== defaultLocale.code) {
      console.log('skip default locale', key, locales);
      return false;
    }

    if (typeof value === 'string') {
      switch (key) {
        case defaultLocale.code:
          fieldsForTranslation.push([path.concat(key).join('.'), value]);
          return false;
        case 'value':
          if (parent.nodeType === 'text') {
            fieldsForTranslation.push([path.concat(key).join('.'), value]);
            return false;
          }
      }
    }
  });
  console.log('# after traverse', fieldsForTranslation);

  const optimized = fieldsForTranslation.map(([_path, value]) => value);
  console.log('# optimized', optimized);

  const translated: string[] = await translateJSON({
    targetLanguage: targetLocale.name,
    content: optimized,
  }).then(rawJson => JSON.parse(rawJson));

  console.log('# after translation', translated);
  const newFields = mergeFields({
    originalEntry: entry,
    targetLocale,
    translatedArray: translated,
    propertyIndex: fieldsForTranslation.map(([path]) => path),
    replaceDefault: options.replaceDefault,
  });

  return { ...entry, _entry: { ..._entry, fields: newFields } };
};

const getTranslatableFields = (schema: ContentTypeProps) => {
  return schema.fields.reduce(
    (translatable, field) => {
      if (field.localized) {
        translatable.push({ field: field.id, type: field.type.toLowerCase() });
      }
      return translatable;
    },
    [] as Array<{ field: string; type: string }>
  );
};

const mergeFields = ({
  originalEntry,
  translatedArray,
  propertyIndex,
  targetLocale,
  replaceDefault = false,
}: {
  originalEntry: Awaited<ReturnType<typeof getEntry>>;
  targetLocale: Awaited<ReturnType<typeof getLocales>>[number];
  translatedArray: string[];
  propertyIndex: string[];
  replaceDefault?: boolean;
}) => {
  const { _entry, defaultLocale } = originalEntry;

  const newFields = structuredClone(_entry.fields);

  propertyIndex.forEach((path, index) => {
    const propertiesPath = path.split('.');
    const localizedPropertiesPath = propertiesPath.map(property =>
      property.replace(defaultLocale.code, targetLocale.code)
    );

    const dataSchemaPath = propertiesPath.slice(0, propertiesPath.indexOf(defaultLocale.code) + 1);
    const dataSchema = getProperty(newFields, dataSchemaPath);

    const localizedDataSchemaPath = [...dataSchemaPath.slice(0, dataSchemaPath.length - 1), targetLocale.code];
    setProperty(newFields, localizedDataSchemaPath, structuredClone(dataSchema));

    setProperty(newFields, localizedPropertiesPath, translatedArray[index]);
    if (replaceDefault) {
      deleteProperty(newFields, dataSchemaPath);
    }
  });

  return newFields;
};

export default localize;
