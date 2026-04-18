/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */,
/* 1 */
/***/ ((module) => {

module.exports = require("@nestjs/common");

/***/ }),
/* 2 */
/***/ ((module) => {

module.exports = require("@nestjs/core");

/***/ }),
/* 3 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(5), exports);


/***/ }),
/* 4 */
/***/ ((module) => {

module.exports = require("tslib");

/***/ }),
/* 5 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getServiceDescriptor = getServiceDescriptor;
exports.readRuntimeConfig = readRuntimeConfig;
const crypto_1 = __webpack_require__(6);
const DEFAULT_SERVICES = {
    'identity-kdc': { name: 'identity-kdc', port: 3001 },
    'policy-pdp': { name: 'policy-pdp', port: 3002 },
    'audit-log': { name: 'audit-log', port: 3003 },
    'resource-hr': { name: 'resource-hr', port: 3011, department: 'hr' },
    'resource-finance': { name: 'resource-finance', port: 3012, department: 'finance' },
    'resource-it': { name: 'resource-it', port: 3013, department: 'it' },
    'resource-operations': { name: 'resource-operations', port: 3014, department: 'operations' },
};
function buildDefaultMasterKey() {
    return (0, crypto_1.createHash)('sha256').update('securecorp-default-master-key').digest('base64url');
}
function parseSecurityProfile(value) {
    return value === 'vulnerable' ? 'vulnerable' : 'secure';
}
function parseMasterKeys(value) {
    const source = value?.trim() || `v1:${buildDefaultMasterKey()}`;
    return source.split(',').reduce((accumulator, pair) => {
        const [keyId, encodedSecret] = pair.split(':');
        if (!keyId || !encodedSecret) {
            return accumulator;
        }
        accumulator[keyId.trim()] = (0, crypto_1.createHash)('sha256').update(encodedSecret.trim()).digest();
        return accumulator;
    }, {});
}
function getServiceDescriptor(serviceName) {
    return DEFAULT_SERVICES[serviceName] ?? { name: serviceName, port: 3000 };
}
function readRuntimeConfig(serviceName) {
    const descriptor = getServiceDescriptor(serviceName);
    const securityProfile = parseSecurityProfile(process.env['SECURITY_PROFILE']);
    const masterKeys = parseMasterKeys(process.env['KDC_MASTER_KEYS']);
    const keyId = process.env['KDC_ACTIVE_KID'] || Object.keys(masterKeys)[0] || 'v1';
    return {
        serviceName,
        port: Number(process.env['PORT'] || descriptor.port),
        securityProfile,
        keyId,
        masterKeys,
        tgtTtlSeconds: Number(process.env['TGT_TTL_SECONDS'] || 900),
        serviceTicketTtlSeconds: Number(process.env['SERVICE_TICKET_TTL_SECONDS'] || 300),
        allowedClockSkewSeconds: Number(process.env['ALLOWED_CLOCK_SKEW_SECONDS'] || 30),
        policyPath: process.env['POLICY_PATH'] || `policies/${securityProfile}`,
        pdpUrl: process.env['PDP_URL'] || 'http://localhost:3002/api',
        auditUrl: process.env['AUDIT_URL'] || 'http://localhost:3003/api',
        redisUrl: process.env['REDIS_URL'],
        databaseUrl: process.env['DATABASE_URL'],
    };
}


/***/ }),
/* 6 */
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),
/* 7 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AppModule = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const config_1 = __webpack_require__(8);
const app_service_1 = __webpack_require__(9);
const app_controller_1 = __webpack_require__(29);
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = tslib_1.__decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule.forRoot({ isGlobal: true })],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);


/***/ }),
/* 8 */
/***/ ((module) => {

module.exports = require("@nestjs/config");

/***/ }),
/* 9 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AppService = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const data_redis_1 = __webpack_require__(10);
const data_seed_1 = __webpack_require__(13);
const security_authenticators_1 = __webpack_require__(17);
const security_profile_1 = __webpack_require__(19);
const security_replay_1 = __webpack_require__(21);
const security_tickets_1 = __webpack_require__(23);
const shared_logging_1 = __webpack_require__(27);
const shared_config_1 = __webpack_require__(3);
const shared_utils_1 = __webpack_require__(25);
let AppService = class AppService {
    constructor() {
        this.config = (0, shared_config_1.readRuntimeConfig)('resource-operations');
        this.capabilities = (0, security_profile_1.getSecurityCapabilities)(this.config.securityProfile);
        this.logger = new shared_logging_1.StructuredLogger('resource-operations');
        this.serviceDescriptor = (0, shared_config_1.getServiceDescriptor)(this.config.serviceName);
        this.resources = new Map((0, data_seed_1.resourcesForService)(this.config.serviceName).map((resource) => [resource.id, { ...resource }]));
        this.fallbackReplayStore = new security_replay_1.InMemoryReplayStore();
        this.redisClient = (0, data_redis_1.createRedisClient)(this.config.redisUrl);
        this.replayStore = this.redisClient ? new data_redis_1.RedisReplayStore(this.redisClient) : this.fallbackReplayStore;
    }
    async onModuleInit() {
        if (this.redisClient) {
            try {
                await this.redisClient.connect();
            }
            catch {
                this.logger.warn('redis unavailable, replay protection fallback in-memory');
            }
        }
    }
    async onModuleDestroy() {
        await this.redisClient?.quit();
    }
    getHealth() {
        return {
            service: this.config.serviceName,
            profile: this.config.securityProfile,
            status: 'ok',
            resources: this.resources.size,
            at: (0, shared_utils_1.nowIso)(),
        };
    }
    async getResource(id, request) {
        const resource = this.getExistingResource(id);
        await this.authorize(request, resource, 'read');
        return resource;
    }
    async createResource(body, request) {
        const resource = {
            id: (0, data_seed_1.nextResourceId)(this.getResourcePrefix()),
            service: this.config.serviceName,
            department: this.serviceDescriptor.department || 'operations',
            classification: body.classification || 'public',
            owner: body.owner || 'system',
            allowedActions: ['read', 'write', 'delete'],
            content: {
                title: body.title || 'Untitled',
                payload: body.payload || body,
            },
        };
        await this.authorize(request, resource, 'write');
        this.resources.set(resource.id, resource);
        return resource;
    }
    async deleteResource(id, request) {
        const resource = this.getExistingResource(id);
        await this.authorize(request, resource, 'delete');
        this.resources.delete(id);
        return { deleted: true, id };
    }
    getExistingResource(id) {
        const resource = this.resources.get(id);
        if (!resource) {
            throw new common_1.NotFoundException(`Resource ${id} not found`);
        }
        return resource;
    }
    async authorize(request, resource, action) {
        const ticket = this.getHeader(request, 'x-service-ticket');
        const authenticatorToken = this.getHeader(request, 'x-authenticator');
        const requestId = this.getHeader(request, 'x-request-id') || (0, shared_utils_1.createRequestId)();
        if (!ticket || !authenticatorToken) {
            throw new common_1.UnauthorizedException('Missing ticket headers');
        }
        const ticketClaims = (0, security_tickets_1.decodeTicket)(ticket, (keyId) => this.resolveMasterKey(keyId));
        this.assertTicketClaims(ticketClaims);
        const requestHash = (0, security_authenticators_1.buildRequestHash)(this.getMethod(request), this.getPath(request), request.body || {});
        const authenticatorClaims = (0, security_authenticators_1.verifyAuthenticator)(authenticatorToken, ticketClaims.sessionKey);
        if (this.capabilities.enforceRequestHash && authenticatorClaims.requestHash !== requestHash) {
            throw new common_1.UnauthorizedException('Request hash mismatch');
        }
        if (authenticatorClaims.service !== this.config.serviceName) {
            throw new common_1.UnauthorizedException('Authenticator audience mismatch');
        }
        const authTimestamp = new Date(authenticatorClaims.timestamp).getTime();
        if (this.capabilities.enforceExpiry &&
            Math.abs(Date.now() - authTimestamp) > this.config.allowedClockSkewSeconds * 1000) {
            throw new common_1.UnauthorizedException('Authenticator timestamp outside allowed skew');
        }
        if (this.capabilities.enforceReplayProtection) {
            const replayKey = (0, security_replay_1.buildReplayKey)(ticketClaims.ticketId, authenticatorClaims.nonce);
            if (await this.replayStore.has(replayKey)) {
                throw new common_1.UnauthorizedException('Replay attack detected');
            }
            await this.replayStore.set(replayKey, this.config.serviceTicketTtlSeconds);
        }
        const authorizationRequest = {
            subject: {
                id: ticketClaims.sub,
                username: ticketClaims.username,
                role: ticketClaims.role,
                department: ticketClaims.department,
                clearance: ticketClaims.clearance,
                location: ticketClaims.location,
                employmentStatus: ticketClaims.employmentStatus,
                activeRoles: ticketClaims.activeRoles,
            },
            action,
            resource: {
                id: resource.id,
                service: this.config.serviceName,
                department: resource.department,
                classification: resource.classification,
                owner: resource.owner,
                allowedActions: resource.allowedActions,
            },
            environment: {
                time: (0, shared_utils_1.normalizeTimeForPolicies)(),
                ip: this.getIp(request),
                networkZone: ticketClaims.location === 'external' ? 'external' : 'internal',
                method: this.getMethod(request),
                requestId,
            },
        };
        const decision = await this.callPolicyDecisionPoint(authorizationRequest);
        await this.publishAudit({
            timestamp: (0, shared_utils_1.nowIso)(),
            eventType: 'resource.access',
            requestId,
            severity: decision.decision === 'ALLOW' ? 'info' : 'security',
            service: this.config.serviceName,
            actor: ticketClaims.sub,
            details: {
                action,
                resourceId: resource.id,
                decision: decision.decision,
                reason: decision.reason,
            },
        });
        if (decision.decision !== 'ALLOW') {
            throw new common_1.ForbiddenException(decision.reason);
        }
    }
    assertTicketClaims(ticketClaims) {
        if (ticketClaims.typ !== 'ST') {
            throw new common_1.UnauthorizedException('A service ticket is required');
        }
        if (this.capabilities.enforceExpiry && new Date(ticketClaims.expiresAt).getTime() < Date.now()) {
            throw new common_1.UnauthorizedException('Expired service ticket');
        }
        if (this.capabilities.enforceAudience && ticketClaims.service !== this.config.serviceName) {
            throw new common_1.UnauthorizedException('Ticket audience mismatch');
        }
    }
    async callPolicyDecisionPoint(request) {
        const response = await fetch(`${this.config.pdpUrl}/authorize`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(request),
        }).catch(() => undefined);
        if (!response?.ok) {
            throw new common_1.BadGatewayException('policy-pdp unavailable');
        }
        return (await response.json());
    }
    async publishAudit(event) {
        this.logger.log(event);
        try {
            await fetch(`${this.config.auditUrl}/events`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(event),
            });
        }
        catch {
            this.logger.warn('audit-log unavailable', { eventType: event.eventType });
        }
    }
    resolveMasterKey(keyId) {
        const key = this.config.masterKeys[keyId];
        if (!key) {
            throw new common_1.UnauthorizedException(`Unknown key id ${keyId}`);
        }
        return key;
    }
    getHeader(request, key) {
        const headers = request.headers || {};
        const value = headers[key] ?? headers[key.toLowerCase()];
        return Array.isArray(value) ? String(value[0]) : value ? String(value) : undefined;
    }
    getMethod(request) {
        return String(request.method || 'GET');
    }
    getPath(request) {
        return String(request.originalUrl || request.url || request.path || '/');
    }
    getIp(request) {
        return String(request.ip || '127.0.0.1');
    }
    getResourcePrefix() {
        switch (this.config.serviceName) {
            case 'resource-finance':
                return 'fin-doc';
            case 'resource-it':
                return 'it-doc';
            case 'resource-operations':
                return 'ops-doc';
            default:
                return 'hr-doc';
        }
    }
};
exports.AppService = AppService;
exports.AppService = AppService = tslib_1.__decorate([
    (0, common_1.Injectable)()
], AppService);


/***/ }),
/* 10 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(11), exports);


/***/ }),
/* 11 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RedisReplayStore = void 0;
exports.createRedisClient = createRedisClient;
const tslib_1 = __webpack_require__(4);
const ioredis_1 = tslib_1.__importDefault(__webpack_require__(12));
class RedisReplayStore {
    constructor(client) {
        this.client = client;
    }
    async has(key) {
        return (await this.client.exists(key)) === 1;
    }
    async set(key, ttlSeconds) {
        await this.client.set(key, '1', 'EX', ttlSeconds);
    }
}
exports.RedisReplayStore = RedisReplayStore;
function createRedisClient(redisUrl) {
    if (!redisUrl) {
        return undefined;
    }
    return new ioredis_1.default(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
}


/***/ }),
/* 12 */
/***/ ((module) => {

module.exports = require("ioredis");

/***/ }),
/* 13 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(14), exports);


/***/ }),
/* 14 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fallbackPolicies = exports.seededResources = exports.seededUsers = void 0;
exports.resourcesForService = resourcesForService;
exports.findUserByUsername = findUserByUsername;
exports.nextResourceId = nextResourceId;
const crypto_1 = __webpack_require__(6);
const security_crypto_1 = __webpack_require__(15);
function buildUser(input) {
    const passwordSalt = `${input.username}-salt`;
    return {
        id: input.id,
        username: input.username,
        role: input.role,
        department: input.department,
        clearance: input.clearance,
        location: input.location,
        employmentStatus: input.employmentStatus,
        activeRoles: input.activeRoles,
        passwordSalt,
        passwordHash: (0, security_crypto_1.hashPassword)(input.password, passwordSalt),
    };
}
exports.seededUsers = [
    buildUser({
        id: 'user-admin-001',
        username: 'admin',
        password: 'Admin123!',
        role: 'admin',
        department: 'it',
        clearance: 'secret',
        location: 'internal',
        employmentStatus: 'active',
        activeRoles: ['global-admin'],
    }),
    buildUser({
        id: 'user-finance-001',
        username: 'alice',
        password: 'Alice123!',
        role: 'manager',
        department: 'finance',
        clearance: 'secret',
        location: 'internal',
        employmentStatus: 'active',
        activeRoles: ['finance-manager', 'finance-approver'],
    }),
    buildUser({
        id: 'user-hr-001',
        username: 'bob',
        password: 'Bob123!!',
        role: 'employee',
        department: 'hr',
        clearance: 'confidential',
        location: 'internal',
        employmentStatus: 'active',
        activeRoles: ['hr-reader'],
    }),
    buildUser({
        id: 'user-ext-001',
        username: 'eve',
        password: 'Eve123!!',
        role: 'employee',
        department: 'operations',
        clearance: 'public',
        location: 'external',
        employmentStatus: 'active',
        activeRoles: ['ops-reader'],
    }),
];
exports.seededResources = [
    {
        id: 'hr-doc-001',
        service: 'resource-hr',
        department: 'hr',
        classification: 'confidential',
        owner: 'user-hr-001',
        allowedActions: ['read', 'write'],
        content: { title: 'Employee file', payload: 'HR payroll review' },
    },
    {
        id: 'fin-doc-001',
        service: 'resource-finance',
        department: 'finance',
        classification: 'secret',
        owner: 'user-finance-001',
        allowedActions: ['read', 'write', 'delete'],
        content: { title: 'Quarter budget', payload: 'FY26 operating margin' },
    },
    {
        id: 'it-doc-001',
        service: 'resource-it',
        department: 'it',
        classification: 'confidential',
        owner: 'user-admin-001',
        allowedActions: ['read', 'write'],
        content: { title: 'Inventory', payload: 'VPN appliance list' },
    },
    {
        id: 'ops-doc-001',
        service: 'resource-operations',
        department: 'operations',
        classification: 'public',
        owner: 'user-ext-001',
        allowedActions: ['read'],
        content: { title: 'Schedule', payload: 'Shift allocations' },
    },
];
function resourcesForService(serviceName) {
    return exports.seededResources.filter((resource) => resource.service === serviceName);
}
function findUserByUsername(username) {
    return exports.seededUsers.find((user) => user.username === username);
}
function nextResourceId(prefix) {
    return `${prefix}-${(0, crypto_1.randomUUID)().slice(0, 8)}`;
}
exports.fallbackPolicies = [
    {
        id: 'deny-secret-external',
        description: 'Deny external access to secret resources',
        effect: 'deny',
        priority: 100,
        target: { service: '*', action: '*' },
        conditions: [
            { field: 'resource.classification', operator: 'eq', value: 'secret' },
            { field: 'user.location', operator: 'eq', value: 'external' },
        ],
    },
    {
        id: 'deny-delete-non-admin',
        description: 'Only admins can delete resources',
        effect: 'deny',
        priority: 90,
        target: { service: '*', action: 'delete' },
        conditions: [{ field: 'user.role', operator: 'neq', value: 'admin' }],
    },
];


/***/ }),
/* 15 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(16), exports);


/***/ }),
/* 16 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.randomKeyBase64Url = randomKeyBase64Url;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.sha256 = sha256;
exports.hmacSha256 = hmacSha256;
exports.sealPayload = sealPayload;
exports.unsealPayload = unsealPayload;
const crypto_1 = __webpack_require__(6);
function randomKeyBase64Url(size = 32) {
    return (0, crypto_1.randomBytes)(size).toString('base64url');
}
function hashPassword(password, salt) {
    return (0, crypto_1.scryptSync)(password, salt, 64).toString('base64url');
}
function verifyPassword(password, salt, expectedHash) {
    const computed = Buffer.from(hashPassword(password, salt), 'utf8');
    const expected = Buffer.from(expectedHash, 'utf8');
    return computed.length === expected.length && (0, crypto_1.timingSafeEqual)(computed, expected);
}
function sha256(value) {
    return (0, crypto_1.createHash)('sha256').update(value).digest('hex');
}
function hmacSha256(secret, value) {
    return (0, crypto_1.createHmac)('sha256', secret).update(value).digest('hex');
}
function sealPayload(payload, keyId, key) {
    const iv = (0, crypto_1.randomBytes)(12);
    const cipher = (0, crypto_1.createCipheriv)('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const envelope = {
        kid: keyId,
        iv: iv.toString('base64url'),
        ciphertext: ciphertext.toString('base64url'),
        tag: tag.toString('base64url'),
    };
    return Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url');
}
function unsealPayload(encodedEnvelope, keyResolver) {
    const envelope = JSON.parse(Buffer.from(encodedEnvelope, 'base64url').toString('utf8'));
    const key = keyResolver(envelope.kid);
    const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
        decipher.final(),
    ]).toString('utf8');
    return JSON.parse(plaintext);
}


/***/ }),
/* 17 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(18), exports);


/***/ }),
/* 18 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.buildRequestHash = buildRequestHash;
exports.issueAuthenticator = issueAuthenticator;
exports.verifyAuthenticator = verifyAuthenticator;
const security_crypto_1 = __webpack_require__(15);
function buildRequestHash(method, path, body) {
    return (0, security_crypto_1.sha256)(`${method.toUpperCase()}:${path}:${JSON.stringify(body ?? {})}`);
}
function issueAuthenticator(claims, sessionKey) {
    const signature = (0, security_crypto_1.hmacSha256)(sessionKey, JSON.stringify(claims));
    const value = { claims, signature };
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}
function verifyAuthenticator(token, sessionKey) {
    const value = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    const expectedSignature = (0, security_crypto_1.hmacSha256)(sessionKey, JSON.stringify(value.claims));
    if (expectedSignature !== value.signature) {
        throw new Error('Invalid authenticator signature');
    }
    return value.claims;
}


/***/ }),
/* 19 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(20), exports);


/***/ }),
/* 20 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getSecurityCapabilities = getSecurityCapabilities;
function getSecurityCapabilities(profile) {
    if (profile === 'vulnerable') {
        return {
            enforceExpiry: false,
            enforceAudience: false,
            enforceRequestHash: false,
            enforceReplayProtection: false,
            enforceSod: false,
            enforceAbac: false,
        };
    }
    return {
        enforceExpiry: true,
        enforceAudience: true,
        enforceRequestHash: true,
        enforceReplayProtection: true,
        enforceSod: true,
        enforceAbac: true,
    };
}


/***/ }),
/* 21 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(22), exports);


/***/ }),
/* 22 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.InMemoryReplayStore = void 0;
exports.buildReplayKey = buildReplayKey;
class InMemoryReplayStore {
    constructor() {
        this.store = new Map();
    }
    async has(key) {
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
    async set(key, ttlSeconds) {
        this.store.set(key, Date.now() + ttlSeconds * 1000);
    }
}
exports.InMemoryReplayStore = InMemoryReplayStore;
function buildReplayKey(ticketId, nonce) {
    return `${ticketId}:${nonce}`;
}


/***/ }),
/* 23 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(24), exports);


/***/ }),
/* 24 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.issueTgt = issueTgt;
exports.issueServiceTicket = issueServiceTicket;
exports.decodeTicket = decodeTicket;
const crypto_1 = __webpack_require__(6);
const shared_utils_1 = __webpack_require__(25);
const security_crypto_1 = __webpack_require__(15);
const ROLE_ACTIONS = {
    employee: ['read'],
    manager: ['read', 'write'],
    admin: ['read', 'write', 'delete'],
};
function issueTgt(input) {
    const claims = {
        typ: 'TGT',
        ticketId: (0, crypto_1.randomUUID)(),
        sub: input.user.id,
        username: input.user.username,
        activeRoles: input.user.activeRoles,
        role: input.user.role,
        department: input.user.department,
        clearance: input.user.clearance,
        location: input.user.location,
        sessionKey: (0, security_crypto_1.randomKeyBase64Url)(),
        issuedAt: (0, shared_utils_1.nowIso)(),
        expiresAt: (0, shared_utils_1.addSeconds)(new Date(), input.ttlSeconds),
        nonce: (0, crypto_1.randomUUID)(),
        tgsAudience: 'identity-kdc',
        scopeActions: ROLE_ACTIONS[input.user.role],
        employmentStatus: input.user.employmentStatus,
    };
    return {
        token: (0, security_crypto_1.sealPayload)(claims, input.keyId, input.key),
        claims,
    };
}
function issueServiceTicket(input) {
    const claims = {
        ...input.tgtClaims,
        typ: 'ST',
        ticketId: (0, crypto_1.randomUUID)(),
        service: input.service,
        sessionKey: (0, security_crypto_1.randomKeyBase64Url)(),
        issuedAt: (0, shared_utils_1.nowIso)(),
        expiresAt: (0, shared_utils_1.addSeconds)(new Date(), input.ttlSeconds),
        nonce: (0, crypto_1.randomUUID)(),
        tgsAudience: undefined,
    };
    return {
        token: (0, security_crypto_1.sealPayload)(claims, input.keyId, input.key),
        claims,
    };
}
function decodeTicket(token, keyResolver) {
    return (0, security_crypto_1.unsealPayload)(token, keyResolver);
}


/***/ }),
/* 25 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(26), exports);


/***/ }),
/* 26 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.createRequestId = createRequestId;
exports.nowIso = nowIso;
exports.addSeconds = addSeconds;
exports.toBase64Url = toBase64Url;
exports.fromBase64Url = fromBase64Url;
exports.mapMethodToAction = mapMethodToAction;
exports.normalizeTimeForPolicies = normalizeTimeForPolicies;
const crypto_1 = __webpack_require__(6);
function createRequestId() {
    return (0, crypto_1.randomUUID)();
}
function nowIso() {
    return new Date().toISOString();
}
function addSeconds(date, seconds) {
    return new Date(date.getTime() + seconds * 1000).toISOString();
}
function toBase64Url(value) {
    return Buffer.from(value, 'utf8').toString('base64url');
}
function fromBase64Url(value) {
    return Buffer.from(value, 'base64url').toString('utf8');
}
function mapMethodToAction(method) {
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
function normalizeTimeForPolicies(date = new Date()) {
    return date.toISOString().slice(11, 16);
}


/***/ }),
/* 27 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(28), exports);


/***/ }),
/* 28 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.StructuredLogger = void 0;
const common_1 = __webpack_require__(1);
class StructuredLogger {
    constructor(scope) {
        this.scope = scope;
        this.logger = new common_1.Logger(scope);
    }
    log(event) {
        this.logger.log(JSON.stringify(event));
    }
    warn(message, details) {
        this.logger.warn(JSON.stringify({ service: this.scope, message, details }));
    }
    error(message, details) {
        this.logger.error(JSON.stringify({ service: this.scope, message, details }));
    }
}
exports.StructuredLogger = StructuredLogger;


/***/ }),
/* 29 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AppController = void 0;
const tslib_1 = __webpack_require__(4);
const common_1 = __webpack_require__(1);
const app_service_1 = __webpack_require__(9);
let AppController = class AppController {
    constructor(appService) {
        this.appService = appService;
    }
    getHealth() {
        return this.appService.getHealth();
    }
    getResource(id, request) {
        return this.appService.getResource(id, request);
    }
    createResource(body, request) {
        return this.appService.createResource(body, request);
    }
    deleteResource(id, request) {
        return this.appService.deleteResource(id, request);
    }
};
exports.AppController = AppController;
tslib_1.__decorate([
    (0, common_1.Get)('health'),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", void 0)
], AppController.prototype, "getHealth", null);
tslib_1.__decorate([
    (0, common_1.Get)('resource/:id'),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, typeof (_b = typeof Record !== "undefined" && Record) === "function" ? _b : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], AppController.prototype, "getResource", null);
tslib_1.__decorate([
    (0, common_1.Post)('resource'),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [typeof (_c = typeof Record !== "undefined" && Record) === "function" ? _c : Object, typeof (_d = typeof Record !== "undefined" && Record) === "function" ? _d : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], AppController.prototype, "createResource", null);
tslib_1.__decorate([
    (0, common_1.Delete)('resource/:id'),
    tslib_1.__param(0, (0, common_1.Param)('id')),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String, typeof (_e = typeof Record !== "undefined" && Record) === "function" ? _e : Object]),
    tslib_1.__metadata("design:returntype", void 0)
], AppController.prototype, "deleteResource", null);
exports.AppController = AppController = tslib_1.__decorate([
    (0, common_1.Controller)(),
    tslib_1.__metadata("design:paramtypes", [typeof (_a = typeof app_service_1.AppService !== "undefined" && app_service_1.AppService) === "function" ? _a : Object])
], AppController);


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
const common_1 = __webpack_require__(1);
const core_1 = __webpack_require__(2);
const shared_config_1 = __webpack_require__(3);
const app_module_1 = __webpack_require__(7);
async function bootstrap() {
    const config = (0, shared_config_1.readRuntimeConfig)('resource-operations');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);
    await app.listen(config.port);
    common_1.Logger.log(`resource-operations listening on http://localhost:${config.port}/${globalPrefix}`);
}
bootstrap();

})();

/******/ })()
;
//# sourceMappingURL=main.js.map