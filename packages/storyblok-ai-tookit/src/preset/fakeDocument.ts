/** Seed data for the fake repository; it goes when the fake does. */
export const FAKE_DOCUMENT = {
  defaultId: 'sample-product',
  items: [
    {
      id: 'sample-product',
      name: 'Product pages',
      byLocale: {
        fr: {
          formality: 'formal',
          voice: [{ word: 'concise' }, { word: 'plain' }, { word: 'confident' }],
          instructions: 'Keep product names in English. Never translate the word Checkout.',
        },
        de: { formality: 'informal', voice: [{ word: 'warm' }] },
      },
    },
    {
      id: 'sample-legal',
      name: 'Legal',
      byLocale: {
        fr: { formality: 'formal', voice: [{ word: 'literal' }, { word: 'precise' }] },
      },
    },
  ],
}
