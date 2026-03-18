'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Target,
  Megaphone,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { SalxLogo } from './SalxLogo'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/inbox', icon: MessageSquare, label: 'Inbox' },
  { href: '/clientes', icon: Users, label: 'Clientes' },
  { href: '/campanhas', icon: Megaphone, label: 'Campanhas' },
  { href: '/metas', icon: Target, label: 'Metas' },
  { href: '/configuracoes', icon: Settings, label: 'Configurações' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const supabase = createClientComponentClient()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 transition-all duration-300 border-r"
      style={{
        width: collapsed ? '64px' : '220px',
        backgroundColor: '#0a0a0a',
        borderColor: '#1a1a1a',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-between px-4 py-5 border-b"
        style={{ borderColor: '#1a1a1a', minHeight: '68px' }}
      >
        {!collapsed && (
          <Link href="/dashboard">
            <SalxLogo size="md" collapsed={false} />
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <SalxLogo size="sm" showText={false} />
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-white/10 transition-colors ml-auto"
          style={{ color: '#555' }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group"
              style={{
                backgroundColor: active ? 'rgba(41, 171, 226, 0.15)' : 'transparent',
                color: active ? '#29ABE2' : '#888',
              }}
              onMouseEnter={e => {
                if (!active) {
                  ;(e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.05)'
                  ;(e.currentTarget as HTMLElement).style.color = '#ccc'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = '#888'
                }
              }}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              {!collapsed && (
                <span className="text-sm font-medium whitespace-nowrap">{label}</span>
              )}
              {active && !collapsed && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: '#29ABE2' }}
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="px-2 py-4 border-t" style={{ borderColor: '#1a1a1a' }}>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full transition-all"
          style={{ color: '#555' }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.color = '#ff4444'
            ;(e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,68,68,0.08)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.color = '#555'
            ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
          }}
        >
          <LogOut size={18} />
          {!collapsed && <span className="text-sm font-medium">Sair</span>}
        </button>
      </div>
    </aside>
  )
}
