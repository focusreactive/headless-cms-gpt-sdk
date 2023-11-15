import StoryblokClient from "storyblok-js-client";

let Storyblok: StoryblokClient | null = null;

export const getClient = () => {
  return Storyblok;
};

export const configureClient = (token: string) => {
  Storyblok = new StoryblokClient({
    oauthToken: token,
  });
};
