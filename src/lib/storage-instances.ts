import { Storage } from "@plasmohq/storage"

export const storage = new Storage()

export const secureStorage = new Storage({
  area: "local",
  secretKeyring: true
} as any)

export const sessionStorage = new Storage({ area: "session" })
