import { SanityClient } from "sanity";
import { translateJSON } from "@focus-reactive/content-ai-sdk";
import { flatten, unflatten } from "flat";

import { getSanityClient } from "../../../config/sanityClient";

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
  newDocumentConfig,
}: TranslateSelectedDocumentFieldsProps): Promise<{
  [key: string]: unknown;
}> => {
  const client = getSanityClient();
  if (!client) throw new Error("SDK not initialised");

  const document = await client.getDocument(documentId);
  if (!document) {
    throw new Error(`Document with id ${documentId} not found`);
  }

  const objectToTranslate = fieldNames.reduce((acc, fieldName) => {
    return { ...acc, [fieldName]: document[fieldName] };
  }, {});

  try {
    const flattenedObject = flatten(objectToTranslate) as Record<
      string,
      string
    >;

    const dataToTranslate = Object.keys(flattenedObject).reduce((acc, cur) => {
      if (
        typeof flattenedObject[cur] === "string" &&
        (flattenedObject[cur].split(" ").length > 1 ||
          (cur.split(".").pop() === "text" && cur.split(".").length > 3))
      ) {
        return { ...acc, [cur]: flattenedObject[cur] };
      }

      return acc;
    }, {});

    const translatedDocument = unflatten({
      ...flattenedObject,
      ...JSON.parse(
        await translateJSON({
          targetLanguage,
          content: dataToTranslate,
        })
      ),
    }) as Record<string, unknown>;

    if (newDocumentConfig) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...rest } = document;

      await client.create({
        ...rest,
        ...translatedDocument,
        [newDocumentConfig.titleFieldName]: `${
          document[newDocumentConfig.titleFieldName]
        } (${targetLanguage})`,
        ...newDocumentConfig.additionalFields,
      });
    }

    try {
      return translatedDocument;
    } catch {
      throw new Error("Failed to parse translated document");
    }
  } catch (error) {
    console.error(error);
    throw new Error("Failed to translate document");
  }
};
