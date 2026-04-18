import { createHmac, createHash, randomUUID } from 'node:crypto';

const EXPECTATION_PROFILE = process.env.EXPECTATION_PROFILE || 'secure';
const KDC_URL = process.env.KDC_URL || 'http://localhost:3001/api';
const FINANCE_URL = process.env.FINANCE_URL || 'http://localhost:3012/api';
const AUDIT_URL = process.env.AUDIT_URL || 'http://localhost:3003/api';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hmacSha256(secret, value) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function buildRequestHash(method, path, body) {
  return sha256(`${method.toUpperCase()}:${path}:${JSON.stringify(body ?? {})}`);
}

function buildAuthenticator({ sub, service, method, path, body, sessionKey, nonce }) {
  const claims = {
    sub,
    service,
    timestamp: new Date().toISOString(),
    nonce: nonce || randomUUID(),
    requestHash: buildRequestHash(method, path, body ?? {}),
  };

  const signature = hmacSha256(sessionKey, JSON.stringify(claims));
  return {
    claims,
    token: Buffer.from(JSON.stringify({ claims, signature }), 'utf8').toString('base64url'),
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  let body;

  const text = await response.text();
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }

  return { response, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function login(username, password) {
  const { response, body } = await requestJson(`${KDC_URL}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  assert(response.ok, `login failed for ${username}`);
  return body;
}

async function requestTicket(tgt, service) {
  const { response, body } = await requestJson(`${KDC_URL}/request-ticket`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tgt, service }),
  });

  assert(response.ok, `request-ticket failed for ${service}`);
  return body;
}

async function callFinanceResource({ userId, ticket, sessionKey, resourceId, nonce }) {
  const path = `/api/resource/${resourceId}`;
  const authenticator = buildAuthenticator({
    sub: userId,
    service: 'resource-finance',
    method: 'GET',
    path,
    body: {},
    sessionKey,
    nonce,
  });

  return requestJson(`${FINANCE_URL}/resource/${resourceId}`, {
    method: 'GET',
    headers: {
      'x-service-ticket': ticket,
      'x-authenticator': authenticator.token,
      'x-request-id': randomUUID(),
    },
  });
}

async function run() {
  console.log(`Running smoke test for profile=${EXPECTATION_PROFILE}`);

  for (const url of [`${KDC_URL}/health`, `${AUDIT_URL}/health`, `${FINANCE_URL}/health`]) {
    const { response } = await requestJson(url);
    assert(response.ok, `health endpoint unavailable: ${url}`);
  }

  const aliceLogin = await login('alice', 'Alice123!');
  const aliceTicket = await requestTicket(aliceLogin.tgt, 'resource-finance');
  const aliceRead = await callFinanceResource({
    userId: aliceLogin.user.id,
    ticket: aliceTicket.serviceTicket,
    sessionKey: aliceTicket.serviceSessionKey,
    resourceId: 'fin-doc-001',
  });
  assert(aliceRead.response.ok, 'alice should read finance resource');
  console.log('OK alice can read finance resource');

  const replayNonce = randomUUID();
  const replayAttemptOne = await callFinanceResource({
    userId: aliceLogin.user.id,
    ticket: aliceTicket.serviceTicket,
    sessionKey: aliceTicket.serviceSessionKey,
    resourceId: 'fin-doc-001',
    nonce: replayNonce,
  });
  const replayAttemptTwo = await callFinanceResource({
    userId: aliceLogin.user.id,
    ticket: aliceTicket.serviceTicket,
    sessionKey: aliceTicket.serviceSessionKey,
    resourceId: 'fin-doc-001',
    nonce: replayNonce,
  });

  assert(replayAttemptOne.response.ok, 'first replay candidate request should succeed');
  if (EXPECTATION_PROFILE === 'secure') {
    assert(!replayAttemptTwo.response.ok, 'replay should be blocked in secure profile');
    console.log('OK replay blocked in secure profile');
  } else {
    assert(replayAttemptTwo.response.ok, 'replay should be allowed in vulnerable profile');
    console.log('OK replay accepted in vulnerable profile');
  }

  const bobLogin = await login('bob', 'Bob123!!');
  const bobTicket = await requestTicket(bobLogin.tgt, 'resource-finance');
  const bobRead = await callFinanceResource({
    userId: bobLogin.user.id,
    ticket: bobTicket.serviceTicket,
    sessionKey: bobTicket.serviceSessionKey,
    resourceId: 'fin-doc-001',
  });

  if (EXPECTATION_PROFILE === 'secure') {
    assert(!bobRead.response.ok, 'cross-department read should be denied in secure profile');
    console.log('OK cross-department access denied in secure profile');
  } else {
    assert(bobRead.response.ok, 'cross-department read should pass in vulnerable profile');
    console.log('OK cross-department access passes in vulnerable profile');
  }

  const eveLogin = await login('eve', 'Eve123!!');
  const eveTicket = await requestTicket(eveLogin.tgt, 'resource-finance');
  const eveRead = await callFinanceResource({
    userId: eveLogin.user.id,
    ticket: eveTicket.serviceTicket,
    sessionKey: eveTicket.serviceSessionKey,
    resourceId: 'fin-doc-001',
  });

  if (EXPECTATION_PROFILE === 'secure') {
    assert(!eveRead.response.ok, 'external secret access should be denied in secure profile');
    console.log('OK external secret access denied in secure profile');
  } else {
    assert(eveRead.response.ok, 'external secret access should pass in vulnerable profile');
    console.log('OK external secret access passes in vulnerable profile');
  }

  const auditEvents = await requestJson(`${AUDIT_URL}/events?limit=20`);
  assert(auditEvents.response.ok, 'audit-log should expose events');
  assert(Array.isArray(auditEvents.body) && auditEvents.body.length > 0, 'audit-log should contain events');
  console.log('OK audit-log recorded events');

  console.log('Smoke test completed successfully');
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});