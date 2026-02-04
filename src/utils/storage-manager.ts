import { Storage } from '@plasmohq/storage'

export enum StorageTier {
  TRANSIENT = 'transient',
  SESSION = 'session',
  PERSISTENT = 'persistent',
  SECURE = 'secure'
}

export class StorageManager {
  private static instance: StorageManager
  private transientStore: Map<string, any> = new Map()
  private sessionStore: Storage
  private persistentStore: Storage
  private secureStore: Storage

  private constructor() {
    this.sessionStore = new Storage({ area: 'session' })
    this.persistentStore = new Storage({ area: 'local' })
    this.secureStore = new Storage({
      area: 'local',
      secretKeyring: true
    } as any)
  }

  static getInstance(): StorageManager {
    if (!this.instance) {
      this.instance = new StorageManager()
    }
    return this.instance
  }

  async get(key: string, tier: StorageTier = StorageTier.PERSISTENT): Promise<any> {
    switch (tier) {
      case StorageTier.TRANSIENT:
        return this.transientStore.get(key)
      case StorageTier.SESSION:
        return await this.sessionStore.get(key)
      case StorageTier.SECURE:
        return await this.secureStore.get(key)
      case StorageTier.PERSISTENT:
      default:
        return await this.persistentStore.get(key)
    }
  }

  async set(key: string, value: any, tier: StorageTier = StorageTier.PERSISTENT): Promise<void> {
    switch (tier) {
      case StorageTier.TRANSIENT:
        this.transientStore.set(key, value)
        break
      case StorageTier.SESSION:
        await this.sessionStore.set(key, value)
        break
      case StorageTier.SECURE:
        await this.secureStore.set(key, value)
        break
      case StorageTier.PERSISTENT:
      default:
        await this.persistentStore.set(key, value)
        break
    }
  }

  async remove(key: string, tier: StorageTier = StorageTier.PERSISTENT): Promise<void> {
    switch (tier) {
      case StorageTier.TRANSIENT:
        this.transientStore.delete(key)
        break
      case StorageTier.SESSION:
        await this.sessionStore.remove(key)
        break
      case StorageTier.SECURE:
        await this.secureStore.remove(key)
        break
      case StorageTier.PERSISTENT:
      default:
        await this.persistentStore.remove(key)
        break
    }
  }

  clearTransient(): void {
    this.transientStore.clear()
  }
}

export const storageManager = StorageManager.getInstance()
