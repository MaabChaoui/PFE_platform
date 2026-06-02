'use client'

import { useEffect, useState } from 'react'
import { getHealth } from '../lib/api'
import type { HealthResponse } from '../lib/api'

function Pill({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${
        ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {ok ? 'yes' : 'no'}
    </span>
  )
}

export default function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setOffline(true))
  }, [])

  return (
    <div>
      <h1 className="text-3xl font-bold text-indigo-900 mb-2">
        LexAlgeria — pipeline visualizer
      </h1>
      <p className="text-gray-500 mb-8">
        This page will become the interactive AKN-RLM pipeline visualizer (S10).
      </p>

      <div className="bg-white rounded-lg border border-gray-200 p-5 max-w-sm shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
          Backend status
        </h2>

        {offline ? (
          <p className="text-red-600 font-mono text-sm">backend offline</p>
        ) : !health ? (
          <p className="text-gray-400 text-sm animate-pulse">checking…</p>
        ) : (
          <table className="text-sm w-full">
            <tbody>
              {[
                { label: 'status', value: <span className="font-mono">{health.status}</span> },
                { label: 'offline_mode', value: <Pill ok={health.offline_mode} /> },
                { label: 'indices_present', value: <Pill ok={health.indices_present} /> },
                { label: 'dataset_present', value: <Pill ok={health.dataset_present} /> },
                { label: 'predictions_present', value: <Pill ok={health.predictions_present} /> },
                { label: 'llm', value: <span className="font-mono text-gray-600">{health.llm}</span> },
              ].map(({ label, value }) => (
                <tr key={label}>
                  <td className="pr-4 py-0.5 text-gray-500">{label}</td>
                  <td className="py-0.5">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
