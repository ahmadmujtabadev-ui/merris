'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MerrisButton } from '@/components/merris/button';
import { MerrisCard } from '@/components/merris/card';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { t } from '@/lib/i18n';

const inputLightClasses =
  'bg-white border-merris-border-medium text-merris-text placeholder:text-merris-text-muted focus-visible:ring-merris-primary';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, locale } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleMicrosoftLogin = () => {
    const clientId = 'df5eabf8-0da1-46db-b1b7-22addbbcfc7b';
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
    const scope = encodeURIComponent('openid profile email');
    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}&response_mode=query`;
    window.location.href = url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post<{
        user: {
          id: string;
          email: string;
          name: string;
          orgId: string;
          role: string;
          preferences: {
            language: 'en' | 'ar';
            timezone: string;
            notifications: { email: boolean; inApp: boolean; teams: boolean };
          };
        };
        token: string;
        organization: { id: string; name: string; type: 'consulting' | 'corporate' | 'regulator'; plan: 'starter' | 'professional' | 'enterprise' };
      }>('/auth/login', { email, password });

      setAuth(res.user, res.token, res.organization);
      router.push('/intelligence');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-merris-bg px-4">
      <MerrisCard className="w-full max-w-[400px] bg-white">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex items-center justify-center gap-2">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-merris-primary"
              aria-label="Merris"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="font-display text-2xl font-semibold text-merris-text">Merris</span>
          </div>
          <h1 className="font-display text-xl font-semibold text-merris-text">Sign in to Merris</h1>
          <p className="mt-1 text-sm text-merris-text-muted">{t(locale, 'auth.loginSubtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-merris-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-merris-text">
              {t(locale, 'auth.email')}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputLightClasses}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-merris-text">
              {t(locale, 'auth.password')}
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={inputLightClasses}
            />
          </div>
          <MerrisButton type="submit" variant="primary" disabled={loading} className="w-full justify-center">
            {loading ? t(locale, 'common.loading') : t(locale, 'auth.login')}
          </MerrisButton>

          <div className="relative flex items-center gap-3">
            <div className="h-px flex-1 bg-merris-border-medium" />
            <span className="text-xs text-merris-text-muted">or</span>
            <div className="h-px flex-1 bg-merris-border-medium" />
          </div>

          <button
            type="button"
            onClick={handleMicrosoftLogin}
            className="flex w-full items-center justify-center gap-3 rounded-merris border border-merris-border-medium bg-white px-4 py-2.5 text-sm font-medium text-merris-text shadow-sm transition hover:bg-merris-bg"
          >
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            Sign in with Microsoft
          </button>

          <p className="text-center text-sm text-merris-text-muted">
            {t(locale, 'auth.noAccount')}{' '}
            <Link href="/register" className="text-merris-primary hover:underline">
              {t(locale, 'auth.register')}
            </Link>
          </p>
        </form>
      </MerrisCard>
    </div>
  );
}
