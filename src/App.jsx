import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Home from './pages/Home'
import Instructions from './pages/Instructions'
import Test from './pages/Test'
import Results from './pages/Results'
import Review from './pages/Review'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Analytics from './pages/Analytics'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/instructions/:testId" element={<ProtectedRoute><Instructions /></ProtectedRoute>} />
      <Route path="/test/:testId" element={<ProtectedRoute><Test /></ProtectedRoute>} />
      <Route path="/results/:testId" element={<ProtectedRoute><Results /></ProtectedRoute>} />
      <Route path="/review/:testId" element={<ProtectedRoute><Review /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
    </Routes>
  )
}
