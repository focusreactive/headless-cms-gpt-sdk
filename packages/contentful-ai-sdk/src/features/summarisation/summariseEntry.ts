import { summariseContent } from '@focus-reactive/content-ai-sdk';
import { getContentfulClient } from '../../config/contentfulClient';

interface SummariseEntryProps {
  entryId: string;
  entryTitle: string;
}

export const summariseEntry = async (props: SummariseEntryProps) => {
  const contentfulClient = getContentfulClient();
  if (!contentfulClient) {
    throw new Error('Sanity client is not initialized');
  }

  const entryData = await contentfulClient.entry.get({
    entryId: props.entryId,
  });
  if (!entryData) {
    throw new Error('Entry not found');
  }

  const { fields } = entryData;
  try {
    const summary = await summariseContent({
      content: fields,
      promptModifier:
        'Do not work with technical fields of the data, they starts with a _ symbol. The content you provided with is a movie overview.',
      contentTitle: props.entryTitle,
    });

    return summary;
  } catch {
    throw new Error('Failed to summarise entry');
  }
};
