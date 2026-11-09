import { useParams } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import LabPanel from '../../components/LabPanel'
import { labsData } from './labData'

export default function LabPage() {
  const { category, labNum } = useParams<{ category: string; labNum: string }>()
  const key = `${category}-${labNum}`
  const labData = labsData[key]

  return (
    <div className="wrapper">
      <Sidebar />
      <div className="content-wrapper" style={{ padding: '2rem', background: '#151a26', color: '#dee2e6' }}>
        {labData ? (
          <LabPanel labData={labData} />
        ) : (
          <div className="text-center py-5">
            <i className="bi bi-exclamation-triangle" style={{ fontSize: '3rem', color: '#dc3545' }} />
            <h4 className="mt-3" style={{ color: '#dee2e6' }}>
              Lab not found: <code>{key}</code>
            </h4>
            <p style={{ color: '#6c757d' }}>
              Check the URL or select a lab from the sidebar.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
