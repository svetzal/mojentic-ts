export function contractIdentity(): {
  readonly contract: string;
  readonly verifierSha256: string;
};
export function verify(api: typeof import('../src/index')): Promise<void>;
