import { SanityDocument } from "sanity";
import { summariseContent } from "content-ai-sdk";
import { getSanityClient } from "../../../config/sanityClient";

interface SummariseDocumentProps {
  documentId: string;
  contentTitle: string;
  promptModifier?: string;
}

export const summariseDocument = async (props: SummariseDocumentProps) => {
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
      const summary = await summariseContent({
        content: documentContent,
        promptModifier:
          "Do not work with technical fields of the data, they starts with a _ symbol. The content you provided with is a movie overview.",
        contentTitle: props.contentTitle,
      });

      return summary;
    } catch {
      throw new Error("Failed to summarise document");
    }
  } catch {
    throw new Error("Document not found");
  }
};
