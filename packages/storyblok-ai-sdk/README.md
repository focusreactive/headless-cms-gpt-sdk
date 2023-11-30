<div align="center">
	<a  href="https://focusreactive.com/"  align="center">
		<img  src="https://gitnation.imgix.net/stichting-frontend-amsterdam/image/upload/f_auto,c_scale,w_300/v1682673527/dev/focus_reactive__light_back_s7lhwa.png?auto=format"  alt="FocusReactive logo">
	</a>
	<h1 align="center">StoryBlok JavaScript OpenAI SDK</h1>
	<p align="center">This client is a thin wrapper for the OpeanAI API. A way to easely enchance your StoryBlok plugins with ready to use GPT functions</p>
</div>

## 🚀 Usage

### Install

```sh
yarn add storyblok-ai-sdk
```

### How to use it

#### Initialisation

```typescript
// 1. Import the configration function
import { initSDK } from "storyblok-ai-sdk";

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
import { findRelevantTags } from "storyblok-ai-sdk";

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
import { summariseStory } from "storyblok-ai-sdk";

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
