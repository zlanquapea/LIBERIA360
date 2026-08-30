'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createSupportTicket, getMySupportTickets } from '@/lib/support-api';
import { uploadImage } from '@/lib/uploads-api';
import { getFriendlyErrorMessage } from '@/lib/errors';
import type { SupportTicket, SupportTicketCategory } from '@/lib/types';

const categories: SupportTicketCategory[] = ['account','booking','payment','listing','technical','safety','feedback','other'];
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export default function CustomerSupportPage() {
  const { token, ready } = useAuth(); const [tickets, setTickets] = useState<SupportTicket[]>([]); const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<SupportTicketCategory>('technical'); const [subject, setSubject] = useState(''); const [description, setDescription] = useState(''); const [attachments, setAttachments] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { if (token) getMySupportTickets(token).then(setTickets).catch((e) => setError(getFriendlyErrorMessage(e))); }, [token]);
  async function addFiles(files: FileList | null) { if (!token || !files) return; setBusy(true); try { const urls = await Promise.all(Array.from(files).slice(0, 5 - attachments.length).map((f) => uploadImage(token, f))); setAttachments((old) => [...old, ...urls]); } catch (e) { setError(getFriendlyErrorMessage(e)); } finally { setBusy(false); } }
  async function submit(e: FormEvent) { e.preventDefault(); if (!token) return; setBusy(true); setError(''); try { const ticket = await createSupportTicket(token, { category, subject, description, attachments }); setTickets((old) => [ticket, ...old]); setShowForm(false); setSubject(''); setDescription(''); setAttachments([]); } catch (err) { setError(getFriendlyErrorMessage(err)); } finally { setBusy(false); } }
  if (!ready) return <main className="mx-auto max-w-3xl p-6">Loading…</main>;
  if (!token) return <main className="mx-auto max-w-md p-8 text-center"><h1 className="text-2xl font-bold">Customer Support</h1><p className="mt-3 text-slate-500">Please <Link className="text-brand-700 underline" href="/login">log in</Link> to contact support.</p></main>;
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header className="flex items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Customer Support</h1><p className="text-sm text-slate-500">Report a problem and follow every update in one place.</p></div><button onClick={() => setShowForm(!showForm)} className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white">{showForm ? 'Cancel' : 'New ticket'}</button></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {showForm && <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <label className="block text-sm font-semibold">Issue category<select value={category} onChange={(e) => setCategory(e.target.value as SupportTicketCategory)} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950">{categories.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></label>
      <label className="block text-sm font-semibold">Subject<input required minLength={3} maxLength={180} value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950" /></label>
      <label className="block text-sm font-semibold">What happened?<textarea required minLength={10} rows={6} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-xl border p-3 dark:bg-slate-950" /></label>
      <label className="block text-sm font-semibold">Screenshots (up to 5)<input type="file" accept="image/*" multiple onChange={(e) => void addFiles(e.target.files)} className="mt-2 block text-sm" /></label>
      {attachments.length > 0 && <div className="flex gap-2">{attachments.map((url, i) => <img key={url} src={url} alt={`Attachment ${i + 1}`} className="h-16 w-16 rounded-lg object-cover" />)}</div>}
      <button disabled={busy} className="rounded-full bg-brand-700 px-5 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? 'Submitting…' : 'Submit ticket'}</button>
    </form>}
    <section><h2 className="mb-3 text-lg font-bold">Your requests</h2>{tickets.length === 0 ? <p className="rounded-2xl border border-dashed p-8 text-center text-slate-500">You have not submitted a support ticket yet.</p> : <div className="space-y-3">{tickets.map((ticket) => <Link key={ticket.id} href={`/account/support/${ticket.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-400 dark:border-slate-800 dark:bg-slate-900"><div className="flex justify-between gap-3"><div><p className="font-semibold">{ticket.subject}</p><p className="mt-1 text-xs text-slate-500">{ticket.reference} · {label(ticket.category)} · {new Date(ticket.updatedAt).toLocaleDateString()}</p></div><span className="h-fit rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{label(ticket.status)}</span></div></Link>)}</div>}</section>
  </main>;
}
