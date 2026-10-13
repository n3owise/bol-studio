import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, ArrowLeft, BarChart3 } from 'lucide-react';
import { request } from '../lib/api';

type Provider = { provider: string; status: string; message: string; missing?: string[]; metrics: Record<string, number | null>; rows: Record<string, unknown>[] };
type Overview = { days: number; updatedAt: string; providers: Provider[]; links: Record<string, string> };
const names: Record<string, string> = { vercel: 'Vercel Analytics', posthog: 'PostHog', sentry: 'Sentry', supabase: 'Supabase' };
const metricNames: Record<string, string> = { visitors: 'Visitors', pageviews: 'Page views', sessions: 'Sessions', average_session_seconds: 'Average session · seconds', unresolved_issues_shown: 'Unresolved issues shown' };

export function AdminAnalytics() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const access = await request<{ allowed: boolean; userId: string }>('/admin/access');
      setAccountId(access.userId);
      if (!access.allowed) throw new Error('This account is not authorized for admin analytics.');
      setData(await request<Overview>(`/admin/analytics?days=${days}`)); }
    catch (failure) { setData(null); setError((failure as Error).message); }
    finally { setLoading(false); }
  }, [days]);
  useEffect(() => { void load(); }, [load]);
  return <main className="admin-analytics">
    <header className="admin-header">
      <a href="/" className="button secondary"><ArrowLeft size={15} />Back to studio</a>
      <div><h1><BarChart3 size={22} />Admin analytics</h1><p>Traffic, product usage and reliability in one private overview.</p></div>
      <div className="admin-actions"><label>Period <select value={days} disabled={loading} onChange={event => setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select></label>
        <button type="button" className="button secondary" disabled={loading} onClick={() => void load()}><RefreshCw size={15} />{loading ? 'Loading…' : 'Refresh'}</button></div>
    </header>
    {error && <div className="admin-error" role="alert"><p>{error}</p>{accountId && <p>Your verified account ID: <code>{accountId}</code></p>}</div>}
    {data && <>
      <nav className="admin-service-links" aria-label="Service dashboards">
        {Object.entries(data.links).map(([provider, url]) => <a href={url} key={provider} target="_blank" rel="noopener noreferrer" className="button secondary">{names[provider]}<ExternalLink size={14} /></a>)}
      </nav>
      <p className="admin-update">Updated {new Date(data.updatedAt).toLocaleString()} · Provider results are cached for up to one minute. Analytics starts collecting after activation; past visits cannot be recovered.</p>
      <div className="admin-provider-grid">
        {data.providers.map(provider => <section className="admin-provider-card" key={provider.provider}>
          <header><h2>{names[provider.provider]}</h2><span className={`admin-status ${provider.status}`}>{provider.status === 'connected' ? 'Connected' : provider.status === 'setup_needed' ? 'Setup needed' : 'Unavailable'}</span></header>
          <p>{provider.message}</p>
          {provider.missing && <details><summary>Required configuration</summary><ul>{provider.missing.map(key => <li key={key}><code>{key}</code></li>)}</ul></details>}
          <div className="admin-metrics">{Object.entries(provider.metrics).map(([key, value]) => <div key={key}><span>{metricNames[key] || key}</span><strong>{value === null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong></div>)}</div>
          {provider.status === 'connected' && !Object.keys(provider.metrics).length && !provider.rows.length && <p>No data returned for this period.</p>}
          {!!provider.rows.length && <div className="admin-table-wrap"><table><thead><tr>{Object.keys(provider.rows[0]).filter(key => key !== 'url').map(key => <th key={key}>{key}</th>)}</tr></thead><tbody>{provider.rows.map((row, index) => <tr key={index}>{Object.entries(row).filter(([key]) => key !== 'url').map(([key, value]) => <td key={key}>{key === 'title' && typeof row.url === 'string' ? <a href={row.url} target="_blank" rel="noopener noreferrer">{String(value ?? '—')}</a> : String(value ?? '—')}</td>)}</tr>)}</tbody></table></div>}
          <a className="admin-detail-link" href={data.links[provider.provider]} target="_blank" rel="noopener noreferrer">Open detailed dashboard<ExternalLink size={13} /></a>
        </section>)}
      </div>
      <section className="admin-notes"><h2>What belongs in each dashboard?</h2><p>Vercel: audience and devices. PostHog: product events, funnels, heatmaps and masked recordings. Sentry: errors, affected sessions and stack traces. Supabase: accounts and database administration.</p><p>Errors are not all crashes. Counts from different providers can differ because of consent, blockers, sampling and provider definitions.</p></section>
    </>}
  </main>;
}
