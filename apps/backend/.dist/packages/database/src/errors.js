"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantScopeError = exports.EntityNotFoundError = exports.RepositoryError = void 0;
exports.assertTenantId = assertTenantId;
class RepositoryError extends Error {
    constructor(message, code = "REPOSITORY_ERROR") {
        super(message);
        this.code = code;
        this.name = "RepositoryError";
    }
}
exports.RepositoryError = RepositoryError;
class EntityNotFoundError extends RepositoryError {
    constructor(entity, detail = "") {
        super(`${entity} not found${detail ? `: ${detail}` : ""}`, "ENTITY_NOT_FOUND");
        this.name = "EntityNotFoundError";
    }
}
exports.EntityNotFoundError = EntityNotFoundError;
class TenantScopeError extends RepositoryError {
    constructor(message = "tenant_id is required") {
        super(message, "TENANT_SCOPE_ERROR");
        this.name = "TenantScopeError";
    }
}
exports.TenantScopeError = TenantScopeError;
function assertTenantId(tenantId) {
    if (!tenantId?.trim()) {
        throw new TenantScopeError();
    }
}
