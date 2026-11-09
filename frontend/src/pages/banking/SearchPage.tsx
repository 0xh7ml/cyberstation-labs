import { useState, type FormEvent } from 'react'
import PageShell from '../../components/PageShell'
import client from '../../api/client'

interface Txn { id: number | string; from_account_id: number | string; to_account_id: number | string; amount: number | string; note: string }

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Txn[]>([])
  const [error, setError] = useState('')
  const [remarkId, setRemarkId] = useState('')
  const [remark, setRemark] = useState('')
  const [preview, setPreview] = useState('')

  const search = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const r = await client.get('/transfers/search', { params: { q } })
      setRows(r.data.results)
    } catch { setError('Search failed.'); setRows([]) }
  }

  const addRemark = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const r = await client.post(`/transfers/${remarkId}/remark`, { remark })
      setPreview(r.data.rendered)
    } catch { setPreview('Could not save remark.') }
  }

  return (
    <PageShell title="Search Transactions">
      <form className="d-flex gap-2 mb-3" onSubmit={search}>
        <input id="q" className="form-control" placeholder="Search notes, e.g. rent" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-danger" type="submit"><i className="bi bi-search" /></button>
      </form>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="card border-0 shadow-sm mb-4">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead><tr><th className="ps-3">ID</th><th>From</th><th>To</th><th>Amount</th><th>Note</th></tr></thead>
            <tbody>
              {rows.map((t, i) => (
                <tr key={i}><td className="ps-3">{String(t.id)}</td><td>{String(t.from_account_id)}</td><td>{String(t.to_account_id)}</td><td>{String(t.amount)}</td><td>{String(t.note)}</td></tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">No results.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-0"><h6 className="fw-semibold mb-0">Add a remark to a transaction</h6></div>
        <form className="card-body" onSubmit={addRemark}>
          <div className="row g-2">
            <div className="col-4 col-md-2"><input id="rid" className="form-control" placeholder="Txn ID" value={remarkId} onChange={(e) => setRemarkId(e.target.value)} required /></div>
            <div className="col-8 col-md-8"><input id="rem" className="form-control" placeholder="Remark" value={remark} onChange={(e) => setRemark(e.target.value)} required /></div>
            <div className="col-12 col-md-2"><button className="btn btn-outline-danger w-100" type="submit">Save</button></div>
          </div>
          {preview && <div className="mt-3 p-3 rounded" style={{ background: '#f8f9fa' }} dangerouslySetInnerHTML={{ __html: preview }} />}
        </form>
      </div>
    </PageShell>
  )
}
