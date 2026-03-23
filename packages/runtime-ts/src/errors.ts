export class GovernanceViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GovernanceViolation";
  }
}

export class ToolBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolBlockedError";
  }
}

export class KernelRpcError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "KernelRpcError";
    this.code = code;
  }
}
