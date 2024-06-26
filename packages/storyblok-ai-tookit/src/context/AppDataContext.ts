import React from 'react'
import { ISbStoryData } from 'storyblok-js-client'

export type language = {
  code: string
  name: string
}

export type Folder = { name: string; id: string; slug: string }

type AppData = {
  languages: language[]
  folders: Folder[]
  currentStory: ISbStoryData
  userId: number
  spaceId: number
}

export const AppDataContext = React.createContext<AppData | null>({
  folders: [],
  languages: [],
  currentStory: null,
  userId: null,
  spaceId: null,
})
