import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import GroupsPage from './pages/GroupsPage'
import GroupPage from './pages/GroupPage'
import EmbedPage from './pages/EmbedPage'
import { useStore } from './store/useStore'
import { DEFAULT_THEME_ID } from './lib/themes'

export default function App() {
  const themeId = useStore((s) => s.themeId)

  useEffect(() => {
    if (themeId && themeId !== DEFAULT_THEME_ID) {
      document.documentElement.setAttribute('data-theme', themeId)
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [themeId])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GroupsPage />} />
        <Route path="/group/:groupId" element={<GroupPage />} />
        <Route path="/embed/:groupId" element={<EmbedPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
