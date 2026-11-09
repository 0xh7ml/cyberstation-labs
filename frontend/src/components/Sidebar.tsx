import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

interface LabEntry {
  num: number
  label: string
}

interface CategoryEntry {
  id: string
  label: string
  color: string
  labs: LabEntry[]
}

const categories: CategoryEntry[] = [
  {
    id: 'a01',
    label: 'A01: Broken Access Control',
    color: '#dc3545',
    labs: [
      { num: 1, label: 'Lab 1 — IDOR' },
      { num: 2, label: 'Lab 2 — Priv Escalation' },
      { num: 3, label: 'Lab 3 — SSRF' },
    ],
  },
  {
    id: 'a02',
    label: 'A02: Security Misconfiguration',
    color: '#fd7e14',
    labs: [
      { num: 4, label: 'Lab 4 — Debug Mode' },
      { num: 5, label: 'Lab 5 — Default Creds' },
      { num: 6, label: 'Lab 6 — File Exposure' },
    ],
  },
  {
    id: 'a04',
    label: 'A04: Cryptographic Failures',
    color: '#ffc107',
    labs: [
      { num: 7, label: 'Lab 7 — MD5 Hashing' },
      { num: 8, label: 'Lab 8 — JWT Secret' },
      { num: 9, label: 'Lab 9 — Cleartext PII' },
    ],
  },
  {
    id: 'a05',
    label: 'A05: Injection',
    color: '#6f42c1',
    labs: [
      { num: 10, label: 'Lab 10 — SQL Injection' },
      { num: 11, label: 'Lab 11 — SSTI Jinja2' },
      { num: 12, label: 'Lab 12 — SSTI Go+Cmd' },
      { num: 13, label: 'Lab 13 — Stored XSS' },
    ],
  },
  {
    id: 'a06',
    label: 'A06: Insecure Design',
    color: '#0dcaf0',
    labs: [
      { num: 14, label: 'Lab 14 — Neg Transfer' },
      { num: 15, label: 'Lab 15 — Mass Assignment' },
      { num: 16, label: 'Lab 16 — Enumeration' },
    ],
  },
  {
    id: 'a07',
    label: 'A07: Auth Failures',
    color: '#198754',
    labs: [
      { num: 17, label: 'Lab 17 — Brute-force' },
      { num: 18, label: 'Lab 18 — Session Fixation' },
      { num: 19, label: 'Lab 19 — Reset Token' },
    ],
  },
  {
    id: 'a08',
    label: 'A08: Integrity Failures',
    color: '#d63384',
    labs: [
      { num: 20, label: 'Lab 20 — Pickle RCE' },
      { num: 21, label: 'Lab 21 — JWT None Alg' },
      { num: 22, label: 'Lab 22 — File Upload' },
    ],
  },
  {
    id: 'a10',
    label: 'A10: Exception Handling',
    color: '#6c757d',
    labs: [
      { num: 23, label: 'Lab 23 — Verbose Error' },
      { num: 24, label: 'Lab 24 — TypeError' },
      { num: 25, label: 'Lab 25 — Auth Bypass' },
    ],
  },
]

export default function Sidebar() {
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})
  const navigate = useNavigate()

  const toggleCategory = (id: string) => {
    setOpenCategories((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleLogout = () => {
    localStorage.removeItem('jwt')
    navigate('/banking/login')
  }

  return (
    <aside className="main-sidebar">
      {/* Brand */}
      <NavLink to="/banking/dashboard" className="brand-link">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M14 2L4 7v6c0 5.5 4.3 10.7 10 12 5.7-1.3 10-6.5 10-12V7L14 2z"
            fill="#dc3545"
          />
          <path d="M10 14l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="brand-text">SecureBank Labs</span>
      </NavLink>

      <nav style={{ padding: '0.5rem 0' }}>
        {/* Banking App Section */}
        <ul className="nav-sidebar" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          <li className="nav-header">Banking App</li>
          <li className="nav-item">
            <NavLink
              to="/banking/dashboard"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <i className="bi bi-speedometer2" />
              Dashboard
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink
              to="/banking/accounts"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <i className="bi bi-credit-card" />
              Accounts
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink
              to="/banking/transfers"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <i className="bi bi-arrow-left-right" />
              Transfers
            </NavLink>
          </li>

          <li className="nav-item">
            <NavLink
              to="/banking/statements"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <i className="bi bi-file-earmark-text" />
              Statements
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink
              to="/banking/search"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <i className="bi bi-search" />
              Search
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink
              to="/banking/business"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <i className="bi bi-building" />
              Business Portal
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink
              to="/banking/tools"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <i className="bi bi-tools" />
              Account Tools
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink
              to="/banking/profile"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <i className="bi bi-person-circle" />
              Profile & Documents
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink
              to="/banking/admin"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <i className="bi bi-shield-lock" />
              Admin Console
            </NavLink>
          </li>

          {/* OWASP Labs Section */}
          <li className="nav-header" style={{ marginTop: '0.5rem' }}>OWASP Labs</li>

          {categories.map((cat) => (
            <li key={cat.id} className="nav-item">
              {/* Category toggle button */}
              <button
                className="nav-link w-100 text-start border-0 bg-transparent"
                style={{ cursor: 'pointer' }}
                onClick={() => toggleCategory(cat.id)}
                aria-expanded={!!openCategories[cat.id]}
              >
                <span
                  className="badge me-2"
                  style={{ backgroundColor: cat.color, fontSize: '0.65rem', minWidth: '36px' }}
                >
                  {cat.id.toUpperCase()}
                </span>
                <span style={{ flex: 1, fontSize: '0.8rem' }}>
                  {cat.label.split(': ')[1]}
                </span>
                <i
                  className={`bi bi-chevron-${openCategories[cat.id] ? 'up' : 'down'}`}
                  style={{ fontSize: '0.7rem', opacity: 0.6 }}
                />
              </button>

              {/* Sub-labs */}
              {openCategories[cat.id] && (
                <ul style={{ listStyle: 'none', padding: '0 0 0 1rem', margin: 0 }}>
                  {cat.labs.map((lab) => (
                    <li key={lab.num} className="nav-item">
                      <NavLink
                        to={`/labs/${cat.id}/${lab.num}`}
                        className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                        style={{ fontSize: '0.8rem', paddingLeft: '0.75rem' }}
                      >
                        <i className="bi bi-bug" style={{ fontSize: '0.75rem' }} />
                        {lab.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}

          {/* Logout */}
          <li className="nav-header" style={{ marginTop: '0.5rem' }}>Account</li>
          <li className="nav-item">
            <button
              className="nav-link w-100 text-start border-0 bg-transparent"
              onClick={handleLogout}
              style={{ cursor: 'pointer', color: '#c2c7d0' }}
            >
              <i className="bi bi-box-arrow-right" />
              Logout
            </button>
          </li>
        </ul>
      </nav>
    </aside>
  )
}
