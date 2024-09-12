import { FeatureName, FeaturesConfig } from '../../constants/featuresConfig'
import { Card, Tabs } from '@contentful/f36-components'

const ContentLayout = () => {
  return (
    <Tabs defaultTab={FeatureName.Summary}>
      <Tabs.List>
        {FeaturesConfig.map((feature) => (
          <Tabs.Tab
            key={feature.name}
            aria-controls={feature.name}
            panelId={feature.name}
          >
            {feature.title}
          </Tabs.Tab>
        ))}
      </Tabs.List>

      {FeaturesConfig.map(({ name, component: Component }) => (
        <Tabs.Panel
          key={name}
          aria-controls={name}
          id={name}
        >
          <Card
            marginTop="spacingM"
            padding="default"
          >
            <Component />
          </Card>
        </Tabs.Panel>
      ))}
    </Tabs>
  )
}

export default ContentLayout
