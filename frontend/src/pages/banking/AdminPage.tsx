import { useEffect, useState } from 'react'
import PageShell from '../../components/PageShell'
import client from '../../api/client'

interface U { id: number; username: string; email: string; role: string; password_hash: string }

export default function AdminPage() {
  const [users, setUsers] = useState<U[]>([])
  const [err, setErr] = useState('')
  useEffect(() => {
    client.get('/admin/users').then((r) => setUsers(r.data)).catch(() => setErr('Could not load users.'))
  }, [])
  return (
    <PageShell title="Admin Console">
      {err && <div className="alert alert-danger">{err}</div>}
      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead><tr><th className="ps-3">ID</th><th>User</th><th>Email</th><th>Role</th><th>Password hash</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}><td className="ps-3">{u.id}</td><td>{u.username}</td><td>{u.email}</td><td>{u.role}</td><td className="font-monospace small">{u.password_hash}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  )
}
