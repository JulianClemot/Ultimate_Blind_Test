import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

/**
 * Text for an error: the translation of the server's error code when we have one (the server
 * only speaks English), else the message it sent.
 */
const errorText = (error: unknown): string => {
  if (!(error instanceof Error)) return i18n.t('common.somethingWentWrong');
  const code = (error as { code?: unknown }).code;
  const key = `errors.${String(code)}`;
  return typeof code === 'string' && i18n.exists(key) ? i18n.t(key) : error.message;
};

export const ErrorMessage = ({ error }: { error: unknown }) => {
  useTranslation(); // re-render when the language changes
  return error ? (
    <p role="alert" className="text-sm text-destructive">
      {errorText(error)}
    </p>
  ) : null;
};
