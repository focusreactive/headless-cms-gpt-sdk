<a  href="https://focusreactive.com/"  align="center">
		<img width="25%" height="auto" src="https://cdn.sanity.io/images/vftxng62/production/25e191578a3c3d4ddfaf69c5f6f7070aead0bff4-507x168.png?auto=format"  alt="FocusReactive logo">
</a>

# Contentful AI SDK

## Installation

To add the SDK to your project, run the following command:

```sh
yarn add @focus-reactive/contentful-ai-sdk
```

## Usage

### Initialization

Before using the SDK, you must initialize it with the Contentful client and a valid OpenAI token.
In React apps, you can use the `useSDK` hook from the `@contentful/react-apps-toolkit` package:

```typescript
import type { SidebarAppSDK } from '@contentful/app-sdk'
import { useSDK } from '@contentful/react-apps-toolkit'
import { initSDK } from '@focus-reactive/contentful-ai-sdk'
import { useEffect } from 'react'

const LocationComponent = () => {
  const sdk = useSDK<SidebarAppSDK>()

  useEffect(() => {
    initSDK({ client: sdk.cma, openAiKey: process.env.REACT_APP_OPENAI_TOKEN! })
  }, [])

  return ...;
}

export default LocationComponent

```

Alternatively, you can directly initialize the client via `createClient` with your access token and pass it to the `initSDK` function.

### Using the SDK

```typescript
import type { SidebarAppSDK } from '@contentful/app-sdk'\
import { useSDK } from '@contentful/react-apps-toolkit'
import { Form } from '@contentful/f36-components'
import { localize } from '@focus-reactive/contentful-ai-sdk'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'

export default function Translate() {
  const sdk = useSDK<SidebarAppSDK>()
  const { handleSubmit } = useForm()

  const { mutate } = useMutation({
    mutationFn: localize,
  })

  const onSubmit = (values) => {
    mutate({
      targetLanguage: values.targetLanguage,
      translationLevel: values.translationLevel,
      entryId: sdk.entry.getSys().id,
      localEntryId: values.local,
      globalEntryId: values.global,
    })
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      ...
    </Form>
  )
}
```

## API

### **localize**

Translate the fields of an entry to the target language. The field values in the default locale will be used as the source. It can be used for both field-level and entry-level localizations.

#### **Parameters**

```typescript
type LocalizeFieldsProps = {
  translationLevel: 'field';
  targetLanguage: string;
  entryId: string;
};

type LocalizeEntryProps = {
  translationLevel: 'entry';
  targetLanguage: string;
  localEntryId: string;
  globalEntryId: string;
};

type LocalizeProps = LocalizeFieldsProps | LocalizeEntryProps;
```

- `targetLanguage` - language (or locale) to which you want to translate your entry. **Available locales must be configured in space settings.**
- `translationLevel` - which localization level to use.
  - `field` - add target localization to the current entry
     - `entryId` - ID of the entry that you want to translate.
  - `entry` -  create a new entry with translated values stored in the default locale and link the global entry (container) with the newly created entry
     - `localEntryId` - ID of the entry that will be used as a data source.
     - `globalEntryId` - ID of the entry that will be used as a container for the newly created entry.

#### **Return**

`Promise<void>`

### **resolveEntries**

Identify global and local entries based on whether a given entry refers to any other entries or is being referenced.

#### **Parameters**

- `entryId` - ID of the entry

#### **Return**

`{ global: RecognizedEntry; local: RecognizedEntry }`, where `RecognizedEntry` is an object with the following structure:

```typescript
type RecognizedEntry = {
  id: string;
  name: string;
  contentType: { id: string; name: string };
} | null
```

If entry is isolated (no references), `{ global: null, local: entry }` will be returned.

### **findTags**

Find the most relevant tags for the entry's content from the space's configured tags.

#### **Parameters**

- `entryId` - ID of the entry
- `contentTitle` - content title for more context

#### **Return**

An array of tags, where each tag is an object with the following structure:

```typescript
type Tag = {
  id: string
  title: string
}
```

### **applyTags**

Apply tags (with overwrite) to the given entry

#### **Parameters**

- `entryId` - ID of the entry
- `tags` - Array of objects with `id` property, where `id` is the ID of the tag

#### **Return**

`Promise<void>`
