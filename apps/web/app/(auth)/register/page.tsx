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

const ORG_TYPES = [
  { value: 'consulting', label: 'Consulting Firm' },
  { value: 'corporate', label: 'Corporate / Issuer' },
  { value: 'regulator', label: 'Regulator' },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth, locale } = useAuthStore();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    orgName: '',
    orgType: 'corporate' as 'consulting' | 'corporate' | 'regulator',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
        org: { id: string; name: string; type: 'consulting' | 'corporate' | 'regulator'; plan: 'starter' | 'professional' | 'enterprise' };
      }>('/auth/register', form);

      setAuth(res.user, res.token, res.org);
      router.push('/engagements');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex items-center gap-2">
            <span className="text-3xl" role="img" aria-label="leaf">
              🌿
            </span>
            <span className="text-2xl font-bold text-zinc-100">Merris</span>
          </div>
          <CardTitle className="text-xl">{t(locale, 'auth.register')}</CardTitle>
          <CardDescription>{t(locale, 'auth.registerSubtitle')}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-600/10 px-3 py-2 text-sm text-red-400">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">{t(locale, 'auth.name')}</Label>
              <Input
                id="name"
                placeholder="Ahmed Al-Rashid"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-email">{t(locale, 'auth.email')}</Label>
              <Input
                id="reg-email"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-password">{t(locale, 'auth.password')}</Label>
              <Input
                id="reg-password"
                type="password"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgName">{t(locale, 'auth.orgName')}</Label>
              <Input
                id="orgName"
                placeholder="Acme Consulting"
                value={form.orgName}
                onChange={(e) => updateField('orgName', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgType">{t(locale, 'auth.orgType')}</Label>
              <select
                id="orgType"
                value={form.orgType}
                onChange={(e) => updateField('orgType', e.target.value)}
                className="flex h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-zinc-200 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400"
              >
                {ORG_TYPES.map((ot) => (
                  <option key={ot.value} value={ot.value}>
                    {ot.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t(locale, 'common.loading') : t(locale, 'auth.register')}
            </Button>
            <p className="text-center text-sm text-zinc-400">
              {t(locale, 'auth.hasAccount')}{' '}
              <Link href="/login" className="text-emerald-400 hover:underline">
                {t(locale, 'auth.login')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
