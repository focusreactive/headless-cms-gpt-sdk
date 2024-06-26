<a  href="https://focusreactive.com/"  align="center">
		<img width="25%" height="auto" src="https://cdn.sanity.io/images/vftxng62/production/25e191578a3c3d4ddfaf69c5f6f7070aead0bff4-507x168.png?auto=format"  alt="FocusReactive logo">
</a>

# StoryBlok AI SDK

## 🚀 Usage

### Install

```sh
yarn add @focus-reactive/storyblok-ai-sdk
```

### How to use it

#### Initialisation

```typescript
// 1. Import the configration function
import { initSDK } from "@focus-reactive/storyblok-ai-sdk";

interface InitSDKProps {
  pluginName: string;
  token: string;
  managementToken: string;
  openAiToken: string;
  spaceId: string;
}

// 2. Initialize the SDK with the OpenAI token
initSDK({
  pluginName: "my-plugin",
  token: YOUR_TOKEN,
  managementToken: YOUR_MANAGEMENT_TOKEN,
  openAiToken: YOUR_OPENAI_TOKEN,
  spaceId: YOUR_SPACE_ID,
});
```

## Documentation

### Localization

We implemented localization functions that can be used to translate your stories.

#### Function **`localizeStory`**

**Parameters**

```typescript
type TranslationModes = "selected" | "all";
type TranslationLevels = "field" | "folder";

type FolderTranslationData = {
  targetFolderId: number | string;
  translationMode: TranslationModes;
};

interface LocalizeStoryProps {
  targetLanguageCode: string;
  targetLanguageName: string;
  cb: (newStoryData: { story: ISbStoryData }) => void;
  promptModifier?: string;
  translationLevel: TranslationLevels;
  folderLevelTranslation: FolderTranslationData;
}
```

- `targetLanguage` - Language to which you want to translate your story.
- `cb` - Callback function that will be called with the result.
- `hasToCreateNewStory` - Optional. If you want to create a new story, you can pass `true` here.
- `promptModifier` - Optional. If you want to add some instructions to the prompt, you can pass the modifier here.
- `translationLevel` - Can be a `field` or a `folder`. When `field` will perform field-level translation for the current story. When `folder`, translation will be done at the folder level. [Storyblok Internationalization docs](https://www.storyblok.com/docs/guide/in-depth/internationalization).
- `folderLevelTranslation` - Data required for folder level translation: `targetFolderId` and `translationMode`. Where `translationMode` can have two options: `selected` and the`all`. When using the `selected` option, only text fields that are explicitly marked as translatable will be processed. Using `all` will translate all text fields regardless of the translatable flag.

**Usage**

```javascript
// 1. Import the function
import { localizeStory } from "@focus-reactive/storyblok-ai-sdk";

// 2. Call the function
const localizedStory = localizeStory({
  translationLevel,
  targetLanguageCode,
  targetLanguageName,
  folderLevelTranslation,
  cb: (localizedStory) => {
    setIsLoading(false); // turn off the loading indicator
    console.log(localizedStory);
  },
});
```

### Categorisation

We implemented categorisation functions that can be used to categorise documents based on their content.

#### Function **`findRelevantTags`**

**Parameters**

```typescript
interface Tag {
  id: string;
  title: string;
}

interface FindRelevantTagsProps {
  contentTitle: string;
  promptModifier?: string;
  cb: (summary: Tag[]) => void;
}
```

- `contentTitle` - Title of the content that we need to process. We use it to set a logical context.
- `promptModifier` - Optional. If you want to add some instructions to the prompt, you can pass the modifier here.
- `cb` - Callback function that will be called with the result.

**Usage**

```javascript
// 1. Import the function
import { findRelevantTags } from "@focus-reactive/storyblok-ai-sdk";

// 2. Call the function
findRelevantTags({ contentTitle, cb: (tags) => setTags(tags) });
```

#### Function **`summariseStory`**

**Parameters**

```typescript
interface SummariseStoryProps {
  contentTitle: string;
  promptModifier?: string;
  cb: (summary: string) => void;
}
```

- `contentTitle` - Title of the content that we need to process. We use it to set a logical context.
- `promptModifier` - Optional. If you want to add some instructions to the prompt, you can pass the modifier here.
- `cb` - Callback function that will be called with the result.

**Usage**

```javascript
// 1. Import the function
import { summariseStory } from "@focus-reactive/storyblok-ai-sdk";

// 2. Call the function
summariseStory({
  contentTitle: "My content title",
  promptModifier:
    "Provided content is a website page. Summary should be short and concise.",
  cb: (summary) => {
    setSummary(summary);
  },
});
```
