/**
 * Runtime store for mention data the editor needs to resolve
 * `[@user_id:N]` / `[@team_id:N]` / `[#experiment_id:N]` tokens back into
 * displayable mention nodes when parsing markdown.
 *
 * The web app uses a global zustand store for this. The extension has no
 * such store, so we replicate the API with module-level state. Plugins
 * (MentionsPlugin, ExperimentMentionsPlugin) write into it via
 * `setMentionUsers / setMentionTeams / setMentionExperiments` after they
 * fetch from `BackgroundAPIClient`.
 *
 * The `*MentionNode.$get*` factory helpers read from this store at
 * `$convertFromMarkdownString` time.
 */

import type { ExperimentMention } from "./MentionNode/ExperimentMentionNode"

export interface MentionUser {
  id: number
  fullName: string
  email?: string
  avatarUrl?: string
}

export interface MentionTeam {
  id: number
  name: string
  color?: string
  initials?: string
}

interface MentionStore {
  users: MentionUser[]
  teams: MentionTeam[]
  experiments: ExperimentMention[]
}

const store: MentionStore = {
  users: [],
  teams: [],
  experiments: []
}

const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

export const mentionStore = {
  getUsers(): MentionUser[] {
    return store.users
  },
  getTeams(): MentionTeam[] {
    return store.teams
  },
  getExperiments(): ExperimentMention[] {
    return store.experiments
  },
  setUsers(users: MentionUser[]) {
    store.users = users
    notify()
  },
  setTeams(teams: MentionTeam[]) {
    store.teams = teams
    notify()
  },
  setExperiments(experiments: ExperimentMention[]) {
    store.experiments = experiments
    notify()
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }
}
