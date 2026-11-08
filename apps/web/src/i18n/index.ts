import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import { en } from './locales/en';
import { fr } from './locales/fr';

export const LANGUAGES = ['en', 'fr'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Each language written in itself, for the language switcher. */
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  en: 'English',
  fr: 'Français',
};

const syncDocumentLanguage = (language: string) => {
  document.documentElement.lang = language;
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, fr: { translation: fr } },
    supportedLngs: LANGUAGES,
    nonExplicitSupportedLngs: true,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  });

i18n.on('languageChanged', syncDocumentLanguage);
syncDocumentLanguage(i18n.resolvedLanguage ?? 'en');

/** The language in use, narrowed to the ones we ship. */
export const currentLanguage = (): Language =>
  LANGUAGES.find((language) => language === i18n.resolvedLanguage) ?? 'en';

export default i18n;
