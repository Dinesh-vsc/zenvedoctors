import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, ChevronDown, Command, MapPin, PackageCheck, Search, ShieldAlert, Truck, X } from 'lucide-react';
import './styles.css';

const statConfig = [['physical', 'Physical'], ['reserved', 'Reserved'], ['available', 'Available'], ['inTransit', 'In transit'], ['returned', 'Returned'], ['damaged', 'Damaged'], ['quarantined', 'Quarantined']];
const api = async (path, options) => { const response = await fetch(path, options); if (!response.ok) throw new Error((await response.json()).error || 'Request failed'); return response.json(); };

function SummaryCard({ label, value, description, tone, icon: Icon }) {
  return <div className={`summary-card ${tone}`}><div className="summary-top"><span>{label}</span><Icon size={17} strokeWidth={1.8} /></div><strong>{String(value).padStart(2, '0')}</strong><p>{description}</p></div>;
}

function ProductCard({ product, onAction, locations }) {
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const inventory = product.inventory;
  const run = async (action) => { setBusy(true); try { await onAction(product.id, action, qty); } finally { setBusy(false); } };
  return <article className="product-card">
    <div className="product-heading"><div><span className="eyebrow">{product.sku}</span><h3>{product.name}</h3></div><span className="location-pill"><MapPin size={13} />{product.location.name}</span></div>
    {inventory.available === 0 && <span className="out-pill"><X size={12} />Out of stock</span>}
    <div className="stats-grid">{statConfig.map(([key, label]) => <div className={`stat-box ${key === 'quarantined' ? 'wide-stat' : ''}`} key={key}><span>{label}</span><strong>{inventory[key]}</strong></div>)}</div>
    <div className="product-actions"><label className="qty-field"><span>Qty</span><input type="number" min="1" value={qty} onChange={(event) => setQty(Math.max(1, Number(event.target.value) || 1))} /></label><button className="primary-button" disabled={busy} onClick={() => run('receive')}><PackageCheck size={16} />Receive (GRN)</button></div>
    <div className="secondary-actions"><button onClick={() => run('mark-damaged')} disabled={busy || inventory.available < qty}><ShieldAlert size={15} />Mark damaged</button><button onClick={() => run('quarantine')} disabled={busy || inventory.available < qty}><ShieldAlert size={15} />Quarantine</button><button onClick={() => run('release-quarantine')} disabled={busy || inventory.quarantined < qty}><Check size={15} />Release quarantine</button></div>
    <label className="location-select"><span>Location</span><select value={product.location.id} onChange={(event) => onAction(product.id, 'location', Number(event.target.value))}>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><ChevronDown size={15} /></label>
  </article>;
}

function App() {
  const [products, setProducts] = useState([]); const [summary, setSummary] = useState(null); const [locations, setLocations] = useState([]); const [query, setQuery] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = async () => { try { const [items, totals, places] = await Promise.all([api('/api/products'), api('/api/summary'), api('/api/locations')]); setProducts(items); setSummary(totals); setLocations(places); setError(''); } catch (err) { setProducts([]); setSummary(null); setLocations([]); setError(err.message || 'API offline · start the backend to load inventory'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => products.filter((product) => `${product.name} ${product.sku} ${product.location.name}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const action = async (id, type, value) => { try { if (type === 'location') await api(`/api/products/${id}/location`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId: value }) }); else await api(`/api/products/${id}/${type}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qty: value }) }); await load(); } catch (err) { setError(err.message); } };
  useEffect(() => { const listener = (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector('#search').focus(); } }; window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener); }, []);
  return <div className="app-shell"><header className="topbar"><div className="brand-mark">Z</div><div className="brand-name">ZENVE <span>Inventory Engine</span></div><div className="header-meta"><span>ALL 12 LAYERS</span><span className="online-dot">● API CONNECTED</span></div><div className="avatar">AM</div></header><main>
    <div className="intro"><div><p className="breadcrumb">05 / OPERATIONS</p><h1>Inventory Engine</h1><p className="subtitle">The living ledger for every item, every location, every movement.</p></div><div className="user-row"><div className="avatar large">AM</div><div><strong>Arjun Mehta</strong><span>Operations lead</span></div><ChevronDown size={16} /></div></div>
    <div className="search-wrap"><Search size={18} /><input id="search" placeholder="Search inventory, SKU, or location..." value={query} onChange={(event) => setQuery(event.target.value)} /><kbd><Command size={12} />K</kbd></div>
    {error && <div className="notice">{error}</div>}
    <section className="summary-grid"><SummaryCard label="Physical" value={summary?.physical ?? '—'} description="Units in the building" tone="cream" icon={PackageCheck} /><SummaryCard label="Reserved" value={summary?.reserved ?? '—'} description="Committed to orders" tone="peach" icon={Check} /><SummaryCard label="Available" value={summary?.available ?? '—'} description="Ready to promise" tone="green" icon={Truck} /><SummaryCard label="Blocked" value={summary?.blocked ?? '—'} description="Damaged + quarantined" tone="rose" icon={ShieldAlert} /></section>
    <div className="section-heading"><div><p className="eyebrow">REAL-TIME STOCK</p><h2>Stock ledger <span>{filtered.length} SKUs</span></h2></div><div className="live-status"><i></i> Live updates</div></div>
    {loading ? <div className="empty-state">Loading the ledger...</div> : <section className="ledger-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} onAction={action} locations={locations} />)}</section>}
    <section className="rules"><div><p className="eyebrow">REFERENCE / 01</p><h2>Inventory rules in force</h2><p className="rule-intro">Every movement is atomic, traceable, and reversible only through its corresponding state.</p></div><div className="rules-list">{[['RECEIVE', 'Physical + qty  ·  Available + qty'], ['ORDER PLACED', 'Available - 1  ·  Reserved + 1'], ['SHIPPED', 'Reserved - 1  ·  In transit + 1'], ['RETURN FAILED', 'Returned - 1  ·  Damaged + 1']].map(([name, rule]) => <div className="rule" key={name}><span>{name}</span><strong>{rule}</strong></div>)}</div></section>
  </main><footer><span>ZENVE / INVENTORY ENGINE / v1.0</span><span>LAST SYNC · JUST NOW</span></footer></div>;
}

createRoot(document.getElementById('root')).render(<App />);
