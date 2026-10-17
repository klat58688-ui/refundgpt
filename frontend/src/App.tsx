import { Navigate, Route, Routes } from 'react-router-dom'
import Analyze from './pages/Analyze'
import Dashboard from './pages/Dashboard'
import RequestsGrid from './pages/RequestsGrid'

export default function App() {
  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/requests" element={<RequestsGrid />} />
      <Route path="/analyze/:id" element={<Analyze />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
