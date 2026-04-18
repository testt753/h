import { randomUUID } from 'crypto';

export function createRequestId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addSeconds(date: Date, seconds: number): string {
  return new Date(date.getTime() + seconds * 1000).toISOString();
}

export function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function mapMethodToAction(method: string): 'read' | 'write' | 'delete' {
  switch (method.toUpperCase()) {
    case 'DELETE':
      return 'delete';
    case 'POST':
    case 'PUT':
    case 'PATCH':
      return 'write';
    default:
      return 'read';
  }
}

export function normalizeTimeForPolicies(date = new Date()): string {
  return date.toISOString().slice(11, 16);
}
