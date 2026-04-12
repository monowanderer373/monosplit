import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import GroupsPage from './pages/GroupsPage'
import GroupPage from './pages/GroupPage'
import EmbedPage from './pages/EmbedPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ProfilePage from './pages/ProfilePage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import InvitePage from './pages/InvitePage'
import { useStore } from './store/useStore'
import { AuthProvider } from './hooks/useAuth'

function AppRoutes() {
  const themeId = useStore((s) => s.themeId)

  useEffect(() => {
    if (themeId) {
      document.documentElement.setAttribute('data-theme', themeId)
    }
  }, [themeId])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GroupsPage />} />
        <Route path="/group/:groupId" element={<GroupPage />} />
        <Route path="/embed/:groupId" element={<EmbedPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/invite/:groupId" element={<InvitePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
