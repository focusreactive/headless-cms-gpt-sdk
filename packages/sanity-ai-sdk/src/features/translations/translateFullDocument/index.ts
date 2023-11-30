import { SanityDocument } from "sanity";
import { getSanityClient } from "../../../config/sanityClient";
import { translateJSON } from "content-ai-sdk";

interface TranslateFullDocumentProps {
  documentId: string;
  targetLanguage: string;
}

export const translateFullDocument = async (
  props: TranslateFullDocumentProps
) => {
  const sanityClient = getSanityClient();
  if (!sanityClient) {
    throw new Error("Sanity client is not initialized");
  }

  try {
    const documentData: SanityDocument | undefined =
      await sanityClient.getDocument(props.documentId);

    if (!documentData) {
      throw new Error("Document not found");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _createdAt, _id, _rev, _type, _updatedAt, ...documentContent } =
      documentData;

    try {
      const translatedDocument = await translateJSON({
        targetLanguage: props.targetLanguage,
        content: documentContent,
        promptModifier:
          "Do not translate technical fields, they starts with a _ symbol. Translate only values with more than 1 word.",
      });

      try {
        return JSON.parse(translatedDocument);
      } catch {
        throw new Error("Failed to parse translated document");
      }
    } catch {
      throw new Error("Failed to translate document");
    }
  } catch {
    throw new Error("Document not found");
  }
};
