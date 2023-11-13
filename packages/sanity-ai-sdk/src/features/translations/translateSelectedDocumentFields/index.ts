import { SanityClient } from "sanity";
import { translateJSON } from "focusreactive-ai-sdk";

interface NewDocumentprops {
  titleFieldName: string;
  additionalFields?: Record<string, unknown>;
}

interface TranslateSelectedDocumentFieldsProps {
  fieldNames: string[];
  documentId: string;
  targetLanguage: string;
  client: SanityClient;
  newDocumentConfig?: NewDocumentprops;
}

export const transalateSelectedDocumentFields = async ({
  fieldNames,
  documentId,
  targetLanguage,
  client,
  newDocumentConfig,
}: TranslateSelectedDocumentFieldsProps): Promise<void> => {
  const document = await client.getDocument(documentId);
  if (!document) {
    throw new Error(`Document with id ${documentId} not found`);
  }

  const objectToTranslate = fieldNames.reduce((acc, fieldName) => {
    return { ...acc, [fieldName]: document[fieldName] };
  }, {});

  try {
    const translatedDocument = await translateJSON({
      targetLanguage,
      content: objectToTranslate,
      promptModifier:
        "Do not translate technical fields, they starts with a _ symbol. Translate only values with more than 1 word.",
    });

    if (newDocumentConfig) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...rest } = document;

      await client.create({
        ...rest,
        ...JSON.parse(translatedDocument),
        [newDocumentConfig.titleFieldName]: `${
          document[newDocumentConfig.titleFieldName]
        } (${targetLanguage})`,
        ...newDocumentConfig.additionalFields,
      });
    }

    try {
      return JSON.parse(translatedDocument);
    } catch {
      throw new Error("Failed to parse translated document");
    }
  } catch {
    throw new Error("Failed to translate document");
  }
};
