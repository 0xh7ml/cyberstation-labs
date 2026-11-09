import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import client from '../../api/client'

interface Account {
  id: number
  account_number: string
  balance: number | string
  account_type: string
  owner?: string
  national_id?: string
  created_at?: string
}

interface Transaction {
  id: number
  from_account_id: number
  to_account_id: number
  amount: number
  note: string
  timestamp: string
  status: string
}

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [account, setAccount] = useState<Account | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!localStorage.getItem('jwt')) {
      navigate('/banking/login')
      return
    }

    // VULNERABILITY (Lab 1 — IDOR): Fetches /accounts/:id with no client-side
    // ownership check. The server also performs no ownership check, so any
    // authenticated user can view any account by changing the :id in the URL.
    const fetchAccount = async () => {
      try {
        const accRes = await client.get(`/accounts/${id}`)
        setAccount(accRes.data)
        setTransactions(accRes.data.transactions ?? [])
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status
        if (status === 401) {
          navigate('/banking/login')
        } else if (status === 404) {
          setError('Account not found.')
        } else if (status === 403) {
          setError('Access denied.')
        } else {
          setError('Failed to load account details.')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchAccount()
  }, [id, navigate])

  return (
    <div className="wrapper">
      <Sidebar />
      <div className="content-wrapper">
        <div
          className="d-flex align-items-center gap-3 px-4 py-3"
          style={{ background: '#fff', borderBottom: '1px solid #dee2e6', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
        >
          <Link to="/banking/accounts" className="btn btn-sm btn-outline-secondary">
            <i className="bi bi-arrow-left" />
          </Link>
          <h5 className="mb-0 fw-semibold">Account Details</h5>
          {/* Lab callout */}
          <span
            className="badge ms-auto"
            style={{ background: '#ffc107', color: '#000', fontSize: '0.7rem' }}
          >
            <i className="bi bi-bug me-1" />
            Lab 1 — IDOR Vulnerability
          </span>
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

          {!loading && account && (
            <>
              {/* Account info card */}
              <div className="card border-0 shadow-sm mb-4">
                <div
                  className="card-header border-0 d-flex align-items-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #dc3545, #9b1b2a)', color: '#fff' }}
                >
                  <i className="bi bi-credit-card" />
                  <span className="fw-semibold text-capitalize">
                    {account.account_type || 'Current Account'}
                  </span>
                  <span className="badge bg-light text-dark ms-auto">ID: {account.id}</span>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-12 col-md-4">
                      <p className="text-muted small mb-1">Account Number</p>
                      <p className="fw-semibold font-monospace mb-0">{account.account_number}</p>
                    </div>
                    <div className="col-12 col-md-4">
                      <p className="text-muted small mb-1">Balance</p>
                      <h4 className="fw-bold text-danger mb-0">
                        £{Number(account.balance || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      </h4>
                    </div>
                    {account.owner && (
                      <div className="col-12 col-md-4">
                        <p className="text-muted small mb-1">Account Owner</p>
                        <p className="fw-semibold mb-0">{account.owner}</p>
                      </div>
                    )}
                    {account.national_id && (
                      <div className="col-12 col-md-4">
                        <p className="text-muted small mb-1">National ID (PII Leak)</p>
                        <p className="fw-semibold text-danger font-monospace mb-0">{account.national_id}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Transactions */}
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-0">
                  <h6 className="fw-semibold mb-0">Transaction History</h6>
                </div>
                <div className="card-body p-0">
                  {transactions.length === 0 ? (
                    <p className="text-muted text-center py-4 mb-0">No transactions.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead style={{ background: '#f8f9fa' }}>
                          <tr>
                            <th className="border-0 ps-4">Date</th>
                            <th className="border-0">Note</th>
                            <th className="border-0">From → To</th>
                            <th className="border-0 text-end pe-4">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((txn) => (
                            <tr key={txn.id}>
                              <td className="ps-4 text-muted small">
                                {new Date(txn.timestamp).toLocaleDateString('en-GB')}
                              </td>
                              <td dangerouslySetInnerHTML={{ __html: txn.note }} />
                              <td className="text-muted small font-monospace">
                                #{txn.from_account_id} → #{txn.to_account_id}
                              </td>
                              <td className={`text-end pe-4 fw-semibold ${txn.to_account_id === Number(id) ? 'text-success' : 'text-danger'}`}>
                                {txn.to_account_id === Number(id) ? '+' : '-'}£{Math.abs(txn.amount).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
