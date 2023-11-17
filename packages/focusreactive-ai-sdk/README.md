<div align="center">
	<a  href="https://focusreactive.com/"  align="center">
		<img  src="https://gitnation.imgix.net/stichting-frontend-amsterdam/image/upload/f_auto,c_scale,w_300/v1682673527/dev/focus_reactive__light_back_s7lhwa.png?auto=format"  alt="FocusReactive logo">
	</a>
	<h1 align="center">Universal JavaScript OpenAI SDK</h1>
	<p align="center">This client is a thin wrapper for the OpeanAI API. A way to easely enchance your project with ready for use GPT functions</p>
</div>

## 🚀 Usage

### Install

```sh
yarn add focusreactive-ai-sdk
```

### How to use it

#### Initialisation

```javascript
// 1. Import the configration function
import { initSDK } from "focusreactive-ai-sdk";

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
}
```

- `targetLanguage` string - Result language
- `content` string - Text content that should be translated to the target language.

**Usage**

```javascript
// 1. Import the function
import { translate } from "focusreactive-ai-sdk";

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
}
```

- `targetLanguage` - Result language
- `content` - Text content that should be translated to the target language (JSON).
- `promptModifier` - Can be used to modify prompt. In some cases you may need to not translate some values or exlude some fields.

**Usage**

```javascript
// 1. Import the function
import { translateJSON } from "focusreactive-ai-sdk";

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
import { summariseContent } from "focusreactive-ai-sdk";

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

#### Function **`appplyTags`**

This function is created to logically tag content. Returns tags on order of relevance.

**Parameters**

```typescript
interface Tag {
  id: string;
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

**Usage**

```typescript
// 1. Import the function
import { appplyTags } from "focusreactive-ai-sdk";

// 2. Call the function
const tags = await appplyTags({
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
