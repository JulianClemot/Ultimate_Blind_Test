import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useSessionStore } from '@/shared/session/sessionStore';
import { buttonVariants } from '@/shared/ui/buttonVariants';

/** The party this tab is hosting, if the host walked away from it without ending it. */
export const ResumeHosting = () => {
  const { t } = useTranslation();
  const host = useSessionStore((s) => s.host);
  if (!host) return null;

  return (
    <section
      aria-label={t('home.hostingTitle')}
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{t('home.hostingTitle')}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {host.gameName ?? t('home.hostingUnnamed')}
          {host.code && ` · ${t('home.hostingCode', { code: host.code })}`}
        </span>
      </span>
      <Link to={`/host/${host.gameId}`} className={buttonVariants()}>
        {t('home.backToGame')}
      </Link>
    </section>
  );
};
