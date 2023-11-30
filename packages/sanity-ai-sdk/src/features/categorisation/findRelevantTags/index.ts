import { SanityDocument } from "sanity";
import { appplyTags } from "content-ai-sdk";
import { getSanityClient } from "../../../config/sanityClient";

interface Tag {
  id: string;
  title: string;
  description?: string;
}

interface FindRelevantTagsProps {
  documentId: string;
  tags: Tag[];
  contentTitle: string;
}

export const findRelevantTags = async (props: FindRelevantTagsProps) => {
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
      const tags = await appplyTags({
        content: documentContent,
        promptModifier:
          "Do not work with technical fields of the data, they starts with a _ symbol.",
        tags: props.tags,
        contentTitle: props.contentTitle,
      });

      return tags;
    } catch {
      throw new Error("Something went wrong");
    }
  } catch {
    throw new Error("Document not found");
  }
};
