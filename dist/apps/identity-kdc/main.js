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
const app_controller_1 = __webpack_require__(22);
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
const data_seed_1 = __webpack_require__(10);
const security_profile_1 = __webpack_require__(14);
const security_crypto_1 = __webpack_require__(12);
const security_tickets_1 = __webpack_require__(16);
const shared_logging_1 = __webpack_require__(20);
const shared_utils_1 = __webpack_require__(18);
const shared_config_1 = __webpack_require__(3);
let AppService = class AppService {
    constructor() {
        this.config = (0, shared_config_1.readRuntimeConfig)('identity-kdc');
        this.capabilities = (0, security_profile_1.getSecurityCapabilities)(this.config.securityProfile);
        this.logger = new shared_logging_1.StructuredLogger('identity-kdc');
    }
    getHealth() {
        return {
            service: this.config.serviceName,
            profile: this.config.securityProfile,
            status: 'ok',
            at: (0, shared_utils_1.nowIso)(),
        };
    }
    async login(body) {
        const user = (0, data_seed_1.findUserByUsername)(body.username);
        if (!user || !(0, security_crypto_1.verifyPassword)(body.password, user.passwordSalt, user.passwordHash)) {
            await this.publishAudit({
                timestamp: (0, shared_utils_1.nowIso)(),
                eventType: 'authentication.failed',
                requestId: (0, shared_utils_1.createRequestId)(),
                severity: 'security',
                service: this.config.serviceName,
                actor: body.username,
                details: { reason: 'invalid credentials' },
            });
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const { token, claims } = (0, security_tickets_1.issueTgt)({
            user,
            keyId: this.config.keyId,
            key: this.resolveMasterKey(this.config.keyId),
            ttlSeconds: this.config.tgtTtlSeconds,
        });
        await this.publishAudit({
            timestamp: (0, shared_utils_1.nowIso)(),
            eventType: 'authentication.succeeded',
            requestId: (0, shared_utils_1.createRequestId)(),
            severity: 'info',
            service: this.config.serviceName,
            actor: user.id,
            details: { ticketId: claims.ticketId, username: user.username },
        });
        return {
            tgt: token,
            clientSessionKey: claims.sessionKey,
            expiresAt: claims.expiresAt,
            user: {
                id: user.id,
                role: user.role,
                department: user.department,
                clearance: user.clearance,
            },
        };
    }
    async requestTicket(body) {
        const tgtClaims = (0, security_tickets_1.decodeTicket)(body.tgt, (keyId) => this.resolveMasterKey(keyId));
        if (tgtClaims.typ !== 'TGT') {
            throw new common_1.BadRequestException('The provided ticket is not a TGT');
        }
        this.assertTicketValidity(tgtClaims, body.service);
        const { token, claims } = (0, security_tickets_1.issueServiceTicket)({
            tgtClaims,
            service: body.service,
            keyId: this.config.keyId,
            key: this.resolveMasterKey(this.config.keyId),
            ttlSeconds: this.config.serviceTicketTtlSeconds,
        });
        await this.publishAudit({
            timestamp: (0, shared_utils_1.nowIso)(),
            eventType: 'ticket.issued',
            requestId: (0, shared_utils_1.createRequestId)(),
            severity: 'info',
            service: this.config.serviceName,
            actor: tgtClaims.sub,
            details: { ticketId: claims.ticketId, service: body.service },
        });
        return {
            serviceTicket: token,
            serviceSessionKey: claims.sessionKey,
            service: body.service,
            expiresAt: claims.expiresAt,
        };
    }
    assertTicketValidity(tgtClaims, serviceName) {
        if (this.capabilities.enforceExpiry && new Date(tgtClaims.expiresAt).getTime() < Date.now()) {
            throw new common_1.UnauthorizedException('Expired TGT');
        }
        if (this.capabilities.enforceAudience && tgtClaims.tgsAudience !== 'identity-kdc') {
            throw new common_1.UnauthorizedException('Invalid TGT audience');
        }
        if (!serviceName.startsWith('resource-')) {
            throw new common_1.BadRequestException('Unknown target service');
        }
    }
    resolveMasterKey(keyId) {
        const key = this.config.masterKeys[keyId];
        if (!key) {
            throw new common_1.UnauthorizedException(`Unknown key id ${keyId}`);
        }
        return key;
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
exports.fallbackPolicies = exports.seededResources = exports.seededUsers = void 0;
exports.resourcesForService = resourcesForService;
exports.findUserByUsername = findUserByUsername;
exports.nextResourceId = nextResourceId;
const crypto_1 = __webpack_require__(6);
const security_crypto_1 = __webpack_require__(12);
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
/* 12 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(13), exports);


/***/ }),
/* 13 */
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
/* 14 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(15), exports);


/***/ }),
/* 15 */
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
/* 16 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(17), exports);


/***/ }),
/* 17 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.issueTgt = issueTgt;
exports.issueServiceTicket = issueServiceTicket;
exports.decodeTicket = decodeTicket;
const crypto_1 = __webpack_require__(6);
const shared_utils_1 = __webpack_require__(18);
const security_crypto_1 = __webpack_require__(12);
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
/* 18 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(19), exports);


/***/ }),
/* 19 */
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
/* 20 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(21), exports);


/***/ }),
/* 21 */
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
/* 22 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


var _a;
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
    login(body) {
        return this.appService.login(body);
    }
    requestTicket(body) {
        return this.appService.requestTicket(body);
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
    (0, common_1.Post)('login'),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", void 0)
], AppController.prototype, "login", null);
tslib_1.__decorate([
    (0, common_1.Post)('request-ticket'),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", void 0)
], AppController.prototype, "requestTicket", null);
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
    const config = (0, shared_config_1.readRuntimeConfig)('identity-kdc');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);
    await app.listen(config.port);
    common_1.Logger.log(`identity-kdc listening on http://localhost:${config.port}/${globalPrefix}`);
}
bootstrap();

})();

/******/ })()
;
//# sourceMappingURL=main.js.map