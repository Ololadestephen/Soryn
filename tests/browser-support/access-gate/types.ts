export interface AccessFixtureDriver {
  releaseSignature(): void;
  events: string[];
}
declare global {
  interface Window {
    accessFixture: AccessFixtureDriver;
  }
}
