import React from 'react'
import { Button, ButtonGroup } from '@mui/material'
import Summary from '../Summary'
import Tags from '../Tags'

interface Feature {
  id: string
  title: string
}

const FEATURES: Feature[] = [
  {
    id: 'summary',
    title: 'Summary',
  },
  {
    id: 'tags',
    title: 'Tags',
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
              setActiveFeature(feature.id)
            }}
            size="small"
          >
            {feature.title}
          </Button>
        ))}
      </ButtonGroup>
      {activeFeature === FEATURES[0].id && <Summary />}
      {activeFeature === FEATURES[1].id && <Tags />}
    </div>
  )
}

export default FeaturesLayout
