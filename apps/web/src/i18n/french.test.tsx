import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { describeRules } from '@/shared/lib/describeRules';
import { formatElapsed } from '@/shared/lib/time';
import { catalog } from '@/test/fixtures';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher';

import i18n from './index';

describe('French', () => {
  beforeEach(() => i18n.changeLanguage('fr'));
  afterEach(() => i18n.changeLanguage('en'));

  it('words the rules of a round', () => {
    const lines = describeRules({ ...catalog.presets.classic, songCount: 1, titlePoints: 1 });
    expect(lines[0]).toBe('1 morceau, 30 s pour répondre à chacun');
    expect(lines).toContain("Trouvez le titre (1 point) et l'artiste (1 point)");
  });

  it('uses the decimal comma', () => {
    expect(formatElapsed(1234)).toBe('1,234 s');
  });

  it('translates server errors by code, and keeps unknown messages', () => {
    const known = Object.assign(new Error('Game not found'), { code: 'GAME_NOT_FOUND' });
    const unknown = Object.assign(new Error('Server unavailable'), { code: 'INTERNAL_ERROR' });
    const { rerender } = render(<ErrorMessage error={known} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Partie introuvable');
    rerender(<ErrorMessage error={unknown} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Server unavailable');
  });

  it('switches language from the selector, and updates the page language', async () => {
    await i18n.changeLanguage('en');
    render(<LanguageSwitcher />);
    await userEvent.selectOptions(screen.getByLabelText('Language'), 'fr');
    expect(i18n.resolvedLanguage).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(screen.getByLabelText('Langue')).toHaveValue('fr');
  });
});
