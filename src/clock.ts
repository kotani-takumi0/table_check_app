let offsetMs = 0;
export function now(): number { return Date.now() + offsetMs; }
export function setServerOffset(ms: number): void { offsetMs = ms; }
