import React from 'react'
import {DocumentActionsContext} from 'sanity'

const defaultValue: {
  documentSchema: DocumentActionsContext
  documentId: string
  onFeatureComplete: () => void
} | null = null

export const ActionContext = React.createContext<{
  documentSchema: DocumentActionsContext
  documentId: string
  onFeatureComplete: () => void
} | null>(defaultValue)
