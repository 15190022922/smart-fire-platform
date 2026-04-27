export class RepositoryError extends Error {
  constructor(message: string, readonly code = "REPOSITORY_ERROR") {
    super(message);
    this.name = "RepositoryError";
  }
}

export class EntityNotFoundError extends RepositoryError {
  constructor(entity: string, detail = "") {
    super(`${entity} not found${detail ? `: ${detail}` : ""}`, "ENTITY_NOT_FOUND");
    this.name = "EntityNotFoundError";
  }
}

export class TenantScopeError extends RepositoryError {
  constructor(message = "tenant_id is required") {
    super(message, "TENANT_SCOPE_ERROR");
    this.name = "TenantScopeError";
  }
}

export function assertTenantId(tenantId: string | null | undefined): asserts tenantId is string {
  if (!tenantId?.trim()) {
    throw new TenantScopeError();
  }
}
