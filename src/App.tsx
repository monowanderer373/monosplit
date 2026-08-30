import { lazy, Suspense, useEffect } from 'react'
import * as Sentry from '@sentry/react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './store/useStore'
import { resolveThemeId } from './lib/themes'
import { useT } from './lib/i18n'
import { AuthProvider, useAuth } from './hooks/useAuth'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'))
const PersonalLedgerPage = lazy(() => import('./pages/PersonalLedgerPage'))
const SpacesPage = lazy(() => import('./pages/SpacesPage'))
const SpacePage = lazy(() => import('./pages/SpacePage'))
const SpaceInvitePage = lazy(() => import('./pages/SpaceInvitePage'))
const FriendsPage = lazy(() => import('./pages/FriendsPage'))
const FriendInvitePage = lazy(() => import('./pages/FriendInvitePage'))
const SmartCapturePage = lazy(() => import('./pages/SmartCapturePage'))

function AppErrorFallback({ resetError }: { resetError: () => void }) {
  const t = useT()
  return (
    <main className="ms-page flex min-h-dvh items-center justify-center">
      <section className="ms-card-hero w-full max-w-md text-center" role="alert">
        <p className="ms-label">{t('app.errorLabel')}</p>
        <h1 className="mt-2 text-2xl font-extrabold">{t('app.errorTitle')}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ms-text-secondary)]">
          {t('app.errorHelp')}
        </p>
        <button className="ms-btn-primary mt-6 w-full" onClick={resetError}>
          {t('common.retry')}
        </button>
        <button className="ms-btn-ghost mt-2 w-full" onClick={() => window.location.reload()}>
          {t('app.reload')}
        </button>
      </section>
    </main>
  )
}

function PersonalLedgerRoute() {
  const { authUser } = useAuth()
  return authUser?.isAnonymous ? <Navigate to="/profile" replace /> : <PersonalLedgerPage />
}

function AppRoutes() {
  const themeId = useStore((s) => s.themeId)
  const lang = useStore((s) => s.lang)
  const t = useT()

  useEffect(() => {
    // resolveThemeId keeps retired palette ids in old localStorage from
    // resolving to a `[data-theme]` block that no longer exists.
    document.documentElement.setAttribute('data-theme', resolveThemeId(themeId))
  }, [themeId])

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang])

  return (
    <BrowserRouter>
      <Suspense fallback={<main className="ms-page flex min-h-dvh items-center justify-center">{t('app.opening')}</main>}>
        <Routes>
          <Route path="/" element={<PersonalLedgerRoute />} />
          <Route path="/quick-add" element={<PersonalLedgerRoute />} />
          <Route path="/spaces" element={<SpacesPage />} />
          <Route path="/space/:spaceId" element={<SpacePage />} />
          <Route path="/space-invite/:token" element={<SpaceInvitePage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/friend-invite/:token" element={<FriendInvitePage />} />
          <Route path="/capture" element={<SmartCapturePage />} />
          <Route path="/legacy-spaces" element={<Navigate to="/spaces" replace />} />
          <Route path="/group/:groupId" element={<Navigate to="/spaces" replace />} />
          <Route path="/embed/:groupId" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/invite/:token" element={<Navigate to="/spaces" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => <AppErrorFallback resetError={resetError} />}
      beforeCapture={(scope) => scope.setTag('error.boundary', 'app')}
    >
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Sentry.ErrorBoundary>
  )
}
