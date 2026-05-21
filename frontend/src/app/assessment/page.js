'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { AXES, SCORE_LABELS, TOTAL_QUESTIONS, AXES_PER_PAGE } from '@/lib/questions';
import { useToast } from '@/components/Toast';

// Component that uses useSearchParams wrapped in Suspense
function QuizContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast, ToastContainer } = useToast();

  const assessmentId = searchParams.get('id');

  const [assocName, setAssocName] = useState('');
  const [activeAssessmentId, setActiveAssessmentId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState(false);

  // Total pages
  const totalPages = Math.ceil(AXES.length / AXES_PER_PAGE);

  // Fetch assessment if ID is provided
  useEffect(() => {
    if (authLoading) return;

    if (assessmentId) {
      const loadAssessment = async () => {
        setLoading(true);
        try {
          const data = await apiGet(`/assessments/${assessmentId}`);
          if (data.assessment.status === 'completed') {
            router.push(`/results/${assessmentId}`);
            return;
          }
          setAssocName(data.assessment.association_name);
          setActiveAssessmentId(assessmentId);
          setQuizStarted(true);

          const loadedAnswers = {};
          if (data.answers && Array.isArray(data.answers)) {
            data.answers.forEach(a => {
              loadedAnswers[`${a.axis_id}-${a.question_index}`] = a.score;
            });
          }
          setAnswers(loadedAnswers);
        } catch (err) {
          showToast(err.message || 'فشل تحميل التقييم.', 'error');
          router.push(user ? '/dashboard' : '/');
        } finally {
          setLoading(false);
        }
      };
      loadAssessment();
    }
  }, [assessmentId, user, authLoading, router, showToast]);

  const handleStartQuiz = async (e) => {
    e.preventDefault();
    if (!assocName.trim()) {
      showToast('يرجى إدخال اسم الجمعية للبدء.', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await apiPost('/assessments', { associationName: assocName.trim() });
      const newId = data.assessment.id;
      setActiveAssessmentId(newId);
      setQuizStarted(true);
      router.replace(`/assessment?id=${newId}`);
    } catch (err) {
      showToast(err.message || 'فشل إنشاء تقييم جديد.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectScore = async (axisId, questionIndex, score) => {
    const key = `${axisId}-${questionIndex}`;
    
    // Save locally first
    setAnswers(prev => ({
      ...prev,
      [key]: score
    }));

    // Auto-save to backend
    try {
      await apiPut(`/assessments/${activeAssessmentId}/answers`, {
        answers: [{ axisId, questionIndex, score }]
      });
    } catch (err) {
      showToast('خطأ في الاتصال بالخادم. لم يتم حفظ الإجابة الأخيرة.', 'error');
    }
  };

  // Get current page axes
  const startIdx = currentPage * AXES_PER_PAGE;
  const pageAxes = AXES.slice(startIdx, startIdx + AXES_PER_PAGE);

  // Validate that all questions on current page are answered
  const getUnansweredOnPage = () => {
    const unanswered = [];
    pageAxes.forEach((axis) => {
      axis.questions.forEach((_, qIndex) => {
        const key = `${axis.id}-${qIndex}`;
        if (answers[key] === undefined) {
          unanswered.push(key);
        }
      });
    });
    return unanswered;
  };

  const handleNextPage = async () => {
    const unanswered = getUnansweredOnPage();
    if (unanswered.length > 0) {
      setValidationError(true);
      // Pulse animation/outline on unanswered cards
      unanswered.forEach(key => {
        const el = document.getElementById(`card-${key}`);
        if (el) {
          el.style.outline = '2px solid var(--color-error)';
          setTimeout(() => {
            el.style.outline = '';
          }, 2500);
        }
      });
      // Scroll to the first unanswered question card
      const firstUnansweredEl = document.getElementById(`card-${unanswered[0]}`);
      if (firstUnansweredEl) {
        firstUnansweredEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setValidationError(false);

    if (currentPage >= totalPages - 1) {
      // Submit assessment
      setSubmitting(true);
      try {
        await apiPost(`/assessments/${activeAssessmentId}/complete`);
        router.push(`/results/${activeAssessmentId}`);
      } catch (err) {
        showToast(err.message || 'فشل إتمام التقييم.', 'error');
        setSubmitting(false);
      }
    } else {
      setCurrentPage(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
      setValidationError(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="loading-page">
        <div className="spinner"></div>
      </div>
    );
  }

  // Answered questions count
  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round((answeredCount / TOTAL_QUESTIONS) * 100);

  if (!quizStarted) {
    return (
      <div className="welcome">
        <ToastContainer />
        <span className="welcome-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: '6px' }}>
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
          </svg>
          المرسوم 88 لسنة 2011
        </span>
        
        <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '16px' }}>
          بدء تقييم الامتثال الذاتي للجمعية
        </h1>
        <p className="welcome-sub" style={{ marginBottom: '32px' }}>
          يرجى إدخال اسم الجمعية الرسمي لبدء التشخيص. يمكنك إغلاق التقييم والعودة إليه لاحقاً في أي وقت.
        </p>

        <form onSubmit={handleStartQuiz} className="welcome-card" style={{ margin: '0 auto' }}>
          <label className="field-label" htmlFor="assocName">اسم الجمعية الرسمي</label>
          <input
            type="text"
            id="assocName"
            className="welcome-input"
            placeholder="مثال: الجمعية التونسية للشفافية المالية"
            value={assocName}
            onChange={(e) => setAssocName(e.target.value)}
            required
            autoFocus
          />

          <div className="field-label" style={{ marginTop: '16px', marginBottom: '8px' }}>المحاور الرئيسية التي سيشملها التقييم (17 محوراً):</div>
          <div className="axes-preview" style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--color-divider)', padding: '10px', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-2)', marginBottom: '24px' }}>
            {AXES.map(a => (
              <div key={a.id} className="axis-chip">
                <span className="axis-chip-dot"></span>
                <span>{a.name}</span>
              </div>
            ))}
          </div>

          <button type="submit" className="btn-start">
            ابدأ التقييم الآن
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '8px' }}>
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="quiz-layout">
      <ToastContainer />
      
      {/* Progress Bar */}
      <div className="progress-bar-wrap">
        <div className="progress-header">
          <span className="progress-label">اسم الجمعية: <strong>{assocName}</strong></span>
          <span className="progress-count">{answeredCount} / {TOTAL_QUESTIONS} سؤالاً مكتمل</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      {validationError && (
        <div className="warn-box">
          ⚠️ يرجى الإجابة على جميع المؤشرات المعروضة في الصفحة الحالية قبل المتابعة.
        </div>
      )}

      {/* Quiz Body (Paginated axes) */}
      <div>
        {pageAxes.map((axis) => (
          <div key={axis.id} className="axis-section">
            <div className="axis-header">
              <div className="axis-number">{axis.id}</div>
              <div className="axis-title">{axis.name}</div>
              <span className="axis-q-count">{axis.questions.length} مؤشرات</span>
            </div>

            {axis.questions.map((question, qIndex) => {
              const key = `${axis.id}-${qIndex}`;
              const selectedValue = answers[key];
              
              return (
                <div
                  key={key}
                  id={`card-${key}`}
                  className={`question-card ${selectedValue !== undefined ? 'answered' : ''}`}
                >
                  <div className="question-text">{question}</div>
                  <div className="score-options">
                    {[0, 1, 2].map((v) => {
                      const isSelected = selectedValue === v;
                      const selClass = isSelected ? `sel-${v}` : '';
                      return (
                        <button
                          key={v}
                          type="button"
                          className={`score-btn ${selClass}`}
                          onClick={() => handleSelectScore(axis.id, qIndex, v)}
                        >
                          <span className="score-dot"></span>
                          {SCORE_LABELS[v]} ({v})
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Navigation Buttons */}
      <div className="quiz-nav">
        <button
          type="button"
          onClick={handlePrevPage}
          className="btn-nav"
          disabled={currentPage === 0 || submitting}
        >
          السابق
        </button>

        <span className="page-ind">
          صفحة {currentPage + 1} من {totalPages}
        </span>

        <button
          type="button"
          onClick={handleNextPage}
          className="btn-cta"
          disabled={submitting}
        >
          <span>{currentPage >= totalPages - 1 ? (submitting ? 'جاري الحفظ والإنهاء...' : 'إنهاء وعرض النتائج') : 'التالي'}</span>
          {currentPage < totalPages - 1 && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export default function Assessment() {
  return (
    <Suspense fallback={<div className="loading-page"><div className="spinner"></div></div>}>
      <QuizContent />
    </Suspense>
  );
}
