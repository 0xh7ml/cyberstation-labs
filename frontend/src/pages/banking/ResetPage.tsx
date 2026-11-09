import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'

export default function ResetPage() {
  const [username, setUsername] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')

  const request = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const r = await client.post('/auth/reset-request', { username })
      setToken(r.data.token)
      setMsg('Reset code generated. Enter a new password below.')
    } catch { setMsg('User not found.') }
  }
  const confirm = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await client.post('/auth/reset-confirm', { token, new_password: password })
      setMsg('Password updated. You can sign in now.')
    } catch { setMsg('Invalid or expired code.') }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#1e2330,#2d3446)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card border-0 p-4" style={{ width: 400, borderRadius: 12 }}>
        <h5 className="fw-semibold mb-3">Reset your password</h5>
        {msg && <div className="alert alert-info py-2 small">{msg}</div>}
        <form onSubmit={request} className="mb-3">
          <label className="form-label" htmlFor="ru">Username</label>
          <input id="ru" className="form-control mb-2" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <button className="btn btn-outline-danger w-100" type="submit">Send reset code</button>
        </form>
        <form onSubmit={confirm}>
          <label className="form-label" htmlFor="rt">Reset code</label>
          <input id="rt" className="form-control mb-2" value={token} onChange={(e) => setToken(e.target.value)} required />
          <label className="form-label" htmlFor="rp">New password</label>
          <input id="rp" type="password" className="form-control mb-2" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="btn btn-danger w-100" type="submit">Set password</button>
        </form>
        <Link to="/banking/login" className="small mt-3 text-center">Back to sign in</Link>
      </div>
    </div>
  )
}
