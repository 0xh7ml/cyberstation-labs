import { useEffect, useState, type FormEvent } from 'react'
import axios from 'axios'
import PageShell from '../../components/PageShell'
import client from '../../api/client'

const report = axios.create({ baseURL: '/api/report/report' })

interface Account { id: number; account_number: string; account_type: string }

const out = { background: '#1e2330', color: '#dee2e6', whiteSpace: 'pre-wrap' as const }

export default function StatementsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [template, setTemplate] = useState('Statement for {{.Name}} (account {{.AccountID}})\nBalance: £{{.Balance}} as of {{.Date}}')
  const [output, setOutput] = useState('')
  const [fromDate, setFromDate] = useState('2024-01-01')
  const [toDate, setToDate] = useState('2024-12-31')
  const [range, setRange] = useState('')
  const [callback, setCallback] = useState('')
  const [emailMsg, setEmailMsg] = useState('')

  useEffect(() => {
    client.get('/accounts').then((r) => {
      setAccounts(r.data)
      if (r.data[0]) setAccountId(String(r.data[0].id))
    }).catch(() => {})
  }, [])

  const errText = (e: unknown) => {
    const d = (e as { response?: { data?: unknown } })?.response?.data
    return typeof d === 'string' ? d.slice(0, 600) : JSON.stringify(d ?? 'Request failed')
  }

  const generate = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const r = await report.post('/generate', { account_id: accountId, template })
      setOutput(r.data.report)
    } catch (err) { setOutput(errText(err)) }
  }

  const filter = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const r = await report.post('/date-filter', { from_date: fromDate, to_date: toDate })
      setRange(`From: ${r.data.from_epoch}\nTo: ${r.data.to_epoch}`)
    } catch (err) { setRange(errText(err)) }
  }

  const sendEmail = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const r = await client.post('/accounts/statement-email', { account_id: accountId, callback_url: callback })
      setEmailMsg(`Delivery status ${r.data.status_code}\n${r.data.response_body}`)
    } catch (err) { setEmailMsg(errText(err)) }
  }

  return (
    <PageShell title="Statements & Reports">
      <div className="row g-4">
        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0"><h6 className="fw-semibold mb-0"><i className="bi bi-file-earmark-text me-2 text-danger" />Custom statement</h6></div>
            <form className="card-body" onSubmit={generate}>
              <label className="form-label fw-medium" htmlFor="stmt-acc">Account</label>
              <select id="stmt-acc" className="form-select mb-3" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_type} — {a.account_number}</option>)}
              </select>
              <label className="form-label fw-medium" htmlFor="stmt-tpl">Statement layout</label>
              <textarea id="stmt-tpl" className="form-control font-monospace mb-1" rows={4} value={template} onChange={(e) => setTemplate(e.target.value)} />
              <div className="form-text mb-3">Available fields: Name, AccountID, Balance, Date.</div>
              <button className="btn btn-danger" type="submit"><i className="bi bi-gear me-2" />Generate</button>
              {output && <pre className="mt-3 p-3 rounded" style={out}>{output}</pre>}
            </form>
          </div>
        </div>
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white border-0"><h6 className="fw-semibold mb-0"><i className="bi bi-calendar-range me-2 text-danger" />Statement period</h6></div>
            <form className="card-body" onSubmit={filter}>
              <label className="form-label fw-medium" htmlFor="from">From</label>
              <input id="from" className="form-control mb-2" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <label className="form-label fw-medium" htmlFor="to">To</label>
              <input id="to" className="form-control mb-3" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              <button className="btn btn-outline-danger" type="submit">Apply period</button>
              {range && <pre className="mt-3 p-3 rounded" style={out}>{range}</pre>}
            </form>
          </div>
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0"><h6 className="fw-semibold mb-0"><i className="bi bi-envelope me-2 text-danger" />Email statement</h6></div>
            <form className="card-body" onSubmit={sendEmail}>
              <label className="form-label fw-medium" htmlFor="cb">Delivery webhook URL</label>
              <input id="cb" className="form-control mb-3" placeholder="https://mail.example.com/hook" value={callback} onChange={(e) => setCallback(e.target.value)} required />
              <button className="btn btn-outline-danger" type="submit">Send</button>
              {emailMsg && <pre className="mt-3 p-3 rounded" style={out}>{emailMsg}</pre>}
            </form>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
