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
const app_controller_1 = __webpack_require__(14);
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
const shared_logging_1 = __webpack_require__(10);
const shared_config_1 = __webpack_require__(3);
const shared_utils_1 = __webpack_require__(12);
let AppService = class AppService {
    constructor() {
        this.config = (0, shared_config_1.readRuntimeConfig)('audit-log');
        this.logger = new shared_logging_1.StructuredLogger('audit-log');
        this.events = [];
    }
    getHealth() {
        return {
            service: this.config.serviceName,
            profile: this.config.securityProfile,
            status: 'ok',
            count: this.events.length,
            at: (0, shared_utils_1.nowIso)(),
        };
    }
    getEvents(limit) {
        const size = Math.max(1, Number(limit || 50));
        return this.events.slice(-size).reverse();
    }
    appendEvent(event) {
        this.events.push(event);
        this.logger.log(event);
        return { accepted: true, size: this.events.length };
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
/* 12 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(4);
tslib_1.__exportStar(__webpack_require__(13), exports);


/***/ }),
/* 13 */
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
/* 14 */
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
    getEvents(limit) {
        return this.appService.getEvents(limit);
    }
    appendEvent(event) {
        return this.appService.appendEvent(event);
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
    (0, common_1.Get)('events'),
    tslib_1.__param(0, (0, common_1.Query)('limit')),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", void 0)
], AppController.prototype, "getEvents", null);
tslib_1.__decorate([
    (0, common_1.Post)('events'),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [Object]),
    tslib_1.__metadata("design:returntype", void 0)
], AppController.prototype, "appendEvent", null);
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
    const config = (0, shared_config_1.readRuntimeConfig)('audit-log');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);
    await app.listen(config.port);
    common_1.Logger.log(`audit-log listening on http://localhost:${config.port}/${globalPrefix}`);
}
bootstrap();

})();

/******/ })()
;
//# sourceMappingURL=main.js.map