import type { ReactNode } from 'react'
import Sidebar from './Sidebar'

export default function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="wrapper">
      <Sidebar />
      <div className="content-wrapper">
        <div
          className="d-flex align-items-center px-4 py-3"
          style={{ background: '#fff', borderBottom: '1px solid #dee2e6', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
        >
          <h5 className="mb-0 fw-semibold">{title}</h5>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
