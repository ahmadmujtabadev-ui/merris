'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('Microsoft login was cancelled or failed.');
      setStatus('error');
      return;
    }

    if (!code) {
      setError('No authorization code received.');
      setStatus('error');
      return;
    }

    const exchange = async () => {
      try {
        const res = await api.post<{
          user: { id: string; email: string; name: string; orgId: string; role: string; preferences: any };
          token: string;
          organization: { id: string; name: string; type: any; plan: any };
        }>('/auth/microsoft/callback', {
          code,
          redirectUri: `${window.location.origin}/auth/callback`,
        });

        setAuth(res.user, res.token, res.organization);
        router.push('/intelligence');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication failed');
        setStatus('error');
      }
    };

    exchange();
  }, [searchParams, setAuth, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-merris-bg">
      <div className="text-center">
        {status === 'loading' ? (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-merris-primary border-t-transparent" />
            <p className="text-sm text-merris-text-muted">Signing you in with Microsoft…</p>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-red-600">{error}</p>
            <a href="/login" className="text-sm text-merris-primary hover:underline">Back to login</a>
          </>
        )}
      </div>
    </div>
  );
}
