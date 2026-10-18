import Link from "next/link";

export function ArchivedNotice() {
  return (
    <p className="archived-notice" role="note">
      This is the earlier adventure. It is not part of Soryn Story, and its
      records do not change chapter progress.{" "}
      <Link href="/story">Open Story</Link>
    </p>
  );
}
