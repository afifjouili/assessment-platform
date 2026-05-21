'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { useTheme } from './ThemeProvider';

export default function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="header">
      <div className="header-brand">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <img
            src={theme === 'dark' ? '/logo-white.png' : '/logo.png'}
            alt="شعار أنا يقظ"
            style={{ height: '38px', width: 'auto', objectFit: 'contain' }}
          />
          <div>
            <div className="brand-title">منصة التقييم الذاتي</div>
            <div className="brand-sub">امتثال الجمعيات التونسية</div>
          </div>
        </Link>
      </div>

      <nav className={`header-nav ${menuOpen ? 'open' : ''}`}>
        <Link href="/" className="nav-link" onClick={() => setMenuOpen(false)}>الرئيسية</Link>
        {user && (
          <Link href="/dashboard" className="nav-link" onClick={() => setMenuOpen(false)}>لوحة التحكم</Link>
        )}
        {user?.role === 'admin' && (
          <Link href="/admin" className="nav-link" onClick={() => setMenuOpen(false)}>الإدارة</Link>
        )}
        {user && (
          <div className="mobile-user-menu">
            <span className="user-name">{user.name}</span>
            <button className="btn-ghost-sm" onClick={() => { logout(); setMenuOpen(false); }}>خروج</button>
          </div>
        )}
      </nav>

      <div className="header-actions">
        <button className="btn-icon" onClick={toggleTheme} aria-label="تبديل المظهر">
          {theme === 'dark' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              <circle cx="12" cy="12" r="5"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        {user && (
          <div className="user-menu">
            <span className="user-name">{user.name}</span>
            <button className="btn-ghost-sm" onClick={logout}>خروج</button>
          </div>
        )}

        <button className="btn-icon hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="القائمة">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen ? (
              <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
            ) : (
              <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
            )}
          </svg>
        </button>
      </div>
    </header>
  );
}
