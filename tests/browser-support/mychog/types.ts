/** Only initialized by the labelled local component browser fixture. */
export interface MyChogFixture {
  wallet: string;
  headers: Record<string, string>;
  events: string[];
  connected?: boolean;
}
declare global {
  interface Window {
    mychogFixture: MyChogFixture;
  }
}
