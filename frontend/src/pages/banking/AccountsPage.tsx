import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import client from '../../api/client'

interface Account {
  id: number
  account_number: string
  balance: string
  account_type: string
  created_at?: string
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!localStorage.getItem('jwt')) {
      navigate('/banking/login')
      return
    }
    client
      .get('/accounts')
      .then((res) => setAccounts(res.data))
      .catch(() => setError('Failed to load accounts.'))
      .finally(() => setLoading(false))
  }, [navigate])

  return (
    <div className="wrapper">
      <Sidebar />
      <div className="content-wrapper">
        <div
          className="d-flex align-items-center px-4 py-3"
          style={{ background: '#fff', borderBottom: '1px solid #dee2e6', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
        >
          <h5 className="mb-0 fw-semibold">My Accounts</h5>
        </div>

        <div className="p-4">
          {loading && (
            <div className="text-center py-5">
              <div className="spinner-border text-danger" role="status" />
            </div>
          )}

          {error && (
            <div className="alert alert-danger">
              <i className="bi bi-exclamation-triangle me-2" />
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="row g-3">
              {accounts.map((acc) => (
                <div key={acc.id} className="col-12 col-md-6 col-lg-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div
                      className="card-header border-0 d-flex align-items-center gap-2"
                      style={{ background: '#f8f9fa' }}
                    >
                      <i className="bi bi-credit-card text-danger" />
                      <span className="fw-semibold text-capitalize">
                        {acc.account_type || 'Current Account'}
                      </span>
                      <span className="badge bg-success ms-auto">Active</span>
                    </div>
                    <div className="card-body">
                      <p className="text-muted small mb-1">Account Number</p>
                      <p className="font-monospace fw-semibold mb-3">{acc.account_number}</p>

                      <p className="text-muted small mb-1">Available Balance</p>
                      <h4 className="fw-bold text-danger mb-3">
                        £{parseFloat(acc.balance || '0').toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      </h4>

                      <Link
                        to={`/banking/accounts/${acc.id}`}
                        className="btn btn-outline-danger w-100"
                      >
                        <i className="bi bi-eye me-2" />
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}

              {accounts.length === 0 && (
                <div className="col-12">
                  <div className="text-center py-5">
                    <i className="bi bi-credit-card" style={{ fontSize: '3rem', color: '#dee2e6' }} />
                    <p className="text-muted mt-2">No accounts found.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
