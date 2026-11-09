import { useEffect, useState, type FormEvent } from 'react'
import axios from 'axios'
import PageShell from '../../components/PageShell'
import client from '../../api/client'

const django = axios.create({ baseURL: '/api/django/api' })

export default function ProfilePage() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [dj, setDj] = useState<Record<string, unknown> | null>(null)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploadMsg, setUploadMsg] = useState('')
  const [backup, setBackup] = useState<File | null>(null)
  const [backupMsg, setBackupMsg] = useState('')

  useEffect(() => {
    client.get('/crypto/profile').then((r) => setProfile(r.data)).catch(() => {})
    django.post('/accounts/login/', { username: 'alice', password: 'password123' })
      .then((r) => {
        localStorage.setItem('djtoken', r.data.token)
        return django.get('/accounts/profile/', { headers: { Authorization: `Bearer ${r.data.token}` } })
      })
      .then((r) => { setDj(r.data); setEmail(r.data.email ?? '') })
      .catch(() => {})
  }, [])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const r = await django.patch('/accounts/profile/', { username: dj?.username, email, role: dj?.role }, { headers: { Authorization: `Bearer ${localStorage.getItem('djtoken')}` } })
      setDj(r.data); setMsg('Profile updated.')
    } catch { setMsg('Update failed.') }
  }

  const upload = async (e: FormEvent, field: 'file' | 'data', path: string, f: File | null, set: (s: string) => void) => {
    e.preventDefault()
    if (!f) return
    const fd = new FormData(); fd.append(field, f)
    try {
      const r = await client.post(path, fd)
      set(JSON.stringify(r.data))
    } catch { set('Upload failed.') }
  }

  return (
    <PageShell title="My Profile & Documents">
      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white border-0"><h6 className="fw-semibold mb-0">Account holder</h6></div>
            <div className="card-body">
              {profile ? (
                Object.entries(profile).map(([k, v]) => (
                  <div className="row mb-1" key={k}><div className="col-5 text-muted small">{k}</div><div className="col-7 small font-monospace text-break">{String(v)}</div></div>
                ))
              ) : <div className="spinner-border spinner-border-sm text-danger" />}
            </div>
          </div>
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0"><h6 className="fw-semibold mb-0">Contact details</h6></div>
            <form className="card-body" onSubmit={save}>
              <label className="form-label fw-medium" htmlFor="email">Email</label>
              <input id="email" type="email" className="form-control mb-3" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn btn-danger" type="submit">Save</button>
              {msg && <span className="ms-3 small text-muted">{msg}</span>}
              {dj && <div className="small text-muted mt-3">Role: {String(dj.role)}</div>}
            </form>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white border-0"><h6 className="fw-semibold mb-0">Identity verification (KYC)</h6></div>
            <form className="card-body" onSubmit={(e) => upload(e, 'file', '/integrity/kyc-upload', file, setUploadMsg)}>
              <input id="kyc" type="file" className="form-control mb-3" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button className="btn btn-danger" type="submit">Upload document</button>
              {uploadMsg && <pre className="mt-3 small text-break" style={{ whiteSpace: 'pre-wrap' }}>{uploadMsg}</pre>}
            </form>
          </div>
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0"><h6 className="fw-semibold mb-0">Import account backup</h6></div>
            <form className="card-body" onSubmit={(e) => upload(e, 'data', '/integrity/import-account', backup, setBackupMsg)}>
              <input id="bk" type="file" className="form-control mb-3" onChange={(e) => setBackup(e.target.files?.[0] ?? null)} />
              <button className="btn btn-outline-danger" type="submit">Import</button>
              {backupMsg && <pre className="mt-3 small text-break" style={{ whiteSpace: 'pre-wrap' }}>{backupMsg}</pre>}
            </form>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
