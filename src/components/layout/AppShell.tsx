import { Link, NavLink, Outlet } from 'react-router-dom'
import { LogIn, LogOut, Maximize, Minimize } from 'lucide-react'
import logoWhite from '@/assets/brand/logo-unita-white.png'
import { HOME_BY_ROLE, NAV } from '@/app/navigation'
import { Button } from '@/components/ui'
import { useFullscreen } from '@/hooks/useFullscreen'
import { useAuth } from '@/lib/auth'
import { cn } from '@/utils/cn'
import { DemoUserSwitcher } from './DemoUserSwitcher'

/** Header grafite fixo (56px) com borda laranja de 2px — DESIGN_SYSTEM §7. Menu filtrado pelo papel. */
export function AppShell() {
  const { user, demo, signOut, can } = useAuth()
  const { isFullscreen, toggleFullscreen, supported: fullscreenSupported } = useFullscreen()

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b-2 border-primary bg-secondary">
        <div className="flex h-14 items-center gap-6 px-4 lg:px-6 2xl:px-10">
          <NavLink to={user ? HOME_BY_ROLE[user.role] : '/'} className="shrink-0" aria-label="Início">
            <img src={logoWhite} alt="Unità Engenharia" className="h-7" />
          </NavLink>
          <nav className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="Principal">
            {NAV.filter((n) => can(n.permission)).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-control px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                    isActive ? 'bg-white/10 text-white' : 'text-ink-300 hover:text-white',
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {demo && <DemoUserSwitcher />}
            {user && (
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-sm font-semibold text-white">{user.fullName}</p>
                <p className="text-xs text-ink-400">{user.workName ? `${user.roleLabel} · ${user.workName}` : user.roleLabel}</p>
              </div>
            )}
            {fullscreenSupported && (
              <Button
                variant="inverse"
                size="sm"
                icon={isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
                onClick={toggleFullscreen}
                aria-pressed={isFullscreen}
                title={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
              >
                <span className="hidden md:inline">{isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</span>
              </Button>
            )}
            {!demo &&
              (user?.guest ? (
                // Obra usa sem login; analista e gestão entram por aqui
                <Link to="/entrar">
                  <Button variant="inverse" size="sm" icon={<LogIn className="size-4" />}>
                    Entrar
                  </Button>
                </Link>
              ) : (
                <Button variant="inverse" size="sm" icon={<LogOut className="size-4" />} onClick={signOut}>
                  Sair
                </Button>
              ))}
          </div>
        </div>
      </header>
      <main className="px-4 pt-4 pb-8 lg:px-6 2xl:px-10">
        <Outlet />
      </main>
    </div>
  )
}
