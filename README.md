<div align="center">
	<a  href="https://focusreactive.com/"  align="center">
		<img  src="https://gitnation.imgix.net/stichting-frontend-amsterdam/image/upload/f_auto,c_scale,w_300/v1682673527/dev/focus_reactive__light_back_s7lhwa.png?auto=format"  alt="FocusReactive logo">
	</a>
	<h1 align="center">Headless CMS AI SDK playground</h1>
</div>

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

* **URL to your app**: `{baseUrl}`
* **OAuth2 callback URL**: `{baseUrl}/api/authenticate/storyblok/callback`

Rename the file `.env.local.example` to `.env.local`. Open the file and set the environmental variables:

* `CLIENT_ID`: the client id from the app settings page.
* `CLIENT_SECRET`: the client secret from the app settings page.
* `BASE_URL`: The `baseUrl` from your secure tunnel.
* `NEXT_PUBLIC_SANITY_STUDIO_OPENAI_TOKEN`: OpenAI token.

Start the application with the script from the root folder

```shell
yarn dev:sb
```
