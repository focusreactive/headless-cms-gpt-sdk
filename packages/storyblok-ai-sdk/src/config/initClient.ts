import StoryblokClient from "storyblok-js-client";

let SBManagementClient: StoryblokClient | null = null;

interface InitSDKProps {
  managementToken: string;
}

const configureClient = (props: InitSDKProps) => {
  SBManagementClient = new StoryblokClient({
    oauthToken: `Bearer ${props.managementToken}`,
  });

  SBManagementClient.flushCache();
};

export { SBManagementClient, configureClient };
