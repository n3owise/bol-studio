import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, ArrowLeft, BarChart3, Download, Users, Activity, AlertTriangle, Clock, Video, Sparkles, LockKeyhole } from 'lucide-react';
import { request } from '../lib/api';

type Row = Record<string, unknown>;
type Report = { key: string; status: string; rows: Row[] };
type Provider = { provider: string; status: string; message: string; missing?: string[]; metrics: Record<string, number | null>; rows: Row[]; reports?: Report[] };
type Overview = { days: number; updatedAt: string; providers: Provider[]; links: Record<string, string> };
const names: Record<string, string> = { vercel: 'Vercel Analytics', posthog: 'PostHog', sentry: 'Sentry', supabase: 'Supabase' };
const titles: Record<string, string> = { studio_opened: 'Studio opened', signup_completed: 'Sign-up completed', upload_started: 'Upload started', upload_completed: 'Upload completed', upload_failed: 'Upload failed', captions_started: 'Captions started', captions_completed: 'Captions completed', captions_failed: 'Captions failed', export_started: 'Export started', export_completed: 'Export completed', export_failed: 'Export failed', panel_opened: 'Panel opened', preset_selected: 'Preset selected' };
const labels: Record<string, string> = { deviceType: 'Device', country: 'Country', browserName: 'Browser', osName: 'Operating system', requestPath: 'Page', referrerHostname: 'Source', visitors: 'Visitors', pageviews: 'Page views', event: 'Action', count: 'Events', title: 'Issue', users: 'Affected users', lastSeen: 'Last seen', firstSeen: 'First seen', level: 'Severity', panel: 'Panel', preset: 'Preset', samples: 'Completed jobs', average_seconds: 'Average processing time', day: 'Date' };
export function formatDuration(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '—';
  if (value < 60) return `${Math.round(value)}s`;
  const seconds = Math.round(value); return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
function display(key: string, value: unknown) {
  if (value === null || value === undefined || value === '') return key === 'referrerHostname' ? 'Direct / unknown' : '—';
  if (key === 'average_seconds') return formatDuration(value);
  if (['lastSeen','firstSeen','day'].includes(key)) { const date = new Date(String(value)); return Number.isNaN(date.valueOf()) ? String(value) : key === 'day' ? date.toLocaleDateString(undefined,{month:'short',day:'numeric'}) : date.toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); }
  if (key === 'country' && /^[A-Z]{2}$/.test(String(value))) return new Intl.DisplayNames([navigator.language], { type: 'region' }).of(String(value)) || String(value);
  if (key === 'event') return titles[String(value)] || String(value);
  return typeof value === 'number' ? value.toLocaleString(undefined,{maximumFractionDigits:1}) : String(value);
}
function Status({provider}: {provider?: Provider}) {
  const status = provider?.status || 'loading';
  return <span className={`admin-status ${status}`}><span aria-hidden="true" />{status === 'connected' ? 'Connected' : status === 'setup_needed' ? 'Setup needed' : status === 'loading' ? 'Loading' : 'Unavailable'}</span>;
}
function DataTable({rows, columns, caption}: {rows: Row[]; columns: string[]; caption: string}) {
  if (!rows.length) return <p className="admin-empty">No activity recorded for this period.</p>;
  return <div className="admin-table-wrap" tabIndex={0} aria-label={`${caption} table`}><table><caption className="admin-sr-only">{caption}</caption><thead><tr>{columns.map(key=><th scope="col" key={key}>{labels[key] || key}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index}>{columns.map(key=><td key={key}>{key === 'title' && typeof row.url === 'string' ? <a href={row.url} target="_blank" rel="noopener noreferrer">{display(key,row[key])}<ExternalLink size={12} aria-hidden="true"/></a> : display(key,row[key])}</td>)}</tr>)}</tbody></table></div>;
}
function ReportTable({report, columns, caption}: {report?: Report; columns: string[]; caption: string}) {
  if (report?.status === 'unavailable') return <p className="admin-empty">This report is temporarily unavailable. Other reports remain available.</p>;
  return <DataTable rows={report?.rows || []} columns={columns} caption={caption}/>;
}
function ProviderNotice({provider}: {provider?: Provider}) {
  if (!provider || provider.status === 'connected') return null;
  return <div className="admin-inline-notice"><p>{provider.message}</p>{provider.missing && <details><summary>Connection settings</summary><ul>{provider.missing.map(key=><li key={key}><code>{key}</code></li>)}</ul></details>}</div>;
}
function downloadReport(data: Overview) {
  const csvRows: unknown[][] = [['Provider','Section','Metric / action','Value']];
  for (const p of data.providers) {
    csvRows.push([names[p.provider],'Connection','Status',p.status]);
    for (const [key,value] of Object.entries(p.metrics)) csvRows.push([names[p.provider],'Summary',key,value]);
    for (const section of [{key:'activity',rows:p.rows},...(p.reports || [])]) for (const [index,row] of section.rows.entries()) for (const [key,value] of Object.entries(row)) csvRows.push([names[p.provider],`${section.key} / ${index+1}`,key,value]);
  }
  const escape = (value: unknown) => { let text = String(value ?? ''); if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"','""')}"`; };
  const blob = new Blob(['\ufeff'+csvRows.map(row=>row.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob); const anchor=document.createElement('a'); anchor.href=url; anchor.download=`bol-analytics-${data.days}days-${data.updatedAt.slice(0,10)}.csv`; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function AdminAnalytics() {
  const [days,setDays]=useState(7), [data,setData]=useState<Overview|null>(null), [error,setError]=useState(''), [accountId,setAccountId]=useState(''), [loading,setLoading]=useState(true), [audience,setAudience]=useState('deviceType');
  const generation=useRef(0);
  const pinRef=useRef('');
  const [locked,setLocked]=useState(false), [pin,setPin]=useState(''), [pinError,setPinError]=useState('');
  const load=useCallback(async()=>{
    const id=++generation.current; setLoading(true);setError('');
    try { const headers = { 'X-Bol-Admin-Pin': pinRef.current };
      const access=await request<{allowed:boolean;userId:string;unlocked:boolean}>('/admin/access',{headers});
      if(id!==generation.current)return;setAccountId(access.userId);
      if(!access.allowed)throw new Error('This account is not authorized for admin analytics.');
      if (!access.unlocked) { setData(null); setLocked(true); setPinError(pinRef.current ? 'Incorrect PIN. Please try again.' : ''); pinRef.current=''; setPin(''); return; }
      setLocked(false);setPinError('');setPin('');
      const next=await request<Overview>(`/admin/analytics?days=${days}`,{headers}); if(id===generation.current)setData(next);
    } catch(failure) {if(id===generation.current){setData(null);setError((failure as Error).message);}}
    finally {if(id===generation.current)setLoading(false);}
  },[days]);
  useEffect(()=>{void load();return()=>{generation.current++;};},[load]);
  const traffic=data?.providers.find(p=>p.provider==='vercel'), product=data?.providers.find(p=>p.provider==='posthog'), errors=data?.providers.find(p=>p.provider==='sentry');
  const metric=(p:Provider|undefined,key:string)=>p?.status==='connected' && typeof p.metrics[key]==='number' ? p.metrics[key] : null;
  const eventCount=(key:string)=>product?.status==='connected' ? Number(product.rows.find(r=>r.event===key)?.count||0) : null;
  const report=(p:Provider|undefined,key:string)=>p?.reports?.find(r=>r.key===key);
  const trend=(report(traffic,'day')?.rows||[]).slice().sort((a,b)=>String(a.day).localeCompare(String(b.day)));
  const maximum=Math.max(1,...trend.map(r=>Number(r.pageviews)||0));
  const audienceReport=audience==='deviceType'?{status:traffic?.status,rows:traffic?.rows||[]}:report(traffic,audience);
  const activePeriod=data?.days || days;
  const stats=[{label:'Visitors',value:metric(traffic,'visitors'),icon:Users,note:'Vercel · unique visitors'}, {label:'Page views',value:metric(traffic,'pageviews'),icon:BarChart3,note:'Vercel · production traffic'}, {label:'Sessions',value:metric(product,'sessions'),icon:Activity,note:'PostHog · consented sessions'}, {label:'Average session',value:formatDuration(metric(product,'average_session_seconds')),icon:Clock,note:'Time between recorded events'}, {label:'Caption jobs completed',value:eventCount('captions_completed'),icon:Sparkles,note:'PostHog · recorded completions'}, {label:'Export jobs completed',value:eventCount('export_completed'),icon:Video,note:'PostHog · recorded completions'}];
  return <main className="admin-analytics" aria-busy={loading}>
    <a className="admin-skip" href="#admin-content">Skip to analytics</a>
    <header className="admin-header"><div className="admin-brand-row"><a href="/" className="admin-back"><ArrowLeft size={16}/>Studio</a><span className="admin-private">Private workspace</span></div>
      <div className="admin-title-row"><div><p className="admin-eyebrow">Bol Studio / Overview</p><h1>Understand your studio.</h1><p>Audience, product activity and reliability, together.</p></div>
      <div className="admin-actions"><label className="admin-sr-only" htmlFor="admin-period">Period</label><select id="admin-period" value={days} disabled={loading} onChange={e=>setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select><button className="button secondary" disabled={loading} onClick={()=>void load()}><RefreshCw size={15} className={loading?'admin-spinning':''}/>{loading?'Updating…':'Refresh'}</button><button className="button secondary" disabled={!data||loading} onClick={()=>data&&downloadReport(data)}><Download size={15}/>Export CSV</button></div></div>
    </header>
    <div role="status" className="admin-update">{loading ? 'Fetching reports from your connected services…' : data ? `Last updated ${new Date(data.updatedAt).toLocaleString()} · Last ${activePeriod} days` : 'Reports are available to authorized administrators.'}</div>
    {locked && !error && <section className="admin-pin-gate" aria-labelledby="admin-pin-title">
      <div className="admin-pin-icon"><LockKeyhole size={24}/></div><p className="admin-eyebrow">Owner access only</p><h2 id="admin-pin-title">Unlock your analytics</h2><p>Enter your security PIN to view this private dashboard.</p>
      <form onSubmit={e=>{e.preventDefault();pinRef.current=pin;void load();}}>
        <label htmlFor="admin-pin">Security PIN</label><input id="admin-pin" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" maxLength={4} minLength={4} required value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} aria-describedby={pinError?'admin-pin-error':undefined} aria-invalid={!!pinError} disabled={loading}/>
        {pinError&&<p className="admin-pin-error" id="admin-pin-error" role="alert">{pinError}</p>}<button className="button primary" disabled={loading||pin.length!==4}>{loading?'Checking…':'Unlock dashboard'}</button>
      </form><small>Your account and PIN are both required. Nothing is saved in browser storage.</small>
    </section>}
    {error&&<div className="admin-error" role="alert"><strong>Couldn’t load analytics</strong><p>{error}</p>{accountId&&<details><summary>Account access details</summary><code>{accountId}</code></details>}<button className="button secondary" onClick={()=>void load()}>Try again</button></div>}
    {!data&&loading&&!locked&&<div className="admin-skeleton" aria-hidden="true">{Array.from({length:6},(_,i)=><div key={i}/>)}</div>}
    {data&&<div id="admin-content">
      <nav className="admin-service-links" aria-label="Service dashboards">{Object.entries(data.links).map(([key,url])=><a key={key} href={url} target="_blank" rel="noopener noreferrer"><span>{names[key]}<ExternalLink size={12}/></span>{key==='supabase'?<small>Accounts & database</small>:<Status provider={data.providers.find(p=>p.provider===key)}/>}</a>)}</nav>
      <section className="admin-stat-grid" aria-label="Overview metrics">{stats.map(({label,value,icon:Icon,note})=><article className="admin-stat" key={label}><div><span>{label}</span><Icon size={17} aria-hidden="true"/></div><strong>{value===null?'—':typeof value==='number'?value.toLocaleString():value}</strong><small>{note}</small></article>)}</section>
      <div className="admin-main-grid">
        <section className="admin-section admin-traffic"><header><div><p className="admin-eyebrow">Audience</p><h2>Traffic over time</h2></div><Status provider={traffic}/></header><ProviderNotice provider={traffic}/>
          {report(traffic,'day')?.status==='unavailable'?<p className="admin-empty">The daily trend is unavailable. Traffic totals remain available above.</p>:trend.length?<><div className="admin-trend" role="img" aria-label={`Daily page views for the last ${activePeriod} days. Exact values are in the table below.`}>{trend.map((r,i)=><div className="admin-trend-column" title={`${display('day',r.day)}: ${display('pageviews',r.pageviews)} page views`} key={i}><span>{trend.length<=10||i%Math.ceil(trend.length/7)===0?display('pageviews',r.pageviews):''}</span><div className="admin-trend-track"><div style={{height:`${Math.max(0,Number(r.pageviews)/maximum*100)}%`}}/></div><small>{i===0||i===trend.length-1||i%Math.ceil(trend.length/7)===0?display('day',r.day):''}</small></div>)}</div><details className="admin-chart-data"><summary>View daily numbers</summary><DataTable rows={trend} columns={['day','visitors','pageviews']} caption="Daily traffic"/></details></>:<p className="admin-empty">Your traffic trend will appear as visits are recorded.</p>}
        </section>
        <section className="admin-section"><header><div><p className="admin-eyebrow">Breakdown</p><h2>Who’s visiting</h2></div></header><div className="admin-tabs" role="group" aria-label="Audience breakdown">{[['deviceType','Devices'],['country','Countries'],['browserName','Browsers'],['osName','Systems']].map(([key,label])=><button key={key} aria-pressed={audience===key} onClick={()=>setAudience(key)}>{label}</button>)}</div>{audienceReport?.status==='unavailable'?<p className="admin-empty">This breakdown is temporarily unavailable.</p>:<DataTable rows={audienceReport?.rows||[]} columns={[audience,'visitors','pageviews']} caption="Audience breakdown"/>}<p className="admin-footnote">Visitors may appear in more than one category; breakdown counts shouldn’t be added together.</p></section>
        <section className="admin-section"><header><div><p className="admin-eyebrow">Discovery</p><h2>Pages & traffic sources</h2></div></header><h3>Top pages</h3><ReportTable report={report(traffic,'requestPath')} columns={['requestPath','visitors','pageviews']} caption="Top pages"/><h3>Referring websites</h3><ReportTable report={report(traffic,'referrerHostname')} columns={['referrerHostname','visitors']} caption="Referring websites"/></section>
        <section className="admin-section"><header><div><p className="admin-eyebrow">Product</p><h2>From upload to export</h2></div><Status provider={product}/></header><ProviderNotice provider={product}/><div className="admin-table-wrap"><table><caption className="admin-sr-only">Recorded processing outcomes</caption><thead><tr><th scope="col">Workflow</th><th scope="col">Started</th><th scope="col">Completed</th><th scope="col">Failed</th></tr></thead><tbody>{[['upload','Upload'],['captions','Captions'],['export','Export']].map(([key,label])=><tr key={key}><th scope="row">{label}</th>{['started','completed','failed'].map(stage=><td key={stage} className={stage==='failed'&&Number(eventCount(`${key}_${stage}`))>0?'admin-failure':''}>{eventCount(`${key}_${stage}`)??'—'}</td>)}</tr>)}</tbody></table></div><h3>Processing times</h3><ReportTable report={report(product,'processing')} columns={['event','samples','average_seconds']} caption="Processing duration"/><p className="admin-footnote">Consented browser events, not a server job ledger. Session length measures the span of recorded events, not uninterrupted editing time.</p></section>
        <section className="admin-section"><header><div><p className="admin-eyebrow">Usage</p><h2>Popular panels & presets</h2></div></header><ReportTable report={report(product,'features')} columns={['event','panel','preset','count']} caption="Feature usage"/><details className="admin-chart-data"><summary>All tracked workflow events</summary><DataTable rows={product?.rows||[]} columns={['event','count']} caption="Workflow events"/></details><a className="admin-detail-link" href={data.links.posthog} target="_blank" rel="noopener noreferrer">Explore funnels, heatmaps & recordings<ExternalLink size={13}/></a></section>
        <section className="admin-section admin-issues"><header><div><p className="admin-eyebrow">Reliability</p><h2>Issues needing attention <span>{metric(errors,'unresolved_issues_shown')??'—'}</span></h2></div><Status provider={errors}/></header><ProviderNotice provider={errors}/><DataTable rows={errors?.rows||[]} columns={['title','level','count','lastSeen']} caption="Unresolved Sentry issues"/><p className="admin-footnote">Up to 20 unresolved issues. Event counts can include handled errors and intentional tests; they aren’t a crash count. User counts are limited by privacy settings.</p><a className="admin-detail-link" href={data.links.sentry} target="_blank" rel="noopener noreferrer">Investigate in Sentry<ExternalLink size={13}/></a></section>
      </div>
      <footer className="admin-notes"><AlertTriangle size={16}/><p>Each provider measures activity differently. Consent, blockers and reporting delays affect counts. No data from before activation can be recovered. Detailed recordings, account management and stack traces remain in their service dashboards.</p></footer>
    </div>}
  </main>;
}
