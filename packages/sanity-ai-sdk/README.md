<div align="center">
	<a  href="https://focusreactive.com/"  align="center">
		<img  src="https://gitnation.imgix.net/stichting-frontend-amsterdam/image/upload/f_auto,c_scale,w_300/v1682673527/dev/focus_reactive__light_back_s7lhwa.png?auto=format"  alt="FocusReactive logo">
	</a>
	<h1 align="center">Sanity JavaScript OpenAI SDK</h1>
	<p align="center">This client is a thin wrapper for the OpeanAI API. A way to easely enchance your studio with ready for use GPT functions</p>
</div>

## 🚀 Usage

### Install

```sh
yarn add sanity-ai-sdk
```

### How to use it

#### Initialisation

```typescript
// 1. Import the configration function
import { initSDK } from "focusreactive-ai-sdk";
import { SanityClient } from "sanity";

interface IConfig {
  client: SanityClient;
  openAiKey: string;
}

const config: IConfig = {
  client: new SanityClient(),
  openAiKey: YOUR_OPENAI_KEY,
};

// 2. Initialize the SDK with the OpenAI token
initSDK(config);
```

## Documentation

### Translations

We implemented several features that you can use in your projects to work with localisations.

#### Function **`transalateSelectedDocumentFields`**

**Parameters**

```typescript
interface TranslateSelectedDocumentFieldsProps {
  fieldNames: string[];
  documentId: string;
  targetLanguage: string;
  newDocumentConfig?: NewDocumentprops;
}

interface NewDocumentprops {
  titleFieldName: string;
  additionalFields?: Record<string, unknown>;
}
```

- `fieldNames` - Array of field names that should be translated. Should match the document schema. Can with any type of content (string, JSON, etc.)
- `documentId` - Id of the document that we need to process.
- `targetLanguage` - Language to which we need to translate the content.
- `newDocumentConfig` - Optional. If you want to create a new document with the translated content, you can pass the config here.
- `titleFieldName` - Field that should be used to create a new document title based on it's value.
- `additionalFields` - Optional. Additional fields that should be added to the new document.

**Usage**

```javascript
// 1. Import the function
import { transalateSelectedDocumentFields } from "sanity-ai-sdk";

// 2. Call the function
const translatedFileds = await transalateSelectedDocumentFields({
  fieldNames: ["movieTitle", "description", "actors"],
  targetLanguage: "german",
  documentId: DOCUMENT_ID,
});
```

#### Function **`translateFullDocument`**

**Parameters**

```typescript
interface TranslateFullDocumentProps {
  documentId: string;
  targetLanguage: string;
}
```

- `documentId` - Id of the document that we need to process.
- `targetLanguage` - Language to which we need to translate the content.

**Usage**

```javascript
// 1. Import the function
import { translateFullDocument } from "sanity-ai-sdk";

// 2. Call the function
const translatedDocument = await translateFullDocument({
  targetLanguage: "german",
  documentId: DOCUMENT_ID,
});
```

### Categorisation

#### Function **`findRelevantTags`**

**Parameters**

```typescript
interface FindRelevantTagsProps {
  documentId: string;
  tags: Tag[];
  contentTitle: string;
}

interface Tag {
  id: string;
  title: string;
  description?: string;
}
```

- `documentId` - Id of the document that we need to process.
- `tags` - Array of tags that should be used to categorise the document.
- `contentTitle` - Title of the document that should be used to set a logical context.

**Usage**

```javascript
// 1. Import the function
import { findRelevantTags } from "sanity-ai-sdk";

// 2. Call the function
const result = await findRelevantTags({
  documentId: "documentId",
  contentTitle: "Batman movie",
  tags: [],
});
```

### Summarisation

#### Function **`summariseDocument`**

**Parameters**

```typescript
interface SummariseDocumentProps {
  documentId: string;
  contentTitle: string;
  promptModifier?: string;
}
```

- `documentId` - Id of the document that we need to process.
- `tags` - Array of tags that should be used to categorise the document.
- `promptModifier` - Optional. If you want to a modifier to the prompt, you can pass the modifier here.

**Usage**

```javascript
// 1. Import the function
import { summariseDocument } from "sanity-ai-sdk";

// 2. Call the function
const result = await summariseDocument({
  documentId: "documentId",
  contentTitle: "Batman movie",
});
```
