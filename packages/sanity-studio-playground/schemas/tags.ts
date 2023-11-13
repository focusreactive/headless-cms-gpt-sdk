import {defineField, defineType} from 'sanity'
import {IoMdPricetag as icon} from 'react-icons/io'

export default defineType({
  name: 'tag',
  title: 'Tag',
  type: 'document',
  icon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'string',
    }),
  ],
})
