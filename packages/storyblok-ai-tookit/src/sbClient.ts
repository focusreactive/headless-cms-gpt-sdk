import StoryblokClient from 'storyblok-js-client'

let SBManagementClient: StoryblokClient | null = null

interface initClientProps {
  managementToken: string
  region: string
}

const configureClient = (props: initClientProps) => {
  SBManagementClient = new StoryblokClient({
    oauthToken: `${props.managementToken}`,
    region: props.region,
  })

  SBManagementClient.flushCache()
}

export { SBManagementClient, configureClient }
