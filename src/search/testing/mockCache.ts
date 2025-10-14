import type { CacheEntry, CacheStore } from '../cache';

export class MemoryCacheStore implements CacheStore {
  private store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    return this.store.get(key) as CacheEntry<T> | undefined;
  }

  async set<T>(key: string, value: CacheEntry<T>): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
