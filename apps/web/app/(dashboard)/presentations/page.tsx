'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store';
import { t } from '@/lib/i18n';

const DEMO_DECKS = [
  { id: 'pres-1', title: 'Board ESG Pack Q4', type: 'board_pack', slides: 18, status: 'draft' },
  { id: 'pres-2', title: 'Investor ESG Summary', type: 'investor_presentation', slides: 24, status: 'final' },
];

export default function PresentationsPage() {
  const { locale } = useAuthStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{t(locale, 'nav.presentations')}</h1>
          <p className="mt-1 text-sm text-zinc-400">AI-generated ESG presentations and board packs.</p>
        </div>
        <Button>Generate Deck</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {DEMO_DECKS.map((deck) => (
          <Card key={deck.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{deck.title}</CardTitle>
                <Badge variant={deck.status === 'draft' ? 'secondary' : 'default'}>
                  {deck.status}
                </Badge>
              </div>
              <CardDescription>
                {deck.type.replace(/_/g, ' ')} &middot; {deck.slides} slides
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">
                Open
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
