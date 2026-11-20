// Dispatched synchronously on `window` by PreviewManager before it undoes
// any preview segments, with `detail.experiments` naming every experiment
// being unwound. The visual editor (a content script in another world,
// where `detail` may arrive as null) closes an open edit session in its
// listener, so the unwind sees the DOM the previews wrote and no session
// later restores nodes an unwound preview owned.
export const PREVIEW_UNWIND_EVENT = "absmartly:preview-unwind"

// Experiment name the visual editor previews its changes under.
export const VISUAL_EDITOR_EXPERIMENT_NAME = "__visual_editor__"
