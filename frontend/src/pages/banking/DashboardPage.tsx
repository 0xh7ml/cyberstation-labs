import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import client from '../../api/client'

interface Account {
  id: number
  account_number: string
  balance: string
  account_type: string
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

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('jwt')
    if (!token) {
      navigate('/banking/login')
      return
    }

    const fetchData = async () => {
      try {
        const [accRes, txRes] = await Promise.all([
          client.get('/accounts'),
          client.get('/transfers/history'),
        ])
        setAccounts(accRes.data)
        setTransactions((txRes.data.transactions ?? []).slice(0, 5))
      } catch {
        // If auth fails, redirect to login
        navigate('/banking/login')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [navigate])

  const totalBalance = accounts.reduce((sum, a) => sum + parseFloat(a.balance || '0'), 0)

  return (
    <div className="wrapper">
      <Sidebar />
      <div className="content-wrapper">
        {/* Top bar */}
        <div
          className="d-flex align-items-center justify-content-between px-4 py-3"
          style={{ background: '#fff', borderBottom: '1px solid #dee2e6', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
        >
          <h5 className="mb-0 fw-semibold">Dashboard</h5>
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-success">
              <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }} />
              Connected
            </span>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-danger" role="status" />
            </div>
          ) : (
            <>
              {/* Welcome banner */}
              <div
                className="rounded-3 p-4 mb-4"
                style={{ background: 'linear-gradient(135deg, #dc3545, #9b1b2a)', color: '#fff' }}
              >
                <h4 className="fw-bold mb-1">Welcome back!</h4>
                <p className="mb-0 opacity-75">Here is an overview of your accounts.</p>
              </div>

              {/* Summary cards */}
              <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-lg-4">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <p className="text-muted small mb-1">Total Balance</p>
                          <h4 className="fw-bold text-danger mb-0">
                            £{totalBalance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                          </h4>
                        </div>
                        <div
                          className="rounded-3 d-flex align-items-center justify-content-center"
                          style={{ width: 48, height: 48, background: '#fff0f1' }}
                        >
                          <i className="bi bi-wallet2 text-danger" style={{ fontSize: '1.4rem' }} />
                        </div>
                      </div>
                      <p className="text-muted small mt-2 mb-0">
                        {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {accounts.slice(0, 2).map((acc) => (
                  <div key={acc.id} className="col-12 col-sm-6 col-lg-4">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <p className="text-muted small mb-1">
                              {acc.account_type || 'Current Account'}
                            </p>
                            <h4 className="fw-bold mb-0">
                              £{parseFloat(acc.balance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                            </h4>
                          </div>
                          <div
                            className="rounded-3 d-flex align-items-center justify-content-center"
                            style={{ width: 48, height: 48, background: '#f0f4ff' }}
                          >
                            <i className="bi bi-credit-card" style={{ fontSize: '1.4rem', color: '#4361ee' }} />
                          </div>
                        </div>
                        <p className="text-muted small mt-2 mb-0 font-monospace">
                          {acc.account_number}
                        </p>
                        <Link
                          to={`/banking/accounts/${acc.id}`}
                          className="btn btn-sm btn-outline-secondary mt-2"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <div className="row g-3 mb-4">
                <div className="col-12">
                  <div className="card border-0 shadow-sm">
                    <div className="card-header bg-white border-0 pb-0">
                      <h6 className="fw-semibold mb-0">Quick Actions</h6>
                    </div>
                    <div className="card-body d-flex gap-3 flex-wrap">
                      <Link to="/banking/transfers" className="btn btn-danger">
                        <i className="bi bi-send me-2" />
                        New Transfer
                      </Link>
                      <Link to="/banking/accounts" className="btn btn-outline-secondary">
                        <i className="bi bi-list-ul me-2" />
                        All Accounts
                      </Link>
                      <Link to="/labs/a01/1" className="btn btn-outline-dark">
                        <i className="bi bi-bug me-2" />
                        Open Labs
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent transactions */}
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                  <h6 className="fw-semibold mb-0">Recent Transactions</h6>
                  <Link to="/banking/transfers" className="btn btn-sm btn-outline-danger">
                    View All
                  </Link>
                </div>
                <div className="card-body p-0">
                  {transactions.length === 0 ? (
                    <p className="text-muted text-center py-4 mb-0">No transactions yet.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead style={{ background: '#f8f9fa' }}>
                          <tr>
                            <th className="border-0 ps-4">Date</th>
                            <th className="border-0">Description</th>
                            <th className="border-0 text-end pe-4">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((txn) => (
                            <tr key={txn.id}>
                              <td className="ps-4 text-muted small">
                                {new Date(txn.timestamp).toLocaleDateString('en-GB')}
                              </td>
                              <td>{txn.note || `Transfer #${txn.id}`}</td>
                              <td className="text-end pe-4 fw-semibold text-danger">
                                £{Math.abs(txn.amount).toFixed(2)}
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
