'use client'

import { useQuery } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MetricCard } from '@/components/shared/metric-card'
import { ErrorState, MetricCardSkeleton } from '@/components/shared/states'
import { getHealth, getMeta } from '@/lib/api'
import { fmtInt } from '@/lib/format'

function Flag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={ok ? 'success' : 'muted'} className="gap-1">
        {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        {ok ? 'yes' : 'no'}
      </Badge>
    </div>
  )
}

/**
 * Live system snapshot for the home page — demonstrates the data layer end to
 * end: typed api client (`getHealth` + `getMeta`), TanStack Query, MetricCard,
 * and graceful offline/error states.
 */
export function SystemStatus() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => getHealth(signal),
    refetchInterval: 15_000,
    retry: false,
  })
  const meta = useQuery({
    queryKey: ['meta'],
    queryFn: ({ signal }) => getMeta(signal),
    retry: false,
  })

  if (health.isError) {
    return (
      <ErrorState error={health.error} onRetry={() => void health.refetch()} />
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {meta.isPending ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : meta.isError ? (
          <div className="col-span-2 lg:col-span-4">
            <ErrorState
              error={meta.error}
              onRetry={() => void meta.refetch()}
            />
          </div>
        ) : (
          <>
            <MetricCard
              label="Documents"
              value={fmtInt(meta.data.documents)}
              sublabel="Akoma Ntoso laws"
            />
            <MetricCard
              label="Articles"
              value={fmtInt(meta.data.articles)}
              sublabel="parsed & indexed"
              accent="info"
            />
            <MetricCard
              label="Benchmark"
              value={fmtInt(meta.data.benchmark_questions)}
              sublabel="AlgerianLegalBench v3"
              accent="gold"
            />
            <MetricCard
              label="KG triples"
              value={fmtInt(meta.data.kg_triples ?? 0)}
              sublabel="RDF knowledge graph"
              accent="success"
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Backend status</CardTitle>
        </CardHeader>
        <CardContent>
          {health.isPending ? (
            <p className="text-sm text-muted-foreground">Checking…</p>
          ) : (
            <div className="grid gap-x-8 sm:grid-cols-2">
              <div className="divide-y divide-border">
                <Flag label="offline mode" ok={health.data.offline_mode} />
                <Flag label="indices present" ok={health.data.indices_present} />
                <Flag label="dataset present" ok={health.data.dataset_present} />
              </div>
              <div className="divide-y divide-border">
                <Flag
                  label="predictions present"
                  ok={health.data.predictions_present}
                />
                <Flag label="corpus ready" ok={health.data.corpus_ready} />
                <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">llm</span>
                  <Badge variant="outline" className="font-mono">
                    {health.data.llm}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
