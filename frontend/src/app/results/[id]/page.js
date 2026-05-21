'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { apiGet, apiPost } from '@/lib/api';
import { AXES, SCORE_LABELS } from '@/lib/questions';
import { useToast } from '@/components/Toast';
import Chart from 'chart.js/auto';

export default function Results({ params }) {
  const { id } = params;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast, ToastContainer } = useToast();

  const [debugError, setDebugError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [axisScores, setAxisScores] = useState([]);
  
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // Global error listener
  useEffect(() => {
    const handleError = (event) => {
      setDebugError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? event.error.stack : null
      });
    };
    const handleRejection = (event) => {
      setDebugError({
        message: event.reason ? event.reason.message || String(event.reason) : 'Unhandled promise rejection',
        error: event.reason && event.reason.stack ? event.reason.stack : null
      });
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Fetch assessment results
  useEffect(() => {
    if (authLoading) return;

    const fetchResults = async () => {
      try {
        const data = await apiGet(`/assessments/${id}`);
        setAssessment(data.assessment);
        setAnswers(data.answers || []);
        setAxisScores(data.axisScores || []);
      } catch (err) {
        setDebugError({
          message: 'Error inside fetchResults: ' + err.message,
          error: err.stack
        });
        showToast(err.message || 'فشل تحميل نتائج التقييم.', 'error');
        // comment out redirect for debugging so we can see the error screen
        // router.push(user ? '/dashboard' : '/');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [id, user, authLoading, router, showToast]);

  // Render Radar Chart
  useEffect(() => {
    if (loading || !axisScores.length || !canvasRef.current) return;

    try {
      // Destroy existing chart instance if any
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) throw new Error('Could not get 2D context from canvas');
      
      // Sort axis scores to maintain consistent axis ordering (1 to 17)
      const sortedScores = [...axisScores].sort((a, b) => a.axisId - b.axisId);
      
      const labels = sortedScores.map(axis => {
        const name = axis.axisName;
        return name.length > 14 ? name.substring(0, 14) + '...' : name;
      });
      
      const chartData = sortedScores.map(axis => { const n = Number(axis.percentage); return isFinite(n) ? n : 0; });
      
      const gridColor = 'rgba(142, 36, 170, 0.15)';
      const labelColor = '#8e24aa';

      chartInstanceRef.current = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: labels,
          datasets: [{
            label: 'نسبة الامتثال %',
            data: chartData,
            backgroundColor: 'rgba(0, 172, 193, 0.15)',
            borderColor: '#00acc1',
            borderWidth: 2,
            pointBackgroundColor: chartData.map(val => {
              return val < 40 ? '#c62828' : val < 60 ? '#e65100' : val < 80 ? '#f9a825' : '#2e7d32';
            }),
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `نسبة الامتثال: ${context.raw}%`;
                }
              }
            }
          },
          scales: {
            r: {
              min: 0,
              max: 100,
              ticks: {
                stepSize: 25,
                color: labelColor,
                font: { size: 10, family: "'Tajawal', sans-serif" },
                backdropColor: 'transparent'
              },
              grid: { color: gridColor },
              angleLines: { color: gridColor },
              pointLabels: {
                color: labelColor,
                font: { size: 10, family: "'Tajawal', sans-serif", weight: 'bold' }
              }
            }
          }
        }
      });
    } catch (err) {
      console.error('Chart.js render failed:', err);
      setDebugError({
        message: 'Chart.js render failed: ' + err.message,
        error: err.stack
      });
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [loading, axisScores]);

  if (debugError) {
    return (
      <div style={{ padding: '40px', direction: 'ltr', textAlign: 'left', background: '#ffebee', color: '#c62828', fontFamily: 'monospace', whiteSpace: 'pre-wrap', minHeight: '100vh' }}>
        <h2 style={{ color: '#b71c1c' }}>⚠️ Client Error Diagnostics</h2>
        <p>A client-side Javascript error occurred. This is why the page rendered blank.</p>
        <hr style={{ borderColor: '#c62828' }} />
        <p><strong>Message:</strong> {debugError.message}</p>
        {debugError.filename && <p><strong>Location:</strong> {debugError.filename}:{debugError.lineno}:{debugError.colno}</p>}
        {debugError.error && (
          <div>
            <strong>Stack Trace:</strong>
            <pre style={{ background: '#ffffff', padding: '15px', overflowX: 'auto', border: '1px solid #ffcdd2', borderRadius: '4px', marginTop: '10px', color: '#333' }}>{debugError.error}</pre>
          </div>
        )}
      </div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="loading-page">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!assessment) return (
    <div style={{ padding: '40px', textAlign: 'center', direction: 'rtl' }}>
      <h2>فشل تحميل نتائج التقييم</h2>
      <p>التقييم المطلوب غير موجود أو لم تكتمل الإجابة عليه.</p>
    </div>
  );

  // Helper to ensure percentage values are always finite numbers
  const safePct = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };

  // Calculate compliance rings
  const pct = safePct(assessment.percentage);
  const totalScore = assessment.total_score || 0;
  const maxScore = assessment.max_score || 160;
  const circ = 2 * Math.PI * 68;
  const strokeDashoffset = circ - (pct / 100) * circ;

  // Set level badge classes and text
  let levelClass = 'lv-low';
  let levelText = 'امتثال ضعيف';
  let summaryText = 'وضع جمعيتك القانوني يستوجب اتخاذ إجراءات تصحيحية فورية. يُرجى التواصل مع مختص قانوني في أقرب وقت ممكن.';

  if (pct >= 80) {
    levelClass = 'lv-high';
    levelText = 'امتثال عالٍ';
    summaryText = 'جمعيتك تحقق مستوى عاليًا من الامتثال القانوني. يُنصح بالحفاظ على هذا المستوى ومراجعة دورية للتحديثات التشريعية.';
  } else if (pct >= 60) {
    levelClass = 'lv-good';
    levelText = 'امتثال جيد';
    summaryText = 'جمعيتك في مستوى جيد مع وجود ثغرات تحتاج إلى معالجة. ركّز على المحاور ذات التقييم المنخفض.';
  } else if (pct >= 40) {
    levelClass = 'lv-mid';
    levelText = 'امتثال متوسط';
    summaryText = 'هناك ثغرات قانونية ومؤسسية تستدعي إجراءات تصحيحية عاجلة. يُنصح بالتواصل مع مستشار قانوني متخصص.';
  }

  // Get Priority Recommendations (under 60%)
  const weakAxes = [...axisScores]
    .filter(axis => safePct(axis.percentage) < 60)
    .sort((a, b) => safePct(a.percentage) - safePct(b.percentage))
    .slice(0, 6);

  // Excel Export
  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const radarImage = getPdfRadarImage();
      const response = await apiPost(`/export/${id}/excel`, { radarImage });
      const url = window.URL.createObjectURL(response);
      const a = document.createElement('a');
      a.href = url;
      a.download = `تقرير_امتثال_${assessment.association_name}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('تم إنشاء ملف Excel بنجاح.', 'success');
    } catch (err) {
      console.error('Excel export error:', err);
      showToast(`فشل إنشاء ملف Excel: ${err.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setExportingExcel(false);
    }
  };

  // Generate Chart Image for PDF
  const getPdfRadarImage = () => {
    if (canvasRef.current) {
      try {
        const url = canvasRef.current.toDataURL('image/png');
        if (url && url !== 'data:,' && url.length > 100) {
          return url;
        }
      } catch (err) {
        console.error('Failed to get radar image from onscreen canvas:', err);
      }
    }

    try {
      const hiddenCanvas = document.createElement('canvas');
      hiddenCanvas.width = 500;
      hiddenCanvas.height = 400;
      hiddenCanvas.style.position = 'absolute';
      hiddenCanvas.style.left = '-9999px';
      document.body.appendChild(hiddenCanvas);
      const ctx = hiddenCanvas.getContext('2d');
      
      const sortedScores = [...axisScores].sort((a, b) => a.axisId - b.axisId);
      const labels = sortedScores.map(axis => {
        const name = axis.axisName;
        return name.length > 14 ? name.substring(0, 14) + '...' : name;
      });
      const chartData = sortedScores.map(axis => { const n = Number(axis.percentage); return isFinite(n) ? n : 0; });
      
      const gridColor = 'rgba(142, 36, 170, 0.15)';
      const labelColor = '#8e24aa';
      
      const tempChart = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: labels,
          datasets: [{
            label: 'نسبة الامتثال %',
            data: chartData,
            backgroundColor: 'rgba(0, 172, 193, 0.15)',
            borderColor: '#00acc1',
            borderWidth: 2,
            pointBackgroundColor: chartData.map(val => {
              return val < 40 ? '#c62828' : val < 60 ? '#e65100' : val < 80 ? '#f9a825' : '#2e7d32';
            }),
            pointRadius: 4
          }]
        },
        options: {
          responsive: false,
          animation: false,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              min: 0, max: 100,
              ticks: { stepSize: 25, color: labelColor, font: { size: 10 }, backdropColor: 'transparent' },
              grid: { color: gridColor },
              angleLines: { color: gridColor },
              pointLabels: {
                color: labelColor,
                font: { size: 9, family: "'Tajawal', sans-serif", weight: 'bold' }
              }
            }
          }
        }
      });
      
      const imgUrl = hiddenCanvas.toDataURL('image/png');
      tempChart.destroy();
      document.body.removeChild(hiddenCanvas);
      return imgUrl;
    } catch (err) {
      console.error('Failed to generate fallback radar image:', err);
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQACAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    }
  };

  // PDF Export using html2pdf.js dynamically loaded
  const handleExportPdf = async () => {
    setExportingPdf(true);
    let originalScrollBehavior = '';
    let scrollTop = 0;
    let scrollLeft = 0;
    let container = null;
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;
      const assocName = assessment.association_name;
      const radarImgUrl = getPdfRadarImage();

      container = document.createElement('div');
      container.id = 'pdf-report-template';
      container.dir = 'rtl';
      container.style.position = 'absolute';
      container.style.top = '0';
      container.style.left = '-9999px';
      container.style.width = '210mm';
      container.style.opacity = '1';
      container.style.pointerEvents = 'none';
      container.style.backgroundColor = '#ffffff';

      // Inline CSS - NO FLEXBOX (html2canvas cannot render flex properly)
      const pdfStyles = `
        <style>
          #pdf-report-template { font-family: 'Tajawal', sans-serif; color: #1a1715; background-color: #ffffff; direction: rtl; text-align: right; line-height: 1.6; }
          .pdf-page { width: 210mm; min-height: 297mm; padding: 15mm 20mm; box-sizing: border-box; background-color: #ffffff; position: relative; page-break-after: always; }
          .pdf-page:last-child { page-break-after: avoid; }
          .pdf-header-band { background: linear-gradient(135deg, #e91e63, #8e24aa, #00acc1); color: #ffffff; padding: 24px 30px; border-radius: 8px; margin-bottom: 25px; overflow: hidden; }
          .pdf-header-title { float: right; }
          .pdf-header-title h1 { font-size: 20px; font-weight: 800; margin: 0 0 5px 0; color: #ffffff; }
          .pdf-header-title p { font-size: 12px; margin: 0; opacity: 0.9; }
          .pdf-header-badge { float: left; font-size: 26px; font-weight: 800; padding-top: 8px; }
          .pdf-meta-box { background-color: #f5f4f0; border-right: 4px solid #8e24aa; padding: 15px 20px; border-radius: 4px; margin-bottom: 30px; overflow: hidden; }
          .pdf-meta-item { font-size: 13px; display: inline-block; margin-left: 30px; }
          .pdf-meta-item strong { color: #8e24aa; }
          .pdf-score-section { margin-bottom: 35px; background: #ffffff; border: 1px solid #cfcac0; border-radius: 12px; padding: 25px; overflow: hidden; }
          .pdf-score-circle-container { position: relative; width: 120px; height: 120px; float: right; margin-left: 40px; }
          .pdf-score-circle-bg { position: absolute; width: 100%; height: 100%; transform: rotate(-90deg); top: 0; left: 0; }
          .pdf-score-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 28px; font-weight: 800; color: #8e24aa; z-index: 1; }
          .pdf-score-details { overflow: hidden; }
          .pdf-score-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; color: #1a1715; }
          .pdf-level-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
          .pdf-badge-high { background-color: #e8f5e9; color: #2e7d32; }
          .pdf-badge-good { background-color: #fffde7; color: #c8860a; }
          .pdf-badge-medium { background-color: #fff3e0; color: #e65100; }
          .pdf-badge-low { background-color: #ffebee; color: #c62828; }
          .pdf-score-desc { font-size: 12.5px; color: #66615c; margin: 0; line-height: 1.7; }
          .pdf-section-title { font-size: 15px; font-weight: 700; color: #8e24aa; border-bottom: 2px solid #f3e5f5; padding-bottom: 6px; margin-bottom: 18px; margin-top: 15px; }
          .pdf-chart-container { text-align: center; margin-bottom: 20px; }
          .pdf-chart-img { max-width: 420px; max-height: 300px; display: inline-block; }
          .pdf-axis-progress-row { overflow: hidden; margin-bottom: 12px; font-size: 11.5px; }
          .pdf-axis-name { width: 220px; font-weight: 700; color: #1a1715; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; float: right; line-height: 20px; }
          .pdf-axis-bar-container { margin: 6px 15px 0 15px; height: 8px; background-color: #edeae4; border-radius: 4px; overflow: hidden; }
          .pdf-axis-bar-fill { height: 100%; border-radius: 4px; }
          .pdf-axis-pct { width: 50px; text-align: left; font-weight: 800; font-size: 12.5px; float: left; line-height: 20px; }
          .pdf-recs-container { margin-bottom: 20px; }
          .pdf-rec-item { overflow: hidden; padding: 12px; border-bottom: 1px solid #e0ddd7; background-color: #faf9f6; border-radius: 6px; margin-bottom: 10px; }
          .pdf-rec-icon { width: 20px; height: 20px; border-radius: 50%; text-align: center; font-size: 11px; font-weight: 700; float: right; margin-left: 12px; line-height: 20px; }
          .pdf-rec-text { font-size: 12px; color: #66615c; line-height: 1.6; overflow: hidden; }
          .pdf-table-container { margin-bottom: 25px; }
          .pdf-table-title { font-size: 13.5px; font-weight: 700; color: #1a1715; margin-bottom: 10px; padding: 6px 12px; background: #edeae4; border-radius: 4px; }
          .pdf-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
          .pdf-table th { text-align: right; padding: 8px 10px; background-color: #faf9f6; color: #66615c; font-weight: 700; border-bottom: 1.5px solid #e0ddd7; }
          .pdf-table td { padding: 8px 10px; border-bottom: 1px solid #e0ddd7; color: #1a1715; line-height: 1.5; }
          .pdf-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10.5px; font-weight: 700; white-space: nowrap; }
          .pdf-badge-0 { background: #ffebee; color: #c62828; }
          .pdf-badge-1 { background: #fff3e0; color: #e65100; }
          .pdf-badge-2 { background: #e8f5e9; color: #2e7d32; }
          .pdf-footer { overflow: hidden; font-size: 10px; color: #aba59c; border-top: 1px solid #e0ddd7; padding-top: 10px; margin-top: 30px; }
          .pdf-footer span:first-child { float: right; }
          .pdf-footer span:last-child { float: left; }
        </style>
      `;

      // Build recommendations html
      let recsHtml = '';
      if (weakAxes.length === 0) {
        recsHtml = `
          <div class="pdf-rec-item">
            <div class="pdf-rec-text">🎉 <strong>ممتاز!</strong> لا توجد محاور بمستويات امتثال حرجة تحتاج إلى تحسين عاجل حالياً.</div>
          </div>`;
      } else {
        weakAxes.forEach(ax => {
          const crit = ((() => { const n = Number(ax.percentage); return isFinite(n) ? n : 0; })()) < 40;
          const icon = crit ? '!' : '~';
          const iconBg = crit ? '#ffebee' : '#fff3e0';
          const iconColor = crit ? '#c62828' : '#e65100';
          recsHtml += `
            <div class="pdf-rec-item">
              <div class="pdf-rec-icon" style="background-color: ${iconBg}; color: ${iconColor};">${icon}</div>
              <div class="pdf-rec-text">
                <strong>محور ${ax.axisName}</strong> — نسبة الامتثال الحالية هي <strong>${(() => { const n = Number(ax.percentage); return isFinite(n) ? n : 0; })()}%</strong>. 
                ${crit ? 'يتوجب اتخاذ تدابير تصحيحية فورية ومستعجلة لتفادي أي عقوبات قانونية.' : 'يُنصح بمراجعة الإجراءات المتبعة وتدارك النقائص في أقرب وقت.'}
              </div>
            </div>`;
        });
      }

      // Build axes progress bars html
      let axesBarsHtml = '';
      const sortedAxisScores = [...axisScores].sort((a, b) => a.axisId - b.axisId);
      sortedAxisScores.forEach(ax => {
        const ap = (() => { const n = Number(ax.percentage); return isFinite(n) ? n : 0; })();
        const fc = ap >= 80 ? '#2e7d32' : ap >= 60 ? '#c8860a' : ap >= 40 ? '#e65100' : '#c62828';
        axesBarsHtml += `
          <div class="pdf-axis-progress-row">
            <div class="pdf-axis-name">${ax.axisId}. ${ax.axisName}</div>
            <div class="pdf-axis-pct" style="color: ${fc};">${ap}%</div>
            <div class="pdf-axis-bar-container">
              <div class="pdf-axis-bar-fill" style="width: ${ap}%; background-color: ${fc};"></div>
            </div>
          </div>`;
      });

      // Distribute axes answers across 6 pages
      const pagesDistribution = [
        { pageNum: 4, startAxis: 0, endAxis: 2 },
        { pageNum: 5, startAxis: 3, endAxis: 5 },
        { pageNum: 6, startAxis: 6, endAxis: 8 },
        { pageNum: 7, startAxis: 9, endAxis: 11 },
        { pageNum: 8, startAxis: 12, endAxis: 14 },
        { pageNum: 9, startAxis: 15, endAxis: 16 }
      ];

      let detailPagesHtml = '';
      pagesDistribution.forEach(pInfo => {
        let pageAxesHtml = '';
        for (let ai = pInfo.startAxis; ai <= pInfo.endAxis; ai++) {
          if (ai >= AXES.length) break;
          const axisDef = AXES[ai];
          
          let tableRows = '';
          axisDef.questions.forEach((q, qi) => {
            const matchedAns = answers.find(a => a.axis_id === axisDef.id && a.question_index === qi);
            const scoreVal = matchedAns ? matchedAns.score : 0;
            const label = SCORE_LABELS[scoreVal];
            tableRows += `
              <tr>
                <td style="width: 65%; font-weight: 500;">${q}</td>
                <td style="width: 20%;"><span class="pdf-badge pdf-badge-${scoreVal}">${label}</span></td>
                <td style="width: 15%; text-align: center; font-weight: bold;">${scoreVal} / 2</td>
              </tr>`;
          });

          pageAxesHtml += `
            <div class="pdf-table-container">
              <div class="pdf-table-title">${axisDef.id}. ${axisDef.name}</div>
              <table class="pdf-table">
                <thead>
                  <tr>
                    <th style="width: 65%;">المؤشر / السؤال</th>
                    <th style="width: 20%;">حالة التقييم</th>
                    <th style="width: 15%; text-align: center;">النتيجة</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows}
                </tbody>
              </table>
            </div>`;
        }

        detailPagesHtml += `
          <div class="pdf-page">
            ${pageAxesHtml}
            <div class="pdf-footer">
              <span>صفحة ${pInfo.pageNum} من 9</span>
              <span>منصة التقييم الذاتي للامتثال القانوني للجمعيات</span>
            </div>
          </div>`;
      });

      // Construct final template
      const strokeDash = 2 * Math.PI * 52;
      const strokeDashoffsetVal = strokeDash - (pct / 100) * strokeDash;
      const formattedDate = new Date(assessment.completed_at || assessment.started_at).toLocaleDateString('fr-TN');

      container.innerHTML = `
        ${pdfStyles}
        
        <!-- PAGE 1: TITLE & COVER -->
        <div class="pdf-page">
          <div class="pdf-header-band">
            <div class="pdf-header-title">
              <h1>تقرير تقييم الامتثال القانوني والمؤسساتي</h1>
              <p>منصة التقييم الذاتي للجمعيات التونسية — المرسوم 88 لسنة 2011</p>
            </div>
            <div class="pdf-header-badge">تشخيص</div>
          </div>
          
          <div class="pdf-meta-box">
            <div class="pdf-meta-item">اسم الجمعية: <strong>${assocName}</strong></div>
            <div class="pdf-meta-item">تاريخ إصدار التقرير: <strong>${formattedDate}</strong></div>
            <div class="pdf-meta-item">حالة التشخيص: <strong>مكتمل</strong></div>
          </div>
          
          <div class="pdf-score-section">
            <div class="pdf-score-circle-container">
              <svg class="pdf-score-circle-bg" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#f0ede8" stroke-width="10"></circle>
                <circle cx="60" cy="60" r="52" fill="none" stroke="#8e24aa" stroke-dasharray="${strokeDash}" stroke-dashoffset="${strokeDashoffsetVal}" stroke-width="10" stroke-linecap="round"></circle>
              </svg>
              <div class="pdf-score-text">${pct}%</div>
            </div>
            <div class="pdf-score-details">
              <div class="pdf-score-title">نتيجة تقييم الامتثال الإجمالية</div>
              <span class="pdf-level-badge pdf-badge-${assessment.level}">${levelText}</span>
              <div style="font-size: 13.5px; font-weight: 700; color: #8e24aa; margin-bottom: 6px;">مجموع النقاط: ${totalScore} من أصل ${maxScore} نقطة</div>
              <p class="pdf-score-desc">${summaryText}</p>
            </div>
          </div>
          
          <div class="pdf-section-title">ملخص حوكمة الامتثال</div>
          <p style="font-size: 13px; color: #66615c; margin-bottom: 20px; line-height: 1.7;">
            يُمثل هذا التقرير تشخيصاً ذاتياً مبنياً على الإجابات المصرح بها من قِبل الجمعية بخصوص 80 مؤشراً قانونياً موزعاً على 17 محوراً رئيسياً وفق مقتضيات المرسوم عدد 88 لسنة 2011 والمتعلق بتنظيم الجمعيات في تونس. يرجى توظيف التوصيات الواردة في هذا التقرير لتصحيح مواطن الخلل.
          </p>
          
          <div class="pdf-footer">
            <span>صفحة 1 من 9</span>
            <span>منصة التقييم الذاتي للامتثال القانوني للجمعيات</span>
          </div>
        </div>

        <!-- PAGE 2: RADAR CHART & RECOMMENDATIONS -->
        <div class="pdf-page">
          <div class="pdf-section-title" style="margin-top: 0;">مخطط توزيع الأداء</div>
          <div class="pdf-chart-container">
            <img src="${radarImgUrl}" class="pdf-chart-img" alt="مخطط الأداء" />
          </div>
          
          <div class="pdf-section-title">التوصيات ذات الأولوية</div>
          <div class="pdf-recs-container">
            ${recsHtml}
          </div>
          
          <div class="pdf-footer">
            <span>صفحة 2 من 9</span>
            <span>منصة التقييم الذاتي للامتثال القانوني للجمعيات</span>
          </div>
        </div>

        <!-- PAGE 3: AXES COMPLIANCE BAR OVERVIEW -->
        <div class="pdf-page">
          <div class="pdf-section-title" style="margin-top: 0; margin-bottom: 25px;">مستويات الامتثال التفصيلية للمحاور (17 محوراً)</div>
          <div style="margin-top: 10px;">
            ${axesBarsHtml}
          </div>
          
          <div class="pdf-footer">
            <span>صفحة 3 من 9</span>
            <span>منصة التقييم الذاتي للامتثال القانوني للجمعيات</span>
          </div>
        </div>

        <!-- PAGES 4 to 9: DETAILED ANSWERS -->
        ${detailPagesHtml}
      `;

      document.body.appendChild(container);

      const opt = {
        margin: 0,
        filename: `تقرير_امتثال_${assocName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794,
          windowHeight: container.scrollHeight || 3000,
          onclone: (clonedDoc) => {
            const clonedContainer = clonedDoc.getElementById('pdf-report-template');
            if (clonedContainer) {
              clonedContainer.style.position = 'relative';
              clonedContainer.style.left = '0';
              clonedContainer.style.top = '0';
              clonedContainer.style.opacity = '1';
              clonedContainer.style.zIndex = '9999';
              clonedContainer.style.pointerEvents = 'auto';

              // Remove all canvas elements NOT inside the PDF template.
              // This prevents html2canvas from re-rendering Chart.js gradients
              // which crash with "addColorStop: non-finite value".
              const allCanvases = Array.from(clonedDoc.querySelectorAll('canvas'));
              allCanvases.forEach(c => {
                if (!clonedContainer.contains(c)) {
                  c.remove();
                }
              });

              // Hide only main UI elements to prevent overlay/interference,
              // keeping scripts, styles, link tags, and html2canvas helper elements.
              const children = Array.from(clonedDoc.body.children);
              children.forEach(child => {
                const tagName = child.tagName.toLowerCase();
                const isHelperTag = ['script', 'style', 'link', 'iframe'].includes(tagName);
                const isHtml2Pdf = child.classList.contains('html2pdf__container') || child.id === 'html2pdf__container';

                if (child !== clonedContainer && 
                    !child.contains(clonedContainer) && 
                    !isHtml2Pdf && 
                    !isHelperTag) {
                  child.style.display = 'none';
                }
              });
            }
          }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'css' }
      };

      // Disable smooth scroll temporarily
      originalScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';

      // Scroll to top
      scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      window.scrollTo(0, 0);

      // Wait for browser to fully render the container
      await new Promise(resolve => setTimeout(resolve, 1500));

      await html2pdf().set(opt).from(container).save();
      showToast('تم إنشاء تقرير PDF بنجاح.', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast(`حدث خطأ أثناء إنشاء ملف PDF: ${err.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      if (container && document.getElementById('pdf-report-template')) {
        document.body.removeChild(container);
      }
      if (originalScrollBehavior) {
        document.documentElement.style.scrollBehavior = originalScrollBehavior;
      }
      window.scrollTo(scrollLeft, scrollTop);
      setExportingPdf(false);
    }
  };

  return (
    <div className="results">
      <ToastContainer />
      
      {/* Hero Section */}
      <div className="results-hero">
        <h2>نتائج تقييم الامتثال</h2>
        <div className="assoc-name">{assessment.association_name}</div>
        
        {/* Score Ring */}
        <div className="score-ring">
          <svg viewBox="0 0 160 160" width="160" height="160">
            <defs>
              <linearGradient id="brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e91e63" />
                <stop offset="50%" stopColor="#8e24aa" />
                <stop offset="100%" stopColor="#00acc1" />
              </linearGradient>
            </defs>
            <circle className="ring-bg" cx="80" cy="80" r="68" />
            <circle
              className="ring-fill"
              cx="80"
              cy="80"
              r="68"
              stroke="url(#brand-grad)"
              strokeDasharray={circ}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="score-inner">
            <div className="score-pct">{pct}%</div>
            <div className="score-points">
              {totalScore} / {maxScore} نقطة
            </div>
            <div className="score-sub">الامتثال الإجمالي</div>
          </div>
        </div>

        {/* Level Badge */}
        <div className={`level-badge ${levelClass}`}>
          {pct >= 80 ? '✅ ' : pct >= 60 ? '🟡 ' : pct >= 40 ? '🟠 ' : '🔴 '}
          {levelText}
        </div>
        <p className="result-text">{summaryText}</p>
      </div>

      {/* Radar Chart */}
      <div className="radar-wrap">
        <div className="detail-h3" style={{ marginTop: 0 }}>مخطط الأداء بالمحاور (17 محوراً)</div>
        <div className="radar-chart-container">
          <canvas ref={canvasRef}></canvas>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="results-actions">
        <button
          type="button"
          onClick={handleExportExcel}
          className="btn-outline"
          disabled={exportingExcel || exportingPdf}
        >
          {exportingExcel ? 'جاري الإنشاء...' : 'إنشاء Excel تفصيلي'}
        </button>
        {/* PDF export button hidden */}
        <button
          type="button"
          onClick={() => window.print()}
          className="btn-ghost"
          disabled={exportingExcel || exportingPdf}
        >
          طباعة التقرير
        </button>
        <Link href="/assessment" className="btn-cta" style={{ textDecoration: 'none' }}>
          <span>تقييم جديد</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
      </div>

      {/* Priority Recommendations Box */}
      <div className="recs-box">
        <div className="recs-title">
          <span>⚠️ التوصيات ذات الأولوية (المحاور الأقل امتثالاً)</span>
        </div>
        <div id="rec-list">
          {weakAxes.length === 0 ? (
            <div className="rec-row">
              <div className="rec-text">🎉 ممتاز! لا توجد محاور بنسب امتثال منخفضة تتطلب تدخلاً عاجلاً.</div>
            </div>
          ) : (
            weakAxes.map((ax) => {
              const isCritical = safePct(ax.percentage) < 40;
              return (
                <div key={ax.axisId} className="rec-row">
                  <div className={`rec-icon ${isCritical ? 'ic-crit' : 'ic-mod'}`}>
                    {isCritical ? '!' : '~'}
                  </div>
                  <div className="rec-text">
                    <strong>{ax.axisName}</strong> — نسبة الامتثال الحالية هي <strong>{safePct(ax.percentage)}%</strong>. 
                    {isCritical ? ' يتوجب مراجعة الإجراءات فوراً وتدارك النقائص لتفادي العقوبات.' : ' يُنصح بتحسين جودة التوثيق والامتثال في هذا المحور.'}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Detailed Answers Section */}
      <div>
        <div className="detail-h3">تفاصيل الإجابات لجميع مؤشرات الامتثال</div>
        
        {AXES.map((axis) => {
          const matchedScore = axisScores.find(s => s.axisId === axis.id);
          const scorePercent = matchedScore ? safePct(matchedScore.percentage) : 0;
          
          return (
            <div key={axis.id} className="ax-detail">
              <div className="ax-detail-title" style={{ display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
                <span style={{ flexGrow: 1 }}>{axis.id}. {axis.name}</span>
                <span className="badge badge-primary" style={{ direction: 'ltr' }}>{scorePercent}%</span>
              </div>
              <div className="data-table-wrap" style={{ marginTop: '8px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '62%' }}>المؤشر / السؤال</th>
                        <th style={{ width: '22%' }}>حالة التقييم</th>
                        <th style={{ width: '16%', textAlign: 'center' }}>الدرجة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {axis.questions.map((q, qIndex) => {
                        const matchedAns = answers.find(a => a.axis_id === axis.id && a.question_index === qIndex);
                        const val = matchedAns ? matchedAns.score : 0;
                        return (
                          <tr key={qIndex}>
                            <td>{q}</td>
                            <td>
                              <span className={`badge b${val}`}>{SCORE_LABELS[val]}</span>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{val} / 2</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
