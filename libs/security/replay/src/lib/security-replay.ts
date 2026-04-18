export interface ReplayStore {
  has(key: string): Promise<boolean>;
  set(key: string, ttlSeconds: number): Promise<void>;
}

export class InMemoryReplayStore implements ReplayStore {
  private readonly store = new Map<string, number>();

  async has(key: string): Promise<boolean> {
    const expiresAt = this.store.get(key);
    if (!expiresAt) {
      return false;
    }

    if (expiresAt <= Date.now()) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  async set(key: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, Date.now() + ttlSeconds * 1000);
  }
}

export function buildReplayKey(ticketId: string, nonce: string): string {
  return `${ticketId}:${nonce}`;
}
