'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { apiGet, apiDelete } from '@/lib/api';
import { useToast } from '@/components/Toast';

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast, ToastContainer } = useToast();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAssessments: 0,
    avgScore: 0,
    recentAssessments: []
  });
  const [users, setUsers] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [activeTab, setActiveTab] = useState('stats'); // 'stats' | 'users' | 'assessments'
  const [searchQuery, setSearchQuery] = useState('');

  // Access check
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'admin') {
      showToast('عذراً، لا تملك الصلاحية الكافية للدخول لهذه الصفحة.', 'error');
      router.push('/dashboard');
      return;
    }

    const loadAdminData = async () => {
      try {
        setLoading(true);
        const [statsData, usersData, assessmentsData] = await Promise.all([
          apiGet('/admin/stats'),
          apiGet('/admin/users'),
          apiGet('/admin/assessments')
        ]);
        
        setStats(statsData);
        setUsers(usersData.users || []);
        setAssessments(assessmentsData.assessments || []);
      } catch (err) {
        showToast(err.message || 'فشل تحميل بيانات الإدارة.', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadAdminData();
  }, [user, authLoading, router, showToast]);

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف حساب المستخدم "${userName}"؟\nتنبيه: سيؤدي هذا الإجراء إلى حذف جميع التقييمات والإجابات التابعة لهذا المستخدم نهائياً ولا يمكن التراجع عنه.`)) {
      return;
    }

    try {
      await apiDelete(`/admin/users/${userId}`);
      showToast(`تم حذف المستخدم "${userName}" وبياناته بنجاح.`, 'success');
      
      // Refresh user list and assessments
      const [usersData, assessmentsData, statsData] = await Promise.all([
        apiGet('/admin/users'),
        apiGet('/admin/assessments'),
        apiGet('/admin/stats')
      ]);
      setUsers(usersData.users || []);
      setAssessments(assessmentsData.assessments || []);
      setStats(statsData);
    } catch (err) {
      showToast(err.message || 'فشل حذف المستخدم.', 'error');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="loading-page">
        <div className="spinner"></div>
      </div>
    );
  }

  // Helper translations for level
  const getLevelBadge = (level, pct) => {
    if (!pct && pct !== 0) return <span className="badge">قيد الإنجاز</span>;
    if (level === 'high' || pct >= 80) return <span className="badge badge-success">امتثال عالٍ</span>;
    if (level === 'good' || pct >= 60) return <span className="badge badge-primary">امتثال جيد</span>;
    if (level === 'medium' || pct >= 40) return <span className="badge badge-warning">امتثال متوسط</span>;
    return <span className="badge badge-error">امتثال ضعيف</span>;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('fr-TN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter users/assessments based on search query
  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.organization && u.organization.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredAssessments = assessments.filter(a => 
    a.association_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.user_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="dashboard">
      <ToastContainer />
      
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div>
          <h1>لوحة إدارة المنصة</h1>
          <p className="welcome-msg">مرحباً بك، {user?.name}. يمكنك هنا الاطلاع على إحصائيات المنصة وإدارة حسابات الجمعيات.</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="admin-tabs">
        <button 
          onClick={() => { setActiveTab('stats'); setSearchQuery(''); }}
          className={activeTab === 'stats' ? 'btn-cta' : 'btn-ghost'}
          style={{ padding: '8px 20px', fontSize: '13px' }}
        >
          الإحصائيات العامة
        </button>
        <button 
          onClick={() => { setActiveTab('users'); setSearchQuery(''); }}
          className={activeTab === 'users' ? 'btn-cta' : 'btn-ghost'}
          style={{ padding: '8px 20px', fontSize: '13px' }}
        >
          إدارة المستخدمين ({users.length})
        </button>
        <button 
          onClick={() => { setActiveTab('assessments'); setSearchQuery(''); }}
          className={activeTab === 'assessments' ? 'btn-cta' : 'btn-ghost'}
          style={{ padding: '8px 20px', fontSize: '13px' }}
        >
          استعراض التقييمات ({assessments.length})
        </button>
      </div>

      {/* Tab Contents: Stats */}
      {activeTab === 'stats' && (
        <div>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card">
              <div className="card-label">إجمالي الجمعيات والمستخدمين</div>
              <div className="card-value">{stats.totalUsers}</div>
              <div className="card-sub">حساب مسجل بالمنصة</div>
            </div>
            
            <div className="summary-card">
              <div className="card-label">إجمالي عمليات التقييم</div>
              <div className="card-value">{stats.totalAssessments}</div>
              <div className="card-sub">منها المكتمل وقيد الإنجاز</div>
            </div>

            <div className="summary-card">
              <div className="card-label">متوسط نسبة الامتثال الإجمالية</div>
              <div className="card-value" style={{ color: 'var(--color-secondary)' }}>{stats.avgScore}%</div>
              <div className="card-sub">للتقييمات المكتملة فقط</div>
            </div>
          </div>

          {/* Recent Assessments table */}
          <div className="data-table-wrap">
            <div className="data-table-header">
              <h3>آخر التقييمات المجراة على المنصة</h3>
            </div>
            {stats.recentAssessments && stats.recentAssessments.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>اسم الجمعية</th>
                      <th>المسؤول</th>
                      <th>حالة التقييم</th>
                      <th>النسبة</th>
                      <th>المستوى</th>
                      <th>تاريخ البدء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentAssessments.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 'bold' }}>{a.association_name}</td>
                        <td>
                          <div>{a.user_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{a.user_email}</div>
                        </td>
                        <td>
                          {a.status === 'completed' ? (
                            <span className="badge badge-success">مكتمل</span>
                          ) : (
                            <span className="badge badge-warning">قيد الإنجاز</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 'bold' }}>{a.status === 'completed' ? `${a.percentage}%` : '-'}</td>
                        <td>{getLevelBadge(a.level, a.percentage)}</td>
                        <td>{formatDate(a.started_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>لا توجد أي تقييمات مسجلة حالياً.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Input for lists */}
      {activeTab !== 'stats' && (
        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            className="form-input"
            placeholder={activeTab === 'users' ? "البحث عن مستخدم بالاسم، البريد الإلكتروني، أو المنظمة..." : "البحث عن تقييم باسم الجمعية أو المستخدم..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* Tab Contents: Users */}
      {activeTab === 'users' && (
        <div className="data-table-wrap">
          <div className="data-table-header">
            <h3>قائمة الجمعيات والمستخدمين المسجلين</h3>
          </div>
          {filteredUsers.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>البريد الإلكتروني</th>
                    <th>المنظمة / الجمعية</th>
                    <th>الدور</th>
                    <th>تاريخ التسجيل</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 'bold' }}>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.organization || '-'}</td>
                      <td>
                        <span className={`badge ${u.role === 'admin' ? 'badge-success' : 'badge-primary'}`}>
                          {u.role === 'admin' ? 'مدير المنصة' : 'جمعية'}
                        </span>
                      </td>
                      <td>{formatDate(u.created_at)}</td>
                      <td>
                        {u.role !== 'admin' ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            className="btn-danger"
                            style={{ padding: '4px 10px' }}
                          >
                            حذف الحساب
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>حساب محمي</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>لا يوجد أي مستخدمين يطابقون بحثك.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: Assessments */}
      {activeTab === 'assessments' && (
        <div className="data-table-wrap">
          <div className="data-table-header">
            <h3>قائمة جميع تقييمات الامتثال</h3>
          </div>
          {filteredAssessments.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>اسم الجمعية</th>
                    <th>المستخدم المالك</th>
                    <th>حالة التقييم</th>
                    <th>مجموع النقاط</th>
                    <th>النسبة</th>
                    <th>المستوى</th>
                    <th>تاريخ البدء</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssessments.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 'bold' }}>{a.association_name}</td>
                      <td>
                        <div>{a.user_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{a.user_email}</div>
                      </td>
                      <td>
                        {a.status === 'completed' ? (
                          <span className="badge badge-success">مكتمل</span>
                        ) : (
                          <span className="badge badge-warning">قيد الإنجاز</span>
                        )}
                      </td>
                      <td>{a.status === 'completed' ? `${a.total_score} / ${a.max_score}` : '-'}</td>
                      <td style={{ fontWeight: 'bold' }}>{a.status === 'completed' ? `${a.percentage}%` : '-'}</td>
                      <td>{getLevelBadge(a.level, a.percentage)}</td>
                      <td>{formatDate(a.started_at)}</td>
                      <td>
                        {a.status === 'completed' && (
                          <Link
                            href={`/results/${a.id}`}
                            className="btn-sm"
                            style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}
                          >
                            عرض النتائج
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>لا توجد أي تقييمات تطابق بحثك.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
