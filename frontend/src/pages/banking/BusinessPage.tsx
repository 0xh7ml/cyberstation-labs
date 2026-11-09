import { useState, type FormEvent } from 'react'
import axios from 'axios'
import PageShell from '../../components/PageShell'

const django = axios.create({ baseURL: '/api/django/api' })

const errMsg = (e: unknown) => {
  const d = (e as { response?: { data?: { error?: string } } })?.response?.data
  return d?.error ?? 'Request failed.'
}

export default function BusinessPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(localStorage.getItem('djtoken') ?? '')
  const [loginMsg, setLoginMsg] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [txMsg, setTxMsg] = useState('')

  const login = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const r = await django.post('/accounts/login/', { username, password })
      localStorage.setItem('djtoken', r.data.token)
      setToken(r.data.token)
      setLoginMsg(`Signed in as ${username}.`)
    } catch (err) { setLoginMsg(errMsg(err)); setToken('') }
  }

  const pay = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const r = await django.post('/transfers/create/', { from_account_id: Number(from), to_account_id: Number(to), amount: Number(amount) },
        { headers: { Authorization: `Bearer ${token}` } })
      setTxMsg(`Payment ${r.data.status}: £${r.data.amount}`)
    } catch (err) { setTxMsg(errMsg(err)) }
  }

  return (
    <PageShell title="Business Banking Portal">
      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white border-0"><h6 className="fw-semibold mb-0">Portal sign in</h6></div>
            <form className="card-body" onSubmit={login}>
              <label className="form-label fw-medium" htmlFor="bu">Username</label>
              <input id="bu" className="form-control mb-2" value={username} onChange={(e) => setUsername(e.target.value)} required />
              <label className="form-label fw-medium" htmlFor="bp">Password</label>
              <input id="bp" type="password" className="form-control mb-3" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button className="btn btn-danger" type="submit">Sign in</button>
              {loginMsg && <div className="alert alert-secondary py-2 small mt-3 mb-0">{loginMsg}</div>}
            </form>
          </div>
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0"><h6 className="fw-semibold mb-0">Help &amp; resources</h6></div>
            <ul className="list-group list-group-flush small">
              <li className="list-group-item"><a href="/admin/" target="_blank" rel="noreferrer">Staff administration</a></li>
              <li className="list-group-item"><a href="/backup.zip">Download latest data backup</a></li>
              <li className="list-group-item"><a href="/api/django/api/accounts/debug/" target="_blank" rel="noreferrer">Report a problem with this portal</a></li>
            </ul>
          </div>
        </div>
        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0"><h6 className="fw-semibold mb-0">Make a business payment</h6></div>
            <form className="card-body" onSubmit={pay}>
              {!token && <div className="alert alert-warning py-2 small">Sign in to the portal first.</div>}
              <div className="row g-2 mb-3">
                <div className="col-6"><label className="form-label" htmlFor="pf">From account ID</label><input id="pf" type="number" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} required /></div>
                <div className="col-6"><label className="form-label" htmlFor="pt">To account ID</label><input id="pt" type="number" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} required /></div>
              </div>
              <label className="form-label" htmlFor="pa">Amount (£)</label>
              <input id="pa" type="number" step="0.01" className="form-control mb-3" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              <button className="btn btn-danger" type="submit" disabled={!token}>Pay</button>
              {txMsg && <div className="alert alert-secondary py-2 small mt-3 mb-0">{txMsg}</div>}
            </form>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
