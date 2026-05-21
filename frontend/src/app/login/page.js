'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/navigation'; // Wait, let's use Link from next/link for client-side navigation
import NextLink from 'next/link';
import { useAuth } from '@/components/AuthProvider';

export default function Login() {
  const { user, login, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('يرجى كتابة البريد الإلكتروني وكلمة المرور.');
      return;
    }
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'فشل تسجيل الدخول. يرجى التثبت من البيانات.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || (user && !submitting)) {
    return (
      <div className="loading-page">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>تسجيل الدخول</h2>
        <p className="auth-sub">ادخل إلى لوحة تحكم الجمعية للبدء في التقييم أو استعراض التقارير</p>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="field-label" htmlFor="email">البريد الإلكتروني</label>
            <input
              type="email"
              id="email"
              className="form-input"
              placeholder="example@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="field-label" htmlFor="password">كلمة المرور</label>
            <input
              type="password"
              id="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="auth-footer">
          حسابات المستخدمين يتم إنشاؤها من قبل إدارة المنصة.
        </div>
      </div>
    </div>
  );
}
