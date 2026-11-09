import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import client from '../../api/client'

interface Account {
  id: number
  account_number: string
  account_type: string
}

interface Transaction {
  id: number
  timestamp: string
  from_account_id: number
  to_account_id: number
  amount: number
  note: string
  status: string
}

export default function TransfersPage() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Form state
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('jwt')) {
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
        setTransactions(txRes.data.transactions ?? [])
      } catch {
        // silent — show empty state
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [navigate])

  const handleTransfer = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)
    setSubmitting(true)
    try {
      await client.post('/transfers/send', {
        from_account_id: parseInt(fromAccountId),
        to_account_id: parseInt(toAccountId),
        amount: parseFloat(amount),
        note,
      })
      setSuccessMsg('Transfer submitted successfully.')
      setAmount('')
      setNote('')
      // Refresh transactions
      const txRes = await client.get('/transfers/history')
      setTransactions(txRes.data.transactions ?? [])
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Transfer failed.'
      setErrorMsg(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="wrapper">
      <Sidebar />
      <div className="content-wrapper">
        <div
          className="d-flex align-items-center px-4 py-3"
          style={{ background: '#fff', borderBottom: '1px solid #dee2e6', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
        >
          <h5 className="mb-0 fw-semibold">Transfers</h5>
        </div>

        <div className="p-4">
          <div className="row g-4">
            {/* Transfer form */}
            <div className="col-12 col-lg-5">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-0 pb-0">
                  <h6 className="fw-semibold mb-0">
                    <i className="bi bi-send me-2 text-danger" />
                    New Transfer
                  </h6>
                </div>
                <div className="card-body">
                  {successMsg && (
                    <div className="alert alert-success py-2 d-flex align-items-center">
                      <i className="bi bi-check-circle me-2" />
                      <small>{successMsg}</small>
                    </div>
                  )}
                  {errorMsg && (
                    <div className="alert alert-danger py-2 d-flex align-items-center">
                      <i className="bi bi-exclamation-triangle me-2" />
                      <small>{errorMsg}</small>
                    </div>
                  )}

                  <form onSubmit={handleTransfer}>
                    <div className="mb-3">
                      <label className="form-label fw-medium">From Account</label>
                      <select
                        className="form-select"
                        value={fromAccountId}
                        onChange={(e) => setFromAccountId(e.target.value)}
                        required
                      >
                        <option value="">Select account…</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.account_type || 'Account'} — {a.account_number}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-medium">To Account ID</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="Recipient account ID"
                        value={toAccountId}
                        onChange={(e) => setToAccountId(e.target.value)}
                        required
                        min="1"
                      />
                      <div className="form-text">Enter the recipient's account ID number.</div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-medium">Amount (£)</label>
                      <div className="input-group">
                        <span className="input-group-text">£</span>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          step="0.01"
                          required
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="form-label fw-medium">
                        Note{' '}
                        <span
                          className="badge ms-1"
                          style={{ background: '#ffc107', color: '#000', fontSize: '0.65rem' }}
                        >
                          <i className="bi bi-bug me-1" />
                          XSS — Lab 13
                        </span>
                      </label>
                      <textarea
                        className="form-control"
                        rows={2}
                        placeholder="Payment reference or note…"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={500}
                      />
                      <div className="form-text text-danger">
                        HTML in notes is rendered unsanitised (Lab 13).
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-danger w-100 fw-semibold"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <i className="bi bi-send me-2" />
                          Send Transfer
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* Transaction history */}
            <div className="col-12 col-lg-7">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                  <h6 className="fw-semibold mb-0">
                    <i className="bi bi-clock-history me-2 text-danger" />
                    Transaction History
                  </h6>
                  <span
                    className="badge"
                    style={{ background: '#ffc107', color: '#000', fontSize: '0.7rem' }}
                  >
                    <i className="bi bi-bug me-1" />
                    XSS in note column
                  </span>
                </div>
                <div className="card-body p-0">
                  {loading ? (
                    <div className="text-center py-4">
                      <div className="spinner-border spinner-border-sm text-danger" />
                    </div>
                  ) : transactions.length === 0 ? (
                    <p className="text-muted text-center py-4 mb-0">No transactions yet.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead style={{ background: '#f8f9fa' }}>
                          <tr>
                            <th className="border-0 ps-3" style={{ fontSize: '0.8rem' }}>Date</th>
                            <th className="border-0" style={{ fontSize: '0.8rem' }}>From</th>
                            <th className="border-0" style={{ fontSize: '0.8rem' }}>To</th>
                            <th className="border-0" style={{ fontSize: '0.8rem' }}>Amount</th>
                            <th className="border-0" style={{ fontSize: '0.8rem' }}>
                              Note{' '}
                              <i className="bi bi-exclamation-triangle-fill text-warning" title="XSS — dangerouslySetInnerHTML" />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((txn) => (
                            <tr key={txn.id}>
                              <td className="ps-3 text-muted small">
                                {new Date(txn.timestamp).toLocaleDateString('en-GB')}
                              </td>
                              <td className="small font-monospace">#{txn.from_account_id}</td>
                              <td className="small font-monospace">#{txn.to_account_id}</td>
                              <td className="fw-semibold text-danger small">
                                £{Number(txn.amount).toFixed(2)}
                              </td>
                              {/*
                               * VULNERABILITY (Lab 13 — Stored XSS):
                               * dangerouslySetInnerHTML renders raw HTML from the database.
                               * Any <script> or event-handler payload stored in txn.note
                               * will execute in the viewer's browser.
                               */}
                              <td
                                className="small"
                                dangerouslySetInnerHTML={{ __html: txn.note }}
                              />
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
