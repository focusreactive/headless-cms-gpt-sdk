import {SanityClient, PatchOperations} from 'sanity'
import {ParsedDocumentField} from '../../../utils/parseDocumentFields'
import {translate} from 'focusreactive-ai-sdk'

export const translateFields = async (
  fields: ParsedDocumentField[],
  documentId: string,
  targetLanguage: string,
  client: SanityClient,
): Promise<void> => {
  const document = await client.getDocument(documentId)

  if (!document) {
    throw new Error(`Document with id ${documentId} not found`)
  }

  const promises = fields.map((field) => {
    return translate({targetLanguage, content: document[field.name]})
  })

  const result = await Promise.all(promises)

  const patchOperations: PatchOperations = {}
  result.forEach((translatedContent, index) => {
    patchOperations.set = {...patchOperations.set, [fields[index].name]: translatedContent}
  })

  await client.patch(documentId, patchOperations).commit()
}
