'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { t } from '@/lib/i18n';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, locale } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        org: { id: string; name: string; type: 'consulting' | 'corporate' | 'regulator'; plan: 'starter' | 'professional' | 'enterprise' };
      }>('/auth/login', { email, password });

      setAuth(res.user, res.token, res.org);
      router.push('/engagements');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex items-center gap-2">
            <span className="text-3xl" role="img" aria-label="leaf">
              🌿
            </span>
            <span className="text-2xl font-bold text-zinc-100">Merris</span>
          </div>
          <CardTitle className="text-xl">{t(locale, 'auth.login')}</CardTitle>
          <CardDescription>{t(locale, 'auth.loginSubtitle')}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-600/10 px-3 py-2 text-sm text-red-400">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t(locale, 'auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t(locale, 'auth.password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t(locale, 'common.loading') : t(locale, 'auth.login')}
            </Button>
            <p className="text-center text-sm text-zinc-400">
              {t(locale, 'auth.noAccount')}{' '}
              <Link href="/register" className="text-emerald-400 hover:underline">
                {t(locale, 'auth.register')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
