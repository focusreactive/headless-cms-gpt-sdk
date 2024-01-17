<a  href="https://focusreactive.com/"  align="center">
		<img width="25%" height="auto" src="https://cdn.sanity.io/images/vftxng62/production/25e191578a3c3d4ddfaf69c5f6f7070aead0bff4-507x168.png?auto=format"  alt="FocusReactive logo">
</a>

# Content AI SDK

## 🚀 Usage

### Install

```sh
yarn add @focus-reactive/content-ai-sdk
```

### How to use it

#### Initialisation

```javascript
// 1. Import the configration function
import { initSDK } from "@focus-reactive/content-ai-sdk";

// 2. Initialize the SDK with the OpenAI token
initSDK({ openAiToken: OPEN_AI_TOKEN });
```

## Documentation

### Translations

We implemented several features that you can use in your projects to work with localisations.

#### Function **`translate`**

**Parameters**

```typescript
interface TranslateOptions {
  targetLanguage: string;
  content: string;
  currentLanguage?: string;
  promptModifier?: string;
}
```

- `targetLanguage` string - Result language
- `content` string - Text content that should be translated to the target language.
- `currentLanguage` string - Current language of the content. If not provided, the language will be detected automatically.
- `promptModifier` string - Can be used to modify prompt.

**Usage**

```javascript
// 1. Import the function
import { translate } from "@focus-reactive/content-ai-sdk";

// 2. Call the function
const deContent = await translate({
  content: "Hey! Now I can manage german content",
  targetLanguage: "german",
});
```

#### Function **`translateJSON`**

This function is created to translate JSON objects to a different language without changing it's structure.

**Parameters**

```typescript
interface TranslateOptions {
  targetLanguage: string;
  content: unknown;
  promptModifier?: string;
  currentLanguage?: string;
}
```

- `targetLanguage` - Result language
- `content` - Text content that should be translated to the target language (JSON).
- `promptModifier` - Can be used to modify prompt. In some cases you may need to not translate some values or exlude some fields.
- `currentLanguage` - Current language of the content. If not provided, the language will be detected automatically.

**Usage**

```javascript
// 1. Import the function
import { translateJSON } from "@focus-reactive/content-ai-sdk";

// 2. Call the function
const deContent = await translateJSON({
  content: JSON.stringify({
    title: "Batman 2",
    description: "Superhero movie",
  }),
  targetLanguage: "german",
  promptModifier:
    "Do not translate technical fields, they starts with a _ symbol. Translate only values with more than 1 word.",
});
```

### Summarisation

#### Function **`summariseContent`**

This function is created to be able to create a sammury of a content. Works with string and JSON objects.

**Parameters**

```typescript
interface SummariseContentProps {
  content: unknown;
  contentTitle: string;
  promptModifier?: string;
}
```

- `contentTitle` - Content title. This is a required field that sets the logical context for the provided content.
- `content` JSON | string - Text content that will be summarised. (JSON | string)
- `promptModifier` - Can be used to modify prompt.

**Usage**

```typescript
// 1. Import the function
import { summariseContent } from "@focus-reactive/content-ai-sdk";

// 2. Call the function
const summary = await summariseContent({
  contentTitle: "Batman movie overview.",
  content: JSON.stringify({
    title: "Batman",
    description: "Superhero movie",
  }),
  promptModifier: "Make sure that the summary is not longer than 3 sentences.",
});
```

### Categotisation

#### Function **`applyTags`**

This function is created to logically tag content. Returns tags on order of relevance.

**Parameters**

```typescript
interface Tag {
  id: string | number;
  title: string;
  description?: string;
}

interface AppplyTagsProps {
  content: unknown;
  contentTitle: string;
  promptModifier?: string;
  resultAmount?: number;
  tags: Tag[];
}
```

- `contentTitle`- Content title. Sets the logical context for the provided content.
- `content` - Text contentf for tagging. (JSON | string)
- `promptModifier` - Can be used to modify prompt.
- `resultAmount` - Amount of tags that should be returned.
- `tags` - Array of tags that should be used for tagging.

**Usage**

```typescript
// 1. Import the function
import { applyTags } from "@focus-reactive/content-ai-sdk";

// 2. Call the function
const tags = await applyTags({
  contentTitle: "Batman movie overview.",
  content: JSON.stringify({
    title: "Batman",
    description: "Superhero movie",
  }),
  tags: [] as Tag[],
  resultAmount: 5,
  promptModifier: "Make sure that the summary is not longer than 3 sentences.",
});
```
