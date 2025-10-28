import { Storage } from '@plasmohq/storage'

const sessionStorage = new Storage({ area: 'session' })
const localStorage = new Storage({ area: 'local' })

export async function clearExperimentSessionStorage() {
  await Promise.all([
    sessionStorage.remove('domChangesInlineState'),
    sessionStorage.remove('elementPickerResult'),
    sessionStorage.remove('dragDropResult'),
    sessionStorage.remove('visualEditorChanges'),
    sessionStorage.remove('visualEditorState'),
  ])
}

export async function clearExperimentLocalStorage(experimentId: number) {
  await localStorage.remove(`experiment-${experimentId}-variants`)
}

export async function clearAllExperimentStorage(experimentId: number) {
  await Promise.all([
    clearExperimentSessionStorage(),
    clearExperimentLocalStorage(experimentId),
  ])
}

export async function clearVisualEditorSessionStorage() {
  await Promise.all([
    sessionStorage.remove('visualEditorState'),
    sessionStorage.remove('visualEditorChanges'),
  ])
}
