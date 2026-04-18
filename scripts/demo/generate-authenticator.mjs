import { createHmac, createHash, randomUUID } from 'node:crypto';

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 2) {
    const rawKey = argv[index];
    const rawValue = argv[index + 1];
    if (!rawKey?.startsWith('--') || rawValue === undefined) {
      continue;
    }

    args[rawKey.slice(2)] = rawValue;
  }

  return args;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function hmacSha256(secret, value) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function buildRequestHash(method, path, body) {
  return sha256(`${method.toUpperCase()}:${path}:${JSON.stringify(body)}`);
}

const args = parseArgs(process.argv);

if (!args.sub || !args.service || !args.method || !args.path || !args['session-key']) {
  console.error('Usage: node scripts/demo/generate-authenticator.mjs --sub <user-id> --service <service-name> --method <GET|POST|DELETE> --path </api/...> --session-key <service-session-key> [--body <json>] [--timestamp <iso>] [--nonce <uuid>]');
  process.exit(1);
}

const body = args.body ? JSON.parse(args.body) : {};
const timestamp = args.timestamp || new Date().toISOString();
const nonce = args.nonce || randomUUID();
const requestHash = buildRequestHash(args.method, args.path, body);
const claims = {
  sub: args.sub,
  service: args.service,
  timestamp,
  nonce,
  requestHash,
};
const signature = hmacSha256(args['session-key'], JSON.stringify(claims));
const token = Buffer.from(JSON.stringify({ claims, signature }), 'utf8').toString('base64url');

console.log(JSON.stringify({
  requestHash,
  claims,
  token,
  headers: {
    'X-Authenticator': token,
  },
}, null, 2));