import {ObjectSchemaType} from 'sanity'

export interface ParsedDocumentField {
  name: string
  type: string
  title: string | undefined
}

export const parseDocumentFields = (schema: ObjectSchemaType): ParsedDocumentField[] => {
  return schema.fields.map((field) => {
    return {
      name: field.name,
      type: field.type.name,
      title: field.type.title,
    }
  })
}
