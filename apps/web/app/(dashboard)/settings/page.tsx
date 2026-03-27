'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/lib/store';
import { t } from '@/lib/i18n';

export default function SettingsPage() {
  const { user, org, locale, setLocale } = useAuthStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">{t(locale, 'nav.settings')}</h1>
        <p className="mt-1 text-sm text-zinc-400">Manage your profile, organization, and preferences.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t(locale, 'auth.name')}</Label>
              <Input defaultValue={user?.name ?? ''} />
            </div>
            <div className="space-y-2">
              <Label>{t(locale, 'auth.email')}</Label>
              <Input defaultValue={user?.email ?? ''} type="email" />
            </div>
          </div>
          <Button>{t(locale, 'common.save')}</Button>
        </CardContent>
      </Card>

      {/* Organization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
          <CardDescription>Organization settings and branding.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t(locale, 'auth.orgName')}</Label>
              <Input defaultValue={org?.name ?? ''} />
            </div>
            <div className="space-y-2">
              <Label>{t(locale, 'auth.orgType')}</Label>
              <Input defaultValue={org?.type ?? ''} readOnly />
            </div>
          </div>
          <Button>{t(locale, 'common.save')}</Button>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t(locale, 'common.language')}</CardTitle>
          <CardDescription>Choose your preferred display language.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            variant={locale === 'en' ? 'default' : 'outline'}
            onClick={() => setLocale('en')}
          >
            {t(locale, 'common.english')}
          </Button>
          <Button
            variant={locale === 'ar' ? 'default' : 'outline'}
            onClick={() => setLocale('ar')}
          >
            {t(locale, 'common.arabic')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
