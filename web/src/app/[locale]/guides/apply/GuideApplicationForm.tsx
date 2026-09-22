'use client';

import { FormEvent, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { applyAsGuide, uploadGuideVerificationDocument } from '@/lib/guides-api';

export function GuideApplicationForm({ counties }: { counties: { id: string; name: string }[] }) {
  const { token } = useAuth();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) { setMessage('Please sign in before applying.'); return; }
    const form = new FormData(event.currentTarget);
    const languages = String(form.get('languages') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    setBusy(true); setMessage('');
    try { await applyAsGuide(token, { guideType: String(form.get('guideType')), bio: String(form.get('bio')), city: String(form.get('city')), countyId: String(form.get('countyId') || '') || undefined, languages, ltaLicenseNumber: String(form.get('ltaLicenseNumber') || '') || undefined, whatsappNumber: String(form.get('whatsappNumber') || '') || undefined, slug: String(form.get('slug')) }); const document = form.get('document'); if (document instanceof File && document.size > 0) await uploadGuideVerificationDocument(token, document); setMessage('Application submitted. An admin will review your profile before it becomes public.'); event.currentTarget.reset(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'We could not submit your application.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Guide URL name<input name="slug" required maxLength={180} placeholder="e.g. joseph-kru-town" className="form-input mt-1" /></label><label className="text-sm font-semibold">Guide type<select name="guideType" required className="form-input mt-1"><option value="tour_guide">Tour guide</option><option value="cultural_host">Cultural host</option><option value="nature_guide">Nature guide</option><option value="adventure_guide">Adventure guide</option><option value="food_host">Food host</option></select></label></div><label className="text-sm font-semibold">About you<textarea name="bio" required minLength={30} maxLength={4000} rows={5} placeholder="Tell travelers about your local knowledge and experience" className="form-input mt-1" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">City<input name="city" required maxLength={120} className="form-input mt-1" /></label><label className="text-sm font-semibold">County<select name="countyId" className="form-input mt-1"><option value="">Select a county</option>{counties.map((county) => <option key={county.id} value={county.id}>{county.name}</option>)}</select></label></div><label className="text-sm font-semibold">Languages <span className="font-normal text-slate-500">(comma separated)</span><input name="languages" required placeholder="English, Liberian English, Kpelle" className="form-input mt-1" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">WhatsApp number<input name="whatsappNumber" className="form-input mt-1" /></label><label className="text-sm font-semibold">LTA license number <span className="font-normal text-slate-500">(optional)</span><input name="ltaLicenseNumber" className="form-input mt-1" /></label></div><label className="text-sm font-semibold">Verification document <span className="font-normal text-slate-500">(optional PDF, JPG, or PNG; max 5 MB)</span><input name="document" type="file" accept="application/pdf,image/jpeg,image/png" className="mt-1 block w-full text-sm" /></label><p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Applications and verification documents stay private until an admin approves your profile.</p><button disabled={busy} className="button-primary min-h-11 disabled:opacity-60">{busy ? 'Submitting…' : 'Submit application'}</button>{message && <p role="status" className="text-sm text-brand-700 dark:text-brand-300">{message}</p>}</form>;
}
