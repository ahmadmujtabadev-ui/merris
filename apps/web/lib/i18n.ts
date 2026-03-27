import en from '../messages/en.json';
import ar from '../messages/ar.json';

export type Locale = 'en' | 'ar';

const messages: Record<Locale, typeof en> = { en, ar };

export function getMessages(locale: Locale) {
  return messages[locale];
}

export function t(locale: Locale, path: string): string {
  const parts = path.split('.');
  let current: unknown = messages[locale];
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  return typeof current === 'string' ? current : path;
}
