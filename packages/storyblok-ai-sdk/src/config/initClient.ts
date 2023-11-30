import StoryblokClient from "storyblok-js-client";

let SBManagementClient: StoryblokClient | null = null;
let SBClient: StoryblokClient | null = null;

interface InitSDKProps {
  token: string;
  managementToken: string;
}

const configureClient = (props: InitSDKProps) => {
  SBManagementClient = new StoryblokClient({
    oauthToken: `Bearer ${props.managementToken}`,
  });
  SBClient = new StoryblokClient({
    accessToken: `${props.token}`,
  });

  SBClient.flushCache();
  SBManagementClient.flushCache();
};

export { SBManagementClient, SBClient, configureClient };
