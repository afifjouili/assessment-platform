'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import NextLink from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { apiGet, apiDelete } from '@/lib/api';
import { useToast } from '@/components/Toast';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast, ToastContainer } = useToast();

  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAssessments = useCallback(async () => {
    try {
      const data = await apiGet('/assessments');
      setAssessments(data.assessments || []);
    } catch (err) {
      showToast(err.message || 'فشل تحميل التقييمات.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else {
        fetchAssessments();
      }
    }
  }, [user, authLoading, router, fetchAssessments]);

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا التقييم؟')) return;
    try {
      await apiDelete(`/assessments/${id}`);
      showToast('تم حذف التقييم بنجاح.', 'success');
      fetchAssessments();
    } catch (err) {
      showToast(err.message || 'فشل حذف التقييم.', 'error');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="loading-page">
        <div className="spinner"></div>
      </div>
    );
  }

  // Calculate stats
  const completed = assessments.filter(a => a.status === 'completed');
  const inProgress = assessments.filter(a => a.status === 'in_progress');
  const totalCount = assessments.length;
  const avgScore = completed.length > 0
    ? Math.round(completed.reduce((sum, a) => sum + a.percentage, 0) / completed.length)
    : 0;

  const lastCompleted = completed[0];
  const lastLevelLabel = lastCompleted
    ? { high: 'امتثال عالٍ', good: 'امتثال جيد', medium: 'امتثال متوسط', low: 'امتثال ضعيف' }[lastCompleted.level]
    : 'لا يوجد';

  return (
    <div className="dashboard">
      <ToastContainer />

      <div className="dashboard-header">
        <div>
          <h1>لوحة تحكم الجمعية</h1>
          <p className="welcome-msg">مرحباً بك، <strong>{user?.name}</strong> في منصة التقييم الذاتي لامتثال الجمعيات.</p>
        </div>
        <NextLink href="/assessment" className="btn-cta" style={{ textDecoration: 'none' }}>
          ابدأ تقييماً جديداً
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </NextLink>
      </div>

      {/* Resume Banner if there is an in-progress assessment */}
      {inProgress.length > 0 && (
        <div className="resume-banner">
          <p>
            ⚠️ لديك تقييم غير مكتمل لجمعية <strong>«{inProgress[0].association_name}»</strong>. يمكنك مواصلة الإجابة عن الأسئلة المتبقية الآن!
          </p>
          <button
            onClick={() => router.push(`/assessment?id=${inProgress[0].id}`)}
            className="btn-resume"
          >
            مواصلة التقييم
          </button>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-label">إجمالي التقييمات</div>
          <div className="card-value">{totalCount}</div>
          <div className="card-sub">{inProgress.length} قيد الإنجاز / {completed.length} مكتمل</div>
        </div>
        <div className="summary-card">
          <div className="card-label">متوسط نسبة الامتثال</div>
          <div className="card-value">{avgScore}%</div>
          <div className="card-sub">للتقييمات المكتملة فقط</div>
        </div>
        <div className="summary-card">
          <div className="card-label">مستوى آخر تقييم</div>
          <div className="card-value" style={{ fontSize: '18px', paddingTop: '10px', paddingBottom: '4px' }}>
            {lastLevelLabel}
          </div>
          <div className="card-sub">{lastCompleted ? `بتاريخ ${new Date(lastCompleted.completed_at).toLocaleDateString('ar-TN')}` : '-'}</div>
        </div>
      </div>

      {/* Assessments List Table */}
      <div className="data-table-wrap">
        <div className="data-table-header">
          <h3>سجل التقييمات الذاتية للجمعية</h3>
        </div>

        {assessments.length === 0 ? (
          <div className="empty-state">
            <p>لا توجد تقييمات سابقة مسجلة لجمعيتك.</p>
            <NextLink href="/assessment" className="btn-outline" style={{ textDecoration: 'none' }}>
              ابدأ أول تقييم لجمعيتك الآن
            </NextLink>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>اسم الجمعية</th>
                  <th>الحالة</th>
                  <th>النتيجة</th>
                  <th>النسبة</th>
                  <th>تاريخ البدء</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: '700' }}>{a.association_name}</td>
                    <td>
                      {a.status === 'completed' ? (
                        <span className="badge badge-success">مكتمل</span>
                      ) : (
                        <span className="badge badge-warning">قيد الإنجاز</span>
                      )}
                    </td>
                    <td>
                      {a.status === 'completed' ? `${a.total_score} / ${a.max_score}` : '-'}
                    </td>
                    <td style={{ fontWeight: '800', color: a.status === 'completed' ? 'var(--color-primary)' : 'inherit' }}>
                      {a.status === 'completed' ? `${a.percentage}%` : '-'}
                    </td>
                    <td style={{ direction: 'ltr', textAlign: 'right' }}>
                      {new Date(a.started_at).toLocaleDateString('fr-TN')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {a.status === 'completed' ? (
                          <button
                            onClick={() => router.push(`/results/${a.id}`)}
                            className="btn-sm"
                          >
                            عرض النتائج
                          </button>
                        ) : (
                          <button
                            onClick={() => router.push(`/assessment?id=${a.id}`)}
                            className="btn-sm"
                            style={{ background: 'var(--color-secondary-light)', color: 'var(--color-secondary)' }}
                          >
                            مواصلة
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="btn-danger"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
