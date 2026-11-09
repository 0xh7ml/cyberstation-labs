import { useState, type FormEvent } from 'react'
import PageShell from '../../components/PageShell'
import client from '../../api/client'

const box = { background: '#1e2330', color: '#dee2e6', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const }

export default function ToolsPage() {
  const [accId, setAccId] = useState('')
  const [summary, setSummary] = useState('')
  const [token, setToken] = useState(localStorage.getItem('jwt') ?? '')
  const [verify, setVerify] = useState('')

  const lookup = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const r = await client.get('/transfers/account-summary', { params: { id: accId } })
      setSummary(JSON.stringify(r.data, null, 2))
    } catch (err) {
      const d = (err as { response?: { data?: unknown } })?.response?.data
      setSummary(typeof d === 'string' ? d.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 900) : 'Lookup failed.')
    }
  }

  const check = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const r = await client.get('/integrity/verify-token', { headers: { Authorization: `Bearer ${token}` } })
      setVerify(JSON.stringify(r.data, null, 2))
    } catch { setVerify('Token rejected.') }
  }

  return (
    <PageShell title="Account Tools">
      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0"><h6 className="fw-semibold mb-0">Quick account lookup</h6></div>
            <form className="card-body" onSubmit={lookup}>
              <label className="form-label fw-medium" htmlFor="aid">Account ID</label>
              <input id="aid" className="form-control mb-3" value={accId} onChange={(e) => setAccId(e.target.value)} />
              <button className="btn btn-danger" type="submit">Look up</button>
              {summary && <pre className="mt-3 p-3 rounded small" style={box}>{summary}</pre>}
            </form>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0"><h6 className="fw-semibold mb-0">Session inspector</h6></div>
            <form className="card-body" onSubmit={check}>
              <label className="form-label fw-medium" htmlFor="tok">Your session token</label>
              <textarea id="tok" className="form-control font-monospace small mb-3" rows={4} value={token} onChange={(e) => setToken(e.target.value)} />
              <button className="btn btn-outline-danger" type="submit">Verify token</button>
              {verify && <pre className="mt-3 p-3 rounded small" style={box}>{verify}</pre>}
            </form>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
