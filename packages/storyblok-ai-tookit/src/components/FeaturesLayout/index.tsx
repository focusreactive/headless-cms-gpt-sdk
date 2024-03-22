import React from 'react'
import { Button, ButtonGroup } from '@mui/material'
import Summary from '../Summary'
import Tags from '../Tags'
import Localization from '../Localization'

interface Feature {
  id: string
  title: string
  isDisabled: boolean
}

const FEATURES: Feature[] = [
  {
    id: 'localization',
    title: 'Localization',
    isDisabled: false,
  },
  {
    id: 'summary',
    title: 'Summary',
    isDisabled: false,
  },
  {
    id: 'tags',
    title: 'Tags',
    isDisabled: true,
  },
]

const FeaturesLayout = () => {
  const [activeFeature, setActiveFeature] = React.useState<string>(
    FEATURES[0].id,
  )

  return (
    <div>
      <ButtonGroup
        color="inherit"
        variant="contained"
        fullWidth
      >
        {FEATURES.map((feature) => (
          <Button
            key={feature.id}
            color={activeFeature === feature.id ? 'primary' : 'inherit'}
            onClick={() => {
              if (feature.isDisabled) return
              setActiveFeature(feature.id)
            }}
            size="small"
            disabled={feature.isDisabled}
          >
            {feature.title}
          </Button>
        ))}
      </ButtonGroup>
      {activeFeature === FEATURES[1].id && <Summary />}
      {activeFeature === FEATURES[0].id && <Localization />}
      {activeFeature === FEATURES[2].id && <Tags />}
    </div>
  )
}

export default FeaturesLayout
