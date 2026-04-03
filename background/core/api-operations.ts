import type { APIClient } from "@absmartly/cli/api-client"
import { ExperimentId } from "@absmartly/cli/api-client"
import { debugLog, debugError } from "~src/utils/debug"

export type APIOperation =
  | { op: "listExperiments"; params?: Record<string, unknown> }
  | { op: "getExperiment"; id: number }
  | { op: "createExperiment"; data: Record<string, unknown> }
  | { op: "updateExperiment"; id: number; data: Record<string, unknown> }
  | { op: "startExperiment"; id: number }
  | { op: "stopExperiment"; id: number; reason?: string }
  | { op: "listApplications" }
  | { op: "listUnitTypes" }
  | { op: "listMetrics"; params?: Record<string, unknown> }
  | { op: "listExperimentTags" }
  | { op: "listUsers"; params?: Record<string, unknown> }
  | { op: "listTeams" }
  | { op: "listEnvironments" }
  | { op: "listCustomSectionFields" }
  | { op: "getCurrentUser" }
  | { op: "favoriteExperiment"; id: number; favorite: boolean }

export async function routeAPIOperation(
  client: APIClient,
  operation: APIOperation
): Promise<unknown> {
  debugLog("[APIRouter] Routing operation:", operation.op)

  switch (operation.op) {
    case "listExperiments": {
      return await client.listExperiments(operation.params as any)
    }

    case "getExperiment": {
      return await client.getExperiment(ExperimentId(operation.id))
    }

    case "createExperiment": {
      return await client.createExperiment(operation.data as any)
    }

    case "updateExperiment": {
      return await client.updateExperiment(
        ExperimentId(operation.id),
        operation.data as any
      )
    }

    case "startExperiment": {
      return await client.startExperiment(ExperimentId(operation.id))
    }

    case "stopExperiment": {
      return await client.stopExperiment(
        ExperimentId(operation.id),
        operation.reason || "stopped"
      )
    }

    case "listApplications": {
      return await client.listApplications()
    }

    case "listUnitTypes": {
      return await client.listUnitTypes()
    }

    case "listMetrics": {
      return await client.listMetrics(operation.params as any)
    }

    case "listExperimentTags": {
      return await client.listExperimentTags()
    }

    case "listUsers": {
      return await client.listUsers(operation.params as any)
    }

    case "listTeams": {
      return await client.listTeams()
    }

    case "listEnvironments": {
      return await client.listEnvironments()
    }

    case "listCustomSectionFields": {
      return await client.listCustomSectionFields()
    }

    case "getCurrentUser": {
      return await client.getCurrentUser()
    }

    case "favoriteExperiment": {
      return await client.favoriteExperiment(
        ExperimentId(operation.id),
        operation.favorite
      )
    }

    default: {
      const exhaustive: never = operation
      throw new Error(`Unknown API operation: ${(exhaustive as any).op}`)
    }
  }
}
