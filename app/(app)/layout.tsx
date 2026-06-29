import { AppShell } from '@/components/layout/AppShell'
import { InstallBanner } from '@/components/pwa/InstallBanner'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <InstallBanner />
    </>
  )
}
