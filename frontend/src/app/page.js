'use client';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from '@/components/ThemeProvider';

export default function Home() {
  const { user } = useAuth();
  const { theme } = useTheme();

  return (
    <div className="welcome">
      <span className="welcome-badge">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: '6px' }}>
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
        المرسوم 88 لسنة 2011 المنظم للجمعيات بتونس
      </span>

      <div style={{ marginBottom: '20px' }}>
        <img
          src={theme === 'dark' ? '/logo-white.png' : '/logo.png'}
          alt="شعار المنصة"
          style={{ maxHeight: '90px', width: 'auto', objectFit: 'contain' }}
        />
      </div>

      <div className="hero">
        <h1>منصة التقييم الذاتي للامتثال القانوني والمؤسساتي</h1>
        <p className="hero-tag">تشخيص • امتثال • حوكمة</p>
        <p className="hero-sub">
          80 مؤشراً تفصيلياً موزعاً على 17 محوراً قانونياً لمساعدة الجمعيات التونسية على تقييم مدى امتثالها للتراتيب والمراسيم الجاري بها العمل. احصل على تشخيص فوري وتوصيات عملية مع إمكانية إنشاء التقارير.
        </p>
      </div>

      <div className="welcome-card" style={{ margin: '0 auto', maxWidth: '500px' }}>
        {user ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: '20px', fontSize: '15px', color: 'var(--color-text-muted)' }}>
              مرحباً بك مجدداً، <strong>{user.name}</strong>. يمكنك البدء في تقييم جديد أو متابعة تقييماتك السابقة من لوحة التحكم.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Link href="/assessment" className="btn-start" style={{ textDecoration: 'none' }}>
                ابدأ تقييماً جديداً
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '8px' }}>
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </Link>
              <Link href="/dashboard" className="btn-ghost" style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                لوحة التحكم والتقارير السابقة
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: '20px', fontSize: '15px', color: 'var(--color-text-muted)' }}>
              ابدأ التقييم الذاتي للامتثال القانوني لجمعيتك مباشرة دون الحاجة لإنشاء حساب.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Link href="/assessment" className="btn-start" style={{ textDecoration: 'none' }}>
                ابدأ التقييم مباشرة
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '8px' }}>
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">🛡️</div>
          <h3>امتثال كامل للمرسوم 88</h3>
          <p>تغطية شاملة لكل التزامات الجمعيات التونسية من التأسيس والإشهار والجبائية إلى الرقابة والتمويل.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <h3>تقارير تفاعلية</h3>
          <p>احصل على تمثيل بياني تفاعلي وتفصيل دقيق لنسب الامتثال في كل محور من المحاور الـ17.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">💾</div>
          <h3>حفظ تلقائي ومتابعة</h3>
          <p>يتم حفظ إجاباتك تلقائياً أثناء التقدم في الاستبيان، مما يتيح لك العودة وإتمام التقييم في أي وقت.</p>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-number">17</div>
          <div className="stat-label">محوراً قانونياً</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">80</div>
          <div className="stat-label">مؤشراً للتقييم</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">100%</div>
          <div className="stat-label">حماية للبيانات</div>
        </div>
      </div>
    </div>
  );
}
