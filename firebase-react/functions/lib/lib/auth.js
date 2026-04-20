"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.partnerIdOf = exports.isOps = exports.requireAuth = void 0;
const requireAuth = async (...args) => ({ uid: "mock", email: "mock@mock.com" });
exports.requireAuth = requireAuth;
const isOps = (auth) => true;
exports.isOps = isOps;
const partnerIdOf = (auth) => "partner_1";
exports.partnerIdOf = partnerIdOf;
//# sourceMappingURL=auth.js.map