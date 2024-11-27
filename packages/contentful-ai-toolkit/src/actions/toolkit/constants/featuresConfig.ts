import * as React from 'react'
import Translate from '../components/Translate'
import Tags from '../components/Tags'
import Summary from '../components/Summary'

export enum FeatureName {
  Translate = 'Translate',
  Tags = 'Tags',
  Summary = 'Summary',
}

interface BaseFeatureConfig {
  name: FeatureName
  title: string
  component: React.FunctionComponent
}

export const FeaturesConfig: BaseFeatureConfig[] = [
  {
    name: FeatureName.Translate,
    title: 'Translate',
    component: Translate,
  },
  {
    name: FeatureName.Tags,
    title: 'Tags',
    component: Tags,
  },
  {
    name: FeatureName.Summary,
    title: 'Summary',
    component: Summary,
  },
]
