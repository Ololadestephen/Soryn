export interface AccessFixtureDriver {
  releaseSignature(): void;
  rejectSignature(): void;
  events: string[];
}
declare global {
  interface Window {
    accessFixture: AccessFixtureDriver;
  }
}
