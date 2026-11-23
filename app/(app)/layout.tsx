import { AppShell } from '@/components/layout/AppShell'
import { InstallBanner } from '@/components/pwa/InstallBanner'
import { I18nProvider } from '@/components/providers/I18nProvider'
import { getMessages } from '@/lib/i18n'
import { dirFor } from '@/lib/i18n/config'
import { getServerI18n } from '@/lib/i18n/server'

// App section is localized (8 languages, RTL for Hebrew/Yiddish). Public SEO pages stay static and are not affected.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getServerI18n()
  return (
    <I18nProvider locale={locale} messages={getMessages(locale)}>
      <div dir={dirFor(locale)} lang={locale}>
        <AppShell>{children}</AppShell>
        <InstallBanner />
      </div>
    </I18nProvider>
  )
}
