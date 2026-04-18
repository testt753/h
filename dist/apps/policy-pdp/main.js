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
const app_controller_1 = __webpack_require__(28);
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
const security_abac_1 = __webpack_require__(14);
const security_policy_engine_1 = __webpack_require__(16);
const security_profile_1 = __webpack_require__(20);
const security_rbac_1 = __webpack_require__(22);
const shared_logging_1 = __webpack_require__(24);
const shared_config_1 = __webpack_require__(3);
const shared_utils_1 = __webpack_require__(26);
let AppService = class AppService {
    constructor() {
        this.config = (0, shared_config_1.readRuntimeConfig)('policy-pdp');
        this.capabilities = (0, security_profile_1.getSecurityCapabilities)(this.config.securityProfile);
        this.logger = new shared_logging_1.StructuredLogger('policy-pdp');
    }
    getHealth() {
        return {
            service: this.config.serviceName,
            profile: this.config.securityProfile,
            status: 'ok',
            at: (0, shared_utils_1.nowIso)(),
        };
    }
    async authorize(request) {
        const loadedPolicies = this.readPolicies();
        const rbacResult = (0, security_rbac_1.evaluateRbac)(request, this.capabilities.enforceSod);
        const abacResult = (0, security_abac_1.evaluateAbac)(request, this.capabilities.enforceAbac);
        const policyResult = (0, security_policy_engine_1.evaluatePolicies)(request, loadedPolicies);
        const matchedPolicyDescriptions = policyResult.reasons.filter((reason) => reason.startsWith('deny:'));
        const denyReasons = [
            ...rbacResult.reasons,
            ...abacResult.reasons,
            ...matchedPolicyDescriptions,
        ];
        const decision = {
            decision: denyReasons.length === 0 ? 'ALLOW' : 'DENY',
            reason: denyReasons[0] || 'request allowed by RBAC, ABAC and policy engine',
            matchedPolicies: policyResult.matchedPolicies,
            obligations: ['log-security-event'],
            context: {
                requestId: request.environment.requestId,
                subject: request.subject.id,
                resource: request.resource.id,
            },
        };
        await this.publishAudit({
            timestamp: (0, shared_utils_1.nowIso)(),
            eventType: 'authorization.decision',
            requestId: request.environment.requestId,
            severity: decision.decision === 'ALLOW' ? 'info' : 'security',
            service: this.config.serviceName,
            actor: request.subject.id,
            details: {
                decision: decision.decision,
                reason: decision.reason,
                matchedPolicies: decision.matchedPolicies,
                obligations: decision.obligations,
                context: decision.context,
            },
        });
        return decision;
    }
    readPolicies() {
        const fromDisk = (0, security_policy_engine_1.loadPolicies)(this.config.policyPath);
        return fromDisk.length > 0 ? fromDisk : data_seed_1.fallbackPolicies;
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
exports.evaluateAbac = evaluateAbac;
const CLEARANCE_ORDER = {
    public: 1,
    confidential: 2,
    secret: 3,
};
function evaluateAbac(request, enforceAbac) {
    if (!enforceAbac) {
        return { allowed: true, reasons: [] };
    }
    const reasons = [];
    if (request.subject.department !== request.resource.department && request.subject.role !== 'admin') {
        reasons.push('department isolation policy denied access');
    }
    if (CLEARANCE_ORDER[request.subject.clearance] < CLEARANCE_ORDER[request.resource.classification]) {
        reasons.push('resource classification exceeds user clearance');
    }
    if (request.subject.location === 'external' && request.resource.classification === 'secret') {
        reasons.push('external access to secret resource denied');
    }
    if (request.environment.time < '08:00' || request.environment.time > '18:00') {
        reasons.push('access requested outside allowed business hours');
    }
    return { allowed: reasons.length === 0, reasons };
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
exports.loadPolicies = loadPolicies;
exports.evaluatePolicies = evaluatePolicies;
const fs_1 = __webpack_require__(18);
const path_1 = __webpack_require__(19);
function resolveField(request, field) {
    return field.split('.').reduce((current, segment) => {
        if (current && typeof current === 'object' && segment in current) {
            return current[segment];
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
function evaluateCondition(request, condition) {
    const currentValue = resolveField(request, condition.field);
    switch (condition.operator) {
        case 'eq':
            return currentValue === condition.value;
        case 'neq':
            return currentValue !== condition.value;
        case 'in':
            return Array.isArray(condition.value) && condition.value.includes(String(currentValue));
        case 'includes':
            return Array.isArray(currentValue) && currentValue.includes(condition.value);
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
function loadPolicies(policyDirectory) {
    if (!(0, fs_1.existsSync)(policyDirectory)) {
        return [];
    }
    return (0, fs_1.readdirSync)(policyDirectory)
        .filter((fileName) => fileName.endsWith('.json'))
        .flatMap((fileName) => {
        const filePath = (0, path_1.join)(policyDirectory, fileName);
        const content = JSON.parse((0, fs_1.readFileSync)(filePath, 'utf8'));
        return Array.isArray(content) ? content : [content];
    })
        .sort((left, right) => right.priority - left.priority);
}
function evaluatePolicies(request, policies) {
    const matchedPolicies = [];
    const reasons = [];
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


/***/ }),
/* 18 */
/***/ ((module) => {

module.exports = require("fs");

/***/ }),
/* 19 */
/***/ ((module) => {

module.exports = require("path");

/***/ }),
/* 20 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(21), exports);


/***/ }),
/* 21 */
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
/* 22 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(23), exports);


/***/ }),
/* 23 */
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.evaluateRbac = evaluateRbac;
const ROLE_ACTIONS = {
    employee: ['read'],
    manager: ['read', 'write'],
    admin: ['read', 'write', 'delete'],
};
const FORBIDDEN_ROLE_COMBINATIONS = [
    ['finance-approver', 'finance-auditor'],
    ['hr-admin', 'hr-auditor'],
];
function evaluateRbac(request, enforceSod) {
    const reasons = [];
    const allowedActions = ROLE_ACTIONS[request.subject.role] ?? [];
    if (!allowedActions.includes(request.action)) {
        reasons.push(`role ${request.subject.role} cannot perform ${request.action}`);
    }
    if (enforceSod && request.subject.activeRoles?.length) {
        for (const [leftRole, rightRole] of FORBIDDEN_ROLE_COMBINATIONS) {
            if (request.subject.activeRoles.includes(leftRole) && request.subject.activeRoles.includes(rightRole)) {
                reasons.push(`separation of duties violated by ${leftRole} and ${rightRole}`);
            }
        }
    }
    return { allowed: reasons.length === 0, reasons };
}


/***/ }),
/* 24 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(25), exports);


/***/ }),
/* 25 */
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
/* 26 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(27), exports);


/***/ }),
/* 27 */
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
/* 28 */
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
    authorize(body) {
        return this.appService.authorize(body);
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
    (0, common_1.Post)('authorize'),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", void 0)
], AppController.prototype, "authorize", null);
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
    const config = (0, shared_config_1.readRuntimeConfig)('policy-pdp');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);
    await app.listen(config.port);
    common_1.Logger.log(`policy-pdp listening on http://localhost:${config.port}/${globalPrefix}`);
}
bootstrap();

})();

/******/ })()
;
//# sourceMappingURL=main.js.map