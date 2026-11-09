import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../../api/client'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent, creds?: { username: string; password: string }) => {
    e.preventDefault()
    const u = creds?.username ?? username
    const p = creds?.password ?? password
    setError(null)
    setLoading(true)
    try {
      const res = await client.post('/auth/login', { username: u, password: p })
      const token = res.data.token || res.data.access_token
      if (token) {
        localStorage.setItem('jwt', token)
        navigate('/banking/dashboard')
      } else {
        setError('Login failed: no token returned.')
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Unable to connect. Is the backend running?'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1e2330 0%, #2d3446 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px', padding: '1rem' }}>
        {/* Logo */}
        <div className="text-center mb-4">
          <svg width="52" height="52" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M14 2L4 7v6c0 5.5 4.3 10.7 10 12 5.7-1.3 10-6.5 10-12V7L14 2z"
              fill="#dc3545"
            />
            <path d="M10 14l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h3 className="mt-2 mb-0 fw-bold" style={{ color: '#fff' }}>
            SecureBank
          </h3>
          <p style={{ color: '#6c757d', fontSize: '0.85rem' }}>Online Banking</p>
        </div>

        {/* Card */}
        <div
          className="card border-0"
          style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
        >
          <div className="card-body p-4">
            <h5 className="card-title mb-4 fw-semibold">Sign in to your account</h5>

            {error && (
              <div className="alert alert-danger d-flex align-items-center py-2" role="alert">
                <i className="bi bi-exclamation-triangle-fill me-2" />
                <small>{error}</small>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label fw-medium" htmlFor="username">
                  Username
                </label>
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="bi bi-person" />
                  </span>
                  <input
                    id="username"
                    type="text"
                    className="form-control"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-medium" htmlFor="password">
                  Password
                </label>
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="bi bi-lock" />
                  </span>
                  <input
                    id="password"
                    type="password"
                    className="form-control"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-danger w-100 fw-semibold py-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <i className="bi bi-box-arrow-in-right me-2" />
                    Sign In
                  </>
                )}
              </button>
            </form>

            <div className="text-center mt-3">
              <Link to="/banking/reset" className="small d-block mb-2">Forgot your password?</Link>
              <small style={{ color: '#6c757d' }} className="d-block mb-2">
                Demo accounts — click to sign in
              </small>
              <div className="d-flex gap-2 justify-content-center flex-wrap">
                {[
                  { username: 'alice', password: 'password123', role: 'customer' },
                  { username: 'bob', password: 'qwerty', role: 'customer' },
                  { username: 'admin', password: 'admin', role: 'admin' },
                ].map((c) => (
                  <button
                    key={c.username}
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    disabled={loading}
                    title={`${c.username} / ${c.password}`}
                    onClick={(e) => {
                      setUsername(c.username)
                      setPassword(c.password)
                      handleSubmit(e as unknown as FormEvent, c)
                    }}
                  >
                    <i className="bi bi-person-check me-1" />
                    {c.username}
                    <span className="text-muted ms-1" style={{ fontSize: '0.7rem' }}>({c.role})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="text-center mt-3" style={{ color: '#6c757d', fontSize: '0.75rem' }}>
          SecureBank Labs — Developer Security Training
        </p>
      </div>
    </div>
  )
}
