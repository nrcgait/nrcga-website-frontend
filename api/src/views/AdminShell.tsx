import type { AdminContext } from '../lib/admin-context'
import { escapeHtml } from '../lib/admin-context'
import {
  canAccessAssets,
  canAccessContentSection,
  canAccessEventsSection,
  canEditOwnMember,
  canManageMembers,
  canManageNavigation,
  canManageUsers,
  ROLE_LABELS,
} from '../config/roles'
import type { UserRole } from '../config/roles'

type NavItem = { href: string; label: string }

function navItems(ctx: AdminContext): NavItem[] {
  const { user, chairCommittees } = ctx
  const items: NavItem[] = [{ href: '/admin', label: 'Dashboard' }]

  if (canManageMembers(user.role) || (user.member_id && canEditOwnMember(user.role))) {
    items.push({
      href:
        user.member_id && !canManageMembers(user.role)
          ? `/admin/members/${user.member_id}/edit`
          : '/admin/members',
      label: canManageMembers(user.role) ? 'Members' : 'My organization',
    })
  }

  if (canAccessEventsSection(user.role, chairCommittees)) {
    items.push({ href: '/admin/events', label: 'Events' })
  }

  if (canAccessContentSection(user.role, chairCommittees)) {
    items.push({ href: '/admin/content', label: user.role === 'chair' ? 'Committee content' : 'Content' })
  }

  if (canAccessAssets(user.role)) {
    items.push({ href: '/admin/assets', label: 'Assets' })
  }

  if (canManageUsers(user.role)) {
    items.push({ href: '/admin/users', label: 'Users & roles' })
  }

  if (canManageNavigation(user.role)) {
    items.push({ href: '/admin/navigation', label: 'Navigation' })
  }

  return items
}

export function AdminShell({
  ctx,
  title,
  activePath,
  children,
  publicSiteOrigin,
}: {
  ctx: AdminContext
  title: string
  activePath: string
  children: unknown
  publicSiteOrigin: string
}) {
  const nav = navItems(ctx)
  const displayName = ctx.user.display_name || ctx.user.email

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} — NRCGA Staff Portal</title>
        <link rel="stylesheet" href="/admin.css" />
      </head>
      <body class="admin-body">
        <div class="admin-layout">
          <aside class="admin-sidebar">
            <div class="admin-brand">
              <h1>NRCGA</h1>
              <p>Staff Portal</p>
            </div>
            <div class="admin-user-card">
              <p class="admin-user-name">{escapeHtml(displayName)}</p>
              <span class="admin-user-role">{ROLE_LABELS[ctx.user.role as UserRole]}</span>
            </div>
            <ul class="admin-nav">
              {nav.map((item) => (
                <li>
                  <a href={item.href} class={activePath === item.href ? 'active' : ''}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <div class="admin-sidebar-footer">
              <a href={publicSiteOrigin}>View public site</a>
              <a href="/admin/logout">Sign out</a>
            </div>
          </aside>
          <main class="admin-main">
            <header class="admin-page-header">
              <p class="admin-page-eyebrow">NRCGA Staff Portal</p>
              <h2>{title}</h2>
            </header>
            <div class="admin-page-body">{children}</div>
          </main>
        </div>
      </body>
    </html>
  )
}

export function LoginPage({ error }: { error?: string }) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sign in — NRCGA Staff Portal</title>
        <link rel="stylesheet" href="/admin.css" />
      </head>
      <body class="login-wrap">
        <div class="login-card">
          <div class="login-brand-mark">N</div>
          <h1>Staff Portal</h1>
          <p>Sign in to manage website content.</p>
          {error ? <div class="error">{escapeHtml(error)}</div> : null}
          <form method="post" action="/admin/login" class="admin-form">
            <label>Email</label>
            <input type="email" name="email" required autoComplete="email" />
            <label>Password</label>
            <input type="password" name="password" required autoComplete="current-password" />
            <div class="admin-actions">
              <button type="submit" class="btn btn-primary">
                Sign in
              </button>
            </div>
          </form>
        </div>
      </body>
    </html>
  )
}
