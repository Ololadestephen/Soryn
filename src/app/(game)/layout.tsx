import { GuestProvider } from "../../components/guest/GuestProvider";
import { AppShell } from "../../components/site/AppShell";

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GuestProvider>
      <AppShell>{children}</AppShell>
    </GuestProvider>
  );
}
