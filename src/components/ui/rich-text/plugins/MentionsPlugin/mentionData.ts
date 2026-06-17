import { useEffect, useState } from "react"

import { BackgroundAPIClient } from "../../../../../lib/background-api-client"
import type { ExperimentMention } from "../../nodes/MentionNode/ExperimentMentionNode"
import { ExperimentType } from "../../nodes/MentionNode/ExperimentMentionNode"
import {
  mentionStore,
  type MentionTeam,
  type MentionUser
} from "../../nodes/mentionStore"

/**
 * Loads users + teams once, then writes them into the shared mentionStore so
 * the markdown transformers can resolve `[@user_id:N]` and `[@team_id:N]`.
 * In-memory cache prevents re-fetching across editor instances in the same
 * page lifetime.
 */
let usersAndTeamsCache: { users: MentionUser[]; teams: MentionTeam[] } | null =
  null
let usersAndTeamsPromise: Promise<{
  users: MentionUser[]
  teams: MentionTeam[]
}> | null = null

function loadUsersAndTeams(): Promise<{
  users: MentionUser[]
  teams: MentionTeam[]
}> {
  if (usersAndTeamsCache) return Promise.resolve(usersAndTeamsCache)
  if (usersAndTeamsPromise) return usersAndTeamsPromise

  // Guard for non-extension contexts (unit tests, prerender) where the
  // background bridge is unavailable.
  if (typeof chrome === "undefined" || !chrome?.runtime?.sendMessage) {
    return Promise.resolve({ users: [], teams: [] })
  }

  const api = new BackgroundAPIClient()
  usersAndTeamsPromise = Promise.all([api.getOwners(), api.getTeams()])
    .then(([rawUsers, rawTeams]) => {
      const users: MentionUser[] = rawUsers.map((u) => ({
        id: u.user_id,
        fullName:
          [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
          u.email ||
          `User ${u.user_id}`,
        email: u.email,
        avatarUrl: u.avatar?.base_url
      }))
      const teams: MentionTeam[] = rawTeams.map((t) => ({
        id: t.team_id,
        name: t.name,
        // Extension doesn't get colors from the API — derive a stable hue
        // from the id so the avatar circle is at least consistent per team.
        color: deriveColor(t.team_id),
        initials: t.name
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      }))
      usersAndTeamsCache = { users, teams }
      mentionStore.setUsers(users)
      mentionStore.setTeams(teams)
      return usersAndTeamsCache
    })
    .catch((err) => {
      usersAndTeamsPromise = null
      // eslint-disable-next-line no-console
      console.warn("[MentionsPlugin] failed to load users/teams:", err)
      return { users: [], teams: [] }
    })
  return usersAndTeamsPromise
}

function deriveColor(id: number): string {
  const hues = [
    "#1d4ed8",
    "#9333ea",
    "#16a34a",
    "#dc2626",
    "#ea580c",
    "#0891b2",
    "#db2777",
    "#65a30d"
  ]
  return hues[id % hues.length]
}

export interface UseMentionsResult {
  data: { users: MentionUser[]; teams: MentionTeam[] } | undefined
  isLoading: boolean
}

export function useMentionUsersAndTeams(): UseMentionsResult {
  const [data, setData] = useState<
    { users: MentionUser[]; teams: MentionTeam[] } | undefined
  >(usersAndTeamsCache ?? undefined)
  const [isLoading, setIsLoading] = useState(!usersAndTeamsCache)

  useEffect(() => {
    let alive = true
    if (data) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    loadUsersAndTeams().then((d) => {
      if (!alive) return
      setData(d)
      setIsLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  return { data, isLoading }
}

/**
 * Fetches experiments matching `search` (page-driven; called from the
 * ExperimentMentions plugin as the user scrolls / types). Independent of
 * the shared mentionStore — that store is hydrated separately for already
 * referenced experiment ids.
 */
export function fetchExperimentMentionsPage({
  search,
  page,
  items,
  signal
}: {
  search: string
  page: number
  items: number
  signal?: AbortSignal
}): Promise<{ experiments: ExperimentMention[]; total: number }> {
  if (typeof chrome === "undefined" || !chrome?.runtime?.sendMessage) {
    return Promise.resolve({ experiments: [], total: 0 })
  }
  const api = new BackgroundAPIClient()
  void signal // BackgroundAPIClient currently has no abort hook; treat as best-effort.
  return api
    .getExperiments({
      search,
      page,
      items,
      sort: "display_name",
      sort_asc: "true"
    })
    .then((res) => {
      const experiments = (res.experiments || []).map(toExperimentMention)
      return {
        experiments,
        total: typeof res.total === "number" ? res.total : experiments.length
      }
    })
}

function toExperimentMention(raw: any): ExperimentMention {
  const isFeature = raw?.type === 2 || raw?.type === "feature"
  return {
    id: typeof raw?.id === "number" ? raw.id : Number(raw?.id),
    name: raw?.name ?? "",
    display_name: raw?.display_name,
    iteration: typeof raw?.iteration === "number" ? raw.iteration : 1,
    type: isFeature ? ExperimentType.feature : ExperimentType.test,
    archived: !!raw?.archived
  }
}

/**
 * Look up the experiments referenced by id (from markdown) so the placeholder
 * mention nodes can resolve to real, clickable ones.
 */
export function loadExperimentMentionsByIds(
  ids: number[]
): Promise<ExperimentMention[]> {
  if (!ids.length) return Promise.resolve([])
  if (typeof chrome === "undefined" || !chrome?.runtime?.sendMessage) {
    return Promise.resolve([])
  }
  // The CLI endpoint does not support a `ids[]` filter directly in the
  // browser extension; fall back to per-id requests, which is fine because
  // mention ids in a doc are usually a small set.
  const api = new BackgroundAPIClient()
  return Promise.all(
    ids.map((id) =>
      api
        .makeRequest("GET", `/experiments/${id}`)
        .then((data: any) => {
          const exp = data?.experiment ?? data
          if (!exp) return null
          return toExperimentMention(exp)
        })
        .catch(() => null)
    )
  ).then((list) => list.filter((x): x is ExperimentMention => x !== null))
}
