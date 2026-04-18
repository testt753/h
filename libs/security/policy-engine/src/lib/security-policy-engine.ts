import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import type { AuthorizationRequest, PolicyCondition, PolicyRule } from 'shared-contracts';

function resolveField(request: AuthorizationRequest, field: string): unknown {
  return field.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, {
    user: request.subject,
    subject: request.subject,
    resource: request.resource,
    environment: request.environment,
    request: request.environment,
  });
}

function evaluateCondition(request: AuthorizationRequest, condition: PolicyCondition): boolean {
  const currentValue = resolveField(request, condition.field);

  switch (condition.operator) {
    case 'eq':
      return currentValue === condition.value;
    case 'neq':
      return currentValue !== condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(String(currentValue));
    case 'includes':
      return Array.isArray(currentValue) && currentValue.includes(condition.value as never);
    case 'betweenTime': {
      if (!Array.isArray(condition.value) || typeof currentValue !== 'string') {
        return false;
      }

      const [start, end] = condition.value;
      return currentValue >= start && currentValue <= end;
    }
    default:
      return false;
  }
}

export function loadPolicies(policyDirectory: string): PolicyRule[] {
  if (!existsSync(policyDirectory)) {
    return [];
  }

  return readdirSync(policyDirectory)
    .filter((fileName) => fileName.endsWith('.json'))
    .flatMap((fileName) => {
      const filePath = join(policyDirectory, fileName);
      const content = JSON.parse(readFileSync(filePath, 'utf8')) as PolicyRule | PolicyRule[];
      return Array.isArray(content) ? content : [content];
    })
    .sort((left, right) => right.priority - left.priority);
}

export function evaluatePolicies(request: AuthorizationRequest, policies: PolicyRule[]): { matchedPolicies: string[]; reasons: string[] } {
  const matchedPolicies: string[] = [];
  const reasons: string[] = [];

  for (const policy of policies) {
    const serviceMatches = policy.target.service === '*' || policy.target.service === request.resource.service;
    const actionMatches = policy.target.action === '*' || policy.target.action === request.action;

    if (!serviceMatches || !actionMatches) {
      continue;
    }

    const matches = policy.conditions.every((condition) => evaluateCondition(request, condition));
    if (!matches) {
      continue;
    }

    matchedPolicies.push(policy.id);
    reasons.push(`${policy.effect}: ${policy.description}`);
  }

  return { matchedPolicies, reasons };
}
