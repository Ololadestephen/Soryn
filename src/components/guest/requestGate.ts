/** One guest request at a time; readers and mutations share the same lifecycle. */
export interface GuestRequestGate {
  begin: () => boolean;
  end: () => void;
  isMounted: () => boolean;
}
