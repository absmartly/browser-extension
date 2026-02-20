import { useState, useEffect } from 'react'
import type { Experiment } from '~src/types/absmartly'

interface UseTemplatesParams {
  getTemplates: (type: string) => Promise<Experiment[]>
  createPanelOpen: boolean
}

export function useTemplates({
  getTemplates,
  createPanelOpen
}: UseTemplatesParams) {
  const [templates, setTemplates] = useState<Experiment[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateSearchQuery, setTemplateSearchQuery] = useState("")

  useEffect(() => {
    if (createPanelOpen && templates.length === 0) {
      const loadTemplates = async () => {
        setTemplatesLoading(true)
        try {
          const data = await getTemplates('test_template')
          setTemplates(data)
        } catch (error) {
          console.error('Failed to load templates:', error)
          setTemplates([])
        } finally {
          setTemplatesLoading(false)
        }
      }
      loadTemplates()
    }
  }, [createPanelOpen, templates.length, getTemplates])

  return {
    templates,
    templatesLoading,
    templateSearchQuery,
    setTemplateSearchQuery
  }
}
