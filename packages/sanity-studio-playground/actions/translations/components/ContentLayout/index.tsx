import React, {useState} from 'react'

import {FeatureName, FeaturesConfig} from '../../constants/featuresConfig'
import {ActionContext} from '../../context'
import {DocumentActionsContext} from 'sanity'
import {Card, Tab, TabList, TabPanel, ThemeProvider, studioTheme} from '@sanity/ui'

interface Props {
  documentSchema: DocumentActionsContext
  documentId: string
  onFeatureComplete: () => void
}

const ContentLayout: React.FC<Props> = ({documentSchema, documentId, onFeatureComplete}) => {
  const [activeFeatureName, setActiveFeatureName] = useState<FeatureName>(FeatureName.Translate)
  const activeFeature = FeaturesConfig.find((feature) => feature.name === activeFeatureName)
  const ActiveFeatureComponent = activeFeature?.component

  return (
    <ActionContext.Provider value={{documentSchema, documentId, onFeatureComplete}}>
      <ThemeProvider theme={studioTheme}>
        <Card padding={0}>
          <TabList space={2}>
            {FeaturesConfig.map((feature) => (
              <Tab
                key={feature.name}
                aria-controls={feature.name}
                id={feature.name}
                label={feature.title}
                onClick={() => setActiveFeatureName(feature.name)}
                selected={feature.name === activeFeatureName}
              />
            ))}
          </TabList>
        </Card>

        {activeFeatureName && ActiveFeatureComponent && (
          <TabPanel
            key={activeFeature.name}
            aria-labelledby={activeFeature.name}
            hidden={activeFeature.name !== activeFeatureName}
            id={activeFeature.name}
          >
            <Card border marginTop={2} padding={4} radius={2}>
              <ActiveFeatureComponent documentId={documentId} />
            </Card>
          </TabPanel>
        )}
      </ThemeProvider>
    </ActionContext.Provider>
  )
}

export default ContentLayout
