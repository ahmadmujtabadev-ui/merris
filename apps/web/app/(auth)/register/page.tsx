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

const ORG_TYPES = [
  { value: 'consulting', label: 'Consulting Firm' },
  { value: 'corporate', label: 'Corporate / Issuer' },
  { value: 'regulator', label: 'Regulator' },
] as const;

const inputLightClasses =
  'bg-white border-merris-border-medium text-merris-text placeholder:text-merris-text-muted focus-visible:ring-merris-primary';

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
        organization: { id: string; name: string; type: 'consulting' | 'corporate' | 'regulator'; plan: 'starter' | 'professional' | 'enterprise' };
      }>('/auth/register', form);

      setAuth(res.user, res.token, res.organization);
      router.push('/intelligence');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-merris-bg px-4 py-8">
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
          <h1 className="font-display text-xl font-semibold text-merris-text">Create your Merris account</h1>
          <p className="mt-1 text-sm text-merris-text-muted">{t(locale, 'auth.registerSubtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-merris-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-merris-text">
              {t(locale, 'auth.name')}
            </Label>
            <Input
              id="name"
              placeholder="Ahmed Al-Rashid"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              className={inputLightClasses}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-email" className="text-merris-text">
              {t(locale, 'auth.email')}
            </Label>
            <Input
              id="reg-email"
              type="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              required
              className={inputLightClasses}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-password" className="text-merris-text">
              {t(locale, 'auth.password')}
            </Label>
            <Input
              id="reg-password"
              type="password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              required
              minLength={8}
              className={inputLightClasses}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="orgName" className="text-merris-text">
              {t(locale, 'auth.orgName')}
            </Label>
            <Input
              id="orgName"
              placeholder="Acme Consulting"
              value={form.orgName}
              onChange={(e) => updateField('orgName', e.target.value)}
              required
              className={inputLightClasses}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="orgType" className="text-merris-text">
              {t(locale, 'auth.orgType')}
            </Label>
            <select
              id="orgType"
              value={form.orgType}
              onChange={(e) => updateField('orgType', e.target.value)}
              className="flex h-9 w-full rounded-md border border-merris-border-medium bg-white px-3 py-1 text-sm text-merris-text shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-merris-primary"
            >
              {ORG_TYPES.map((ot) => (
                <option key={ot.value} value={ot.value}>
                  {ot.label}
                </option>
              ))}
            </select>
          </div>
          <MerrisButton type="submit" variant="primary" disabled={loading} className="w-full justify-center">
            {loading ? t(locale, 'common.loading') : t(locale, 'auth.register')}
          </MerrisButton>
          <p className="text-center text-sm text-merris-text-muted">
            {t(locale, 'auth.hasAccount')}{' '}
            <Link href="/login" className="text-merris-primary hover:underline">
              {t(locale, 'auth.login')}
            </Link>
          </p>
        </form>
      </MerrisCard>
    </div>
  );
}
