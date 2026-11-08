import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

import i18n from '@/i18n';

// Tests assert English wording whatever the language of the machine running them.
beforeEach(async () => {
  await i18n.changeLanguage('en');
});

afterEach(() => cleanup());
