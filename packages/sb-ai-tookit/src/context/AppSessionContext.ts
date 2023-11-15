import { AppSession } from '@storyblok/app-extension-auth'
import React from 'react'

export const AppSessionContext = React.createContext<AppSession | null>(null)
