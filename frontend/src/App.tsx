import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/banking/LoginPage'
import DashboardPage from './pages/banking/DashboardPage'
import AccountsPage from './pages/banking/AccountsPage'
import AccountDetailPage from './pages/banking/AccountDetailPage'
import TransfersPage from './pages/banking/TransfersPage'
import StatementsPage from './pages/banking/StatementsPage'
import SearchPage from './pages/banking/SearchPage'
import ProfilePage from './pages/banking/ProfilePage'
import AdminPage from './pages/banking/AdminPage'
import ResetPage from './pages/banking/ResetPage'
import BusinessPage from './pages/banking/BusinessPage'
import ToolsPage from './pages/banking/ToolsPage'
import LabPage from './pages/labs/LabPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/banking/login" replace />} />
      <Route path="/banking/login" element={<LoginPage />} />
      <Route path="/banking/dashboard" element={<DashboardPage />} />
      <Route path="/banking/accounts" element={<AccountsPage />} />
      <Route path="/banking/accounts/:id" element={<AccountDetailPage />} />
      <Route path="/banking/transfers" element={<TransfersPage />} />
      <Route path="/banking/statements" element={<StatementsPage />} />
      <Route path="/banking/search" element={<SearchPage />} />
      <Route path="/banking/profile" element={<ProfilePage />} />
      <Route path="/banking/admin" element={<AdminPage />} />
      <Route path="/banking/reset" element={<ResetPage />} />
      <Route path="/banking/business" element={<BusinessPage />} />
      <Route path="/banking/tools" element={<ToolsPage />} />
      <Route path="/labs" element={<Navigate to="/labs/a01/1" replace />} />
      <Route path="/labs/:category/:labNum" element={<LabPage />} />
    </Routes>
  )
}

export default App
