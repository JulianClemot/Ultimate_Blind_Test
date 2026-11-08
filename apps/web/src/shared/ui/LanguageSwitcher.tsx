import { useTranslation } from 'react-i18next';

import { currentLanguage, LANGUAGE_NAMES, LANGUAGES } from '@/i18n';

/** Picks the interface language; the choice is remembered by the browser. */
export const LanguageSwitcher = () => {
  const { t, i18n } = useTranslation();
  return (
    <select
      aria-label={t('common.language')}
      className="cursor-pointer rounded-full border-2 border-input bg-white/70 px-2 py-1 text-xs"
      value={currentLanguage()}
      onChange={(e) => void i18n.changeLanguage(e.target.value)}
    >
      {LANGUAGES.map((language) => (
        <option key={language} value={language}>
          {LANGUAGE_NAMES[language]}
        </option>
      ))}
    </select>
  );
};
