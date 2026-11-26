import { rowsOf } from '../../lib/records'
import { useState } from 'react'
import { changes, tenant } from '../../lib/tenant'
import { useRemote } from '../../lib/useRemote'
import { CatalogModal } from '../shared/CatalogUI'
import { ErrorMessage, Field, buttonClass, cardClass, primaryClass } from '../shared/ApiUI'
import { RemoteState, Textarea } from '../shared/WorkspaceUI'
import { SettingsToggle } from '../settings/SettingsToggle'

export function Faqs() {
  const remote = useRemote(() => tenant.get('support/faqs'), [])
  const [editor, setEditor] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const rows = [...rowsOf(remote.data?.data, 'faqs')].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
  const toggle = async (faq) => { setBusy(true); setError(null); try { await tenant.patch(`support/faqs/${faq.id}`, { isActive: !faq.isActive }); await remote.refresh() } catch (err) { setError(err) } finally { setBusy(false) } }
  const remove = async () => { setBusy(true); setError(null); try { await tenant.delete(`support/faqs/${deleting.id}`); setDeleting(null); await remote.refresh() } catch (err) { setError(err) } finally { setBusy(false) } }
  return <section className={`${cardClass} workspace-stack`} aria-label="Help questions">
    <div className="workspace-card-heading"><div><h2>Frequently asked questions</h2><p className="workspace-hint">Helpful answers customers can read in your app.</p></div><div className="workspace-actions"><button className={buttonClass} disabled={remote.loading || busy} onClick={remote.refresh}>Refresh FAQs</button><button className={primaryClass} onClick={() => setEditor({})}>Add question</button></div></div>
    <ErrorMessage error={error} />
    <RemoteState remote={remote} label="help questions" empty={!rows.length}>{rows.map((faq) => <article key={faq.id} className="workspace-stack border-b border-[#f0ece9] py-4 last:border-0"><div className="workspace-card-heading"><div><h3 className="font-medium text-sm">{faq.question}</h3><p className="workspace-hint">Position {faq.sortOrder ?? 0} · {faq.isActive ? 'Visible in app' : 'Hidden from app'}</p></div><div className="workspace-actions"><SettingsToggle checked={!!faq.isActive} ariaLabel={`Show FAQ: ${faq.question}`} disabled={busy} onChange={() => toggle(faq)} /><button className={buttonClass} onClick={() => setEditor(faq)}>Edit question</button><button className={buttonClass} onClick={() => { setError(null); setDeleting(faq) }}>Delete question</button></div></div><p className="workspace-prose">{faq.answer}</p></article>)}</RemoteState>
    {editor && <FaqEditor faq={editor} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await remote.refresh() }} />}
    {deleting && <CatalogModal title="Delete this question?" busy={busy} onClose={() => setDeleting(null)}><div className="workspace-stack"><p className="workspace-hint">“{deleting.question}” will be removed from your app’s help screen.</p><ErrorMessage error={error} /><div className="workspace-actions justify-end"><button className={buttonClass} disabled={busy} onClick={() => setDeleting(null)}>Keep question</button><button className={primaryClass} disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Confirm delete question'}</button></div></div></CatalogModal>}
  </section>
}
function FaqEditor({ faq, onClose, onSaved }) {
  const [form, setForm] = useState({ question: faq.question || '', answer: faq.answer || '', sortOrder: faq.sortOrder ?? 0, isActive: faq.isActive ?? true })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError(null)
    try {
      const body = { ...form, question: form.question.trim(), answer: form.answer.trim(), sortOrder: Number(form.sortOrder) }
      if (!body.question || !body.answer) throw new Error('Enter both a question and an answer.')
      if (faq.id) { const patch = changes(faq, body); if (Object.keys(patch).length) await tenant.patch(`support/faqs/${faq.id}`, patch) } else await tenant.post('support/faqs', body)
      await onSaved()
    } catch (err) { setError(err) } finally { setBusy(false) }
  }
  return <CatalogModal title={faq.id ? 'Edit help question' : 'Add help question'} busy={busy} onClose={onClose}><form onSubmit={save} className="workspace-stack"><ErrorMessage error={error} /><fieldset disabled={busy} className="workspace-stack"><Field label="Question" name="question" value={form.question} maxLength={200} required errors={error?.fieldErrors} onChange={(e) => setForm({ ...form, question: e.target.value })} /><Textarea label="Answer" name="answer" value={form.answer} maxLength={2000} required errors={error?.fieldErrors} onChange={(e) => setForm({ ...form, answer: e.target.value })} /><Field label="Display position" name="sortOrder" type="number" step={1} min={0} value={form.sortOrder} required errors={error?.fieldErrors} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /><p className="workspace-hint">Lower positions appear first.</p><div className="module-toggle"><span>Visible in the customer app</span><SettingsToggle checked={form.isActive} ariaLabel="FAQ visibility" onChange={(value) => setForm({ ...form, isActive: value })} /></div><div className="workspace-actions justify-end"><button type="button" className={buttonClass} onClick={onClose}>Cancel</button><button className={primaryClass}>{busy ? 'Saving…' : 'Save question'}</button></div></fieldset></form></CatalogModal>
}
