import { useEffect, useRef, useState } from 'react'
import hljs from 'highlight.js'
import { Link } from 'react-router-dom'

const APP_ROUTES: Record<number, { to: string; label: string; external?: boolean }> = {
  1: { to: '/banking/accounts/1', label: 'Open an account and change the ID in the address bar' },
  2: { to: '/banking/admin', label: 'Open the Admin Console as a customer' },
  3: { to: '/banking/statements', label: 'Open Statements, then Email statement' },
  4: { to: '/banking/business', label: 'Open Business Portal, then Report a problem' },
  5: { to: '/banking/business', label: 'Open Business Portal, then Staff administration' },
  6: { to: '/banking/business', label: 'Open Business Portal, then Download latest data backup' },
  7: { to: '/banking/admin', label: 'Open the Admin Console and read the hashes' },
  8: { to: '/banking/tools', label: 'Open Account Tools, then Session inspector' },
  9: { to: '/banking/profile', label: 'Open Profile & Documents' },
  10: { to: '/banking/login', label: 'Try the sign in form, then Search' },
  11: { to: '/banking/search', label: 'Open Search, then Add a remark' },
  12: { to: '/banking/statements', label: 'Open Statements, Custom statement and Statement period' },
  13: { to: '/banking/transfers', label: 'Send a transfer with a note, then view history' },
  14: { to: '/banking/business', label: 'Open Business Portal, Make a business payment' },
  15: { to: '/banking/profile', label: 'Open Profile, Contact details' },
  16: { to: '/banking/business', label: 'Open Business Portal sign in' },
  17: { to: '/banking/login', label: 'Open the sign in form' },
  18: { to: '/banking/login', label: 'Open the sign in form' },
  19: { to: '/banking/reset', label: 'Open the password reset page' },
  20: { to: '/banking/profile', label: 'Open Profile, Import account backup' },
  21: { to: '/banking/tools', label: 'Open Account Tools, Session inspector' },
  22: { to: '/banking/profile', label: 'Open Profile, Identity verification' },
  23: { to: '/banking/tools', label: 'Open Account Tools, Quick account lookup' },
  24: { to: '/banking/transfers', label: 'Open Transfers and submit a transfer' },
  25: { to: '/banking/transfers', label: 'Open Transfers with a damaged session token' },
}

export interface LabData {
  id: number
  category: string
  title: string
  difficulty: 'Low' | 'Medium' | 'High'
  objective: string
  exploitSteps: string[]
  affectedCode: { filename: string; language: string; code: string }[]
  hint: string
  fix: { description: string; before: string; after: string; language: string }
  tags: string[]
}

interface Props {
  labData: LabData
}

function difficultyBadge(d: LabData['difficulty']) {
  const map = { Low: 'badge-low', Medium: 'badge-medium', High: 'badge-high' }
  return <span className={`badge ${map[d]}`}>{d}</span>
}

function CodeBlock({ code, language, className = '' }: { code: string; language: string; className?: string }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = code
      hljs.highlightElement(ref.current)
    }
  }, [code, language])

  return (
    <pre className={className} style={{ background: 'var(--code-bg)', borderRadius: '6px', margin: 0 }}>
      <code ref={ref} className={`language-${language}`} />
    </pre>
  )
}

