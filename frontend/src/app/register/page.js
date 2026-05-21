'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';

export default function Register() {
  const router = useRouter();

  // Redirect to login page after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/login');
    }, 5000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: '480px', textAlign: 'center' }}>
        <h2>إنشاء حساب جديد</h2>
        <div style={{ margin: '30px 0', fontSize: '16px', lineHeight: '1.6', color: 'var(--color-text-muted)' }}>
          <p style={{ marginBottom: '15px', color: 'var(--color-danger)' }}>
            ⚠️ إنشاء حسابات جديدة مباشرة من خلال الموقع غير متاح حالياً.
          </p>
          <p>
            يرجى الاتصال بمسؤول النظام أو إدارة المنصة لتسجيل جمعيتكم وتوفير بيانات الدخول الخاصة بكم.
          </p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <NextLink href="/login" className="btn-primary" style={{ textDecoration: 'none' }}>
            الذهاب إلى صفحة تسجيل الدخول
          </NextLink>
          <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            سيتم تحويلك تلقائياً خلال ثوانٍ...
          </span>
        </div>
      </div>
    </div>
  );
}
