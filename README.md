<a  href="https://focusreactive.com/"  align="center">
		<img width="25%" height="auto" src="https://cdn.sanity.io/images/vftxng62/production/25e191578a3c3d4ddfaf69c5f6f7070aead0bff4-507x168.png?auto=format"  alt="FocusReactive logo">
</a>

# Headless CMS AI SDK playground

## Goal

The main idea of the project is to provide a set of tools for easy integration of the most common AI functions into any applications.

As an example of usage, we provide an extension of the functionality of two popular headless CMS - [Sanity](https://www.sanity.io/) and [StoryBlok](https://www.storyblok.com/) by implementing plugins that allow using AI functions within these headless CMS.

### StoryBlok plugin

Here is an example plugin that allows you to translate your stories into another language while preserving the data structure and formatting.

<img width="100%" height="auto" src="https://cdn.sanity.io/images/0xiy76wv/production/6a5c0dff22722d7caa6ddc5b16da790f1343a978-1200x574.gif?auto=format"  alt="FocusReactive logo">

In addition to this, the plugin is capable of working with tags and document summarization.

### Sanity plugin

Similar functionality is implemented for Sanity as well, using document actions.

<img width="100%" height="auto" src="https://cdn.sanity.io/images/0xiy76wv/production/7af405da1b8996acb7f9ebe88b48f418888a9b78-1200x1200.gif?auto=format"  alt="FocusReactive logo">

In addition to translations, this plugin also supports working with tags and document summarization, with the specific implementation depending on the Sanity API.

### Result

Both plugins are built on top of SDKs, which are created separately for StoryBlok and Sanity. Each SDK uses a root package that is not limited to any CMS and can be used in any project.

## Sanity Development

### Install

```sh
yarn
```

### ENV

Create `.env.local` inside sanity-studio-playground package, check the example in `.env.local.example`

### Run

```sh
yarn dev
```

## StoryBlok Development

### Install

```sh
yarn
```

Set up a secure tunnel to proxy your request to/from `localhost:3000`, for example with [ngrok](https://ngrok.com/):

```shell
yarn dev:ngrok
```

Note down your assigned URL; this will be your `baseUrl` for the application.

Create an app in Storyblok's Partner Portal and configure the following properties with the values derived from your `baseUrl`:

- **URL to your app**: `{baseUrl}`
- **OAuth2 callback URL**: `{baseUrl}/api/authenticate/storyblok/callback`

Rename the file `.env.local.example` to `.env.local`. Open the file and set the environmental variables:

- `CLIENT_ID`: the client id from the app settings page.
- `CLIENT_SECRET`: the client secret from the app settings page.
- `BASE_URL`: The `baseUrl` from your secure tunnel.
- `NEXT_PUBLIC_OPENAI_TOKEN`: OpenAI token.
- `NEXT_PUBLIC_SB_PREVIEW_TOKEN`: OpenAI token.

Start the application with the script from the root folder

```shell
yarn dev:sb
```