export default function LabPanel({ labData }: Props) {
  const [activeTab, setActiveTab] = useState('exploit')
  const [hintVisible, setHintVisible] = useState(false)
  const [fixVisible, setFixVisible] = useState(false)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)

  // Reset state when lab changes
  useEffect(() => {
    setActiveTab('exploit')
    setHintVisible(false)
    setFixVisible(false)
    setCopyMsg(null)
  }, [labData.id])

  const copyAsMarkdown = (file: { filename: string; language: string; code: string }) => {
    const md = `\`\`\`${file.language}\n// ${file.filename}\n${file.code}\n\`\`\``
    navigator.clipboard.writeText(md).then(() => {
      setCopyMsg(file.filename)
      setTimeout(() => setCopyMsg(null), 2000)
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex align-items-start gap-3 mb-3">
        <div>
          <h4 className="mb-1 fw-bold">
            <span className="text-danger me-2">#{labData.id}</span>
            {labData.title}
          </h4>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <span className="badge" style={{ background: '#495057', fontSize: '0.75rem' }}>
              {labData.category}
            </span>
            {difficultyBadge(labData.difficulty)}
            {labData.tags.map((t) => (
              <span
                key={t}
                className="badge"
                style={{ background: '#2d3446', color: '#c2c7d0', fontSize: '0.7rem' }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Objective */}
      <div
        className="alert mb-3"
        style={{ background: '#1e2330', border: '1px solid #3d4460', color: '#c2c7d0' }}
      >
        <strong style={{ color: '#fff' }}>Objective:</strong> {labData.objective}
      </div>

      {APP_ROUTES[labData.id] && (
        <Link to={APP_ROUTES[labData.id].to} className="btn btn-danger btn-sm mb-3">
          <i className="bi bi-box-arrow-up-right me-2" />
          {APP_ROUTES[labData.id].label}
        </Link>
      )}

      {/* Tab navigation */}
      <ul className="nav nav-tabs mb-3" style={{ borderBottom: '1px solid #3d4460' }}>
        {[
          { key: 'exploit', icon: 'bi-terminal', label: 'Exploit Steps' },
          { key: 'code', icon: 'bi-code-slash', label: 'Affected Code' },
          { key: 'hint', icon: 'bi-lightbulb', label: 'Hint' },
          { key: 'fix', icon: 'bi-patch-check', label: 'Fix / Diff' },
        ].map((tab) => (
          <li key={tab.key} className="nav-item">
            <button
              className={`nav-link ${activeTab === tab.key ? 'active' : ''}`}
              style={
                activeTab === tab.key
                  ? { background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px 4px 0 0' }
                  : { color: '#adb5bd', border: 'none', background: 'transparent' }
              }
              onClick={() => setActiveTab(tab.key)}
            >
              <i className={`bi ${tab.icon} me-1`} />
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {/* Tab content */}
      <div>
        {/* Exploit Steps */}
        {activeTab === 'exploit' && (
          <div>
            <ol className="ps-3" style={{ color: '#dee2e6' }}>
              {labData.exploitSteps.map((step, i) => {
                // Check if the step contains a code block marker
                const parts = step.split(/(```[\s\S]*?```)/g)
                return (
                  <li key={i} className="mb-3">
                    {parts.map((part, j) => {
                      const match = part.match(/^```(\w*)\n([\s\S]*?)```$/)
                      if (match) {
                        const lang = match[1] || 'bash'
                        const code = match[2]
                        return <CodeBlock key={j} code={code} language={lang} className="mt-2" />
                      }
                      return <span key={j}>{part}</span>
                    })}
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        {/* Affected Code */}
        {activeTab === 'code' && (
          <div>
            {labData.affectedCode.map((file, i) => (
              <div key={i} className="mb-4">
                <div
                  className="d-flex justify-content-between align-items-center px-3 py-2"
                  style={{ background: '#2d3446', borderRadius: '6px 6px 0 0' }}
                >
                  <span style={{ color: '#adb5bd', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                    <i className="bi bi-file-code me-2" />
                    {file.filename}
                  </span>
                  <button
                    className="btn btn-sm"
                    style={{ background: '#495057', color: '#dee2e6', fontSize: '0.75rem' }}
                    onClick={() => copyAsMarkdown(file)}
                  >
                    <i className="bi bi-clipboard me-1" />
                    {copyMsg === file.filename ? 'Copied!' : 'Copy as Markdown'}
                  </button>
                </div>
                <CodeBlock
                  code={file.code}
                  language={file.language}
                  className="code-before"
                />
              </div>
            ))}
          </div>
        )}

        {/* Hint */}
        {activeTab === 'hint' && (
          <div>
            <button
              className="btn mb-3"
              style={{ background: '#ffc107', color: '#000', fontWeight: 600 }}
              onClick={() => setHintVisible(!hintVisible)}
            >
              <i className={`bi bi-${hintVisible ? 'eye-slash' : 'eye'} me-2`} />
              {hintVisible ? 'Hide Hint' : 'Reveal Hint'}
            </button>
            {hintVisible && (
              <div
                className="p-3"
                style={{
                  background: '#2d2a00',
                  border: '1px solid #856404',
                  borderRadius: '6px',
                  color: '#ffc107',
                  lineHeight: 1.6,
                }}
              >
                <i className="bi bi-lightbulb-fill me-2" />
                {labData.hint}
              </div>
            )}
          </div>
        )}

        {/* Fix / Diff */}
        {activeTab === 'fix' && (
          <div>
            <button
              className="btn mb-3"
              style={{ background: '#198754', color: '#fff', fontWeight: 600 }}
              onClick={() => setFixVisible(!fixVisible)}
            >
              <i className={`bi bi-${fixVisible ? 'eye-slash' : 'eye'} me-2`} />
              {fixVisible ? 'Hide Fix' : 'Reveal Fix'}
            </button>
            {fixVisible && (
              <>
                <p style={{ color: '#adb5bd', marginBottom: '1rem' }}>
                  <strong style={{ color: '#fff' }}>Fix:</strong> {labData.fix.description}
                </p>
                <div className="row g-3">
                  <div className="col-12 col-lg-6">
                    <div
                      className="px-3 py-2 mb-1"
                      style={{
                        background: '#2d1a1a',
                        borderRadius: '6px 6px 0 0',
                        color: '#dc3545',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    >
                      <i className="bi bi-x-circle me-2" />
                      Vulnerable (Before)
                    </div>
                    <CodeBlock
                      code={labData.fix.before}
                      language={labData.fix.language}
                      className="code-before"
                    />
                  </div>
                  <div className="col-12 col-lg-6">
                    <div
                      className="px-3 py-2 mb-1"
                      style={{
                        background: '#0d2b1a',
                        borderRadius: '6px 6px 0 0',
                        color: '#198754',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    >
                      <i className="bi bi-check-circle me-2" />
                      Remediated (After)
                    </div>
                    <CodeBlock
                      code={labData.fix.after}
                      language={labData.fix.language}
                      className="code-after"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
