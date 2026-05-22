import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getDbReady } from '@/lib/db';
import { optionalAuthenticate } from '@/lib/auth-helpers';
import { calculateAxisScores, AXES } from '@/lib/scoring';

async function buildExcelResponse(assessment, answers, axisScores, radarImage) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NGO Assessment Platform';
  workbook.created = new Date();

  const fontName = 'Segoe UI';
  const borderStyle = {
    top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
    left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
    bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
    right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
  };
  const purpleHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8E24AA' } };
  const tealHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00ACC1' } };
  const levelColors = {
    high: { font: 'FF2E7D32', fill: 'FFE8F5E9' },
    good: { font: 'FF00ACC1', fill: 'FFE0F7FA' },
    medium: { font: 'FFE65100', fill: 'FFFFF3E0' },
    low: { font: 'FFC62828', fill: 'FFFFEBEE' }
  };

  // --- 1. Summary Sheet ---
  const summarySheet = workbook.addWorksheet('ملخص التقييم');
  summarySheet.views = [{ rightToLeft: true, showGridLines: true }];
  summarySheet.columns = [
    { key: 'spacer', width: 3 },
    { key: 'label', width: 25 },
    { key: 'value', width: 35 }
  ];

  summarySheet.addRow([]);
  summarySheet.mergeCells('B2:C2');
  const titleCell = summarySheet.getCell('B2');
  titleCell.value = 'تقرير التقييم الشامل للجمعية';
  titleCell.font = { name: fontName, bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = purpleHeaderFill;
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(2).height = 40;
  summarySheet.addRow([]);

  const levelLabels = { high: 'امتثال عالٍ', good: 'امتثال جيد', medium: 'امتثال متوسط', low: 'امتثال ضعيف' };
  const statusText = assessment.status === 'completed' ? 'مكتمل' : 'قيد الإنجاز';
  const rowsData = [
    { label: 'اسم الجمعية', value: assessment.association_name },
    { label: 'حالة التقييم', value: statusText },
    { label: 'النتيجة الإجمالية', value: `${assessment.total_score} / ${assessment.max_score}` },
    { label: 'نسبة الامتثال', value: `${assessment.percentage}%`, isHighlight: true },
    { label: 'مستوى الامتثال', value: levelLabels[assessment.level] || assessment.level, isHighlight: true },
    { label: 'تاريخ البدء', value: assessment.started_at },
    { label: 'تاريخ الإتمام', value: assessment.completed_at || '-' }
  ];

  const levelStyle = levelColors[assessment.level] || { font: 'FF222222', fill: 'FFFFFFFF' };
  rowsData.forEach((item, index) => {
    const rowIndex = 4 + index;
    summarySheet.getRow(rowIndex).height = 25;
    const labelCell = summarySheet.getCell(`B${rowIndex}`);
    labelCell.value = item.label;
    labelCell.font = { name: fontName, bold: true, size: 11, color: { argb: 'FF333333' } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'right' };
    labelCell.border = borderStyle;
    const valCell = summarySheet.getCell(`C${rowIndex}`);
    valCell.value = item.value;
    valCell.font = { name: fontName, size: 11, color: { argb: 'FF222222' } };
    valCell.alignment = { vertical: 'middle', horizontal: 'right' };
    valCell.border = borderStyle;
    if (item.isHighlight) {
      valCell.font = { name: fontName, bold: true, size: 11, color: { argb: levelStyle.font } };
      valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: levelStyle.fill } };
    } else {
      valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    }
  });

  if (radarImage) {
    let radarBase64 = radarImage;
    const matches = radarBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) radarBase64 = matches[2];
    try {
      const imageId = workbook.addImage({ base64: radarBase64, extension: 'png' });
      summarySheet.addImage(imageId, 'E2:L18');
    } catch (imgErr) {
      console.error('Error adding radar image:', imgErr);
    }
  }

  // --- 2. Axis Scores Sheet ---
  const axisSheet = workbook.addWorksheet('نتائج المحاور');
  axisSheet.views = [{ rightToLeft: true, showGridLines: true }];
  axisSheet.columns = [
    { key: 'spacer', width: 3 },
    { key: 'axisName', width: 45 },
    { key: 'score', width: 15 },
    { key: 'maxScore', width: 15 },
    { key: 'percentage', width: 20 }
  ];
  axisSheet.addRow([]);
  axisSheet.mergeCells('B2:E2');
  const axisTitleCell = axisSheet.getCell('B2');
  axisTitleCell.value = 'تحليل نتائج محاور التقييم';
  axisTitleCell.font = { name: fontName, bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  axisTitleCell.fill = tealHeaderFill;
  axisTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  axisSheet.getRow(2).height = 35;
  axisSheet.addRow([]);

  const headers = [
    { col: 'B', val: 'المحور' }, { col: 'C', val: 'النتيجة' },
    { col: 'D', val: 'الحد الأقصى' }, { col: 'E', val: 'نسبة الامتثال' }
  ];
  axisSheet.getRow(4).height = 25;
  headers.forEach(h => {
    const cell = axisSheet.getCell(`${h.col}4`);
    cell.value = h.val;
    cell.font = { name: fontName, bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = purpleHeaderFill;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = borderStyle;
  });

  axisScores.forEach((axis, index) => {
    const rowIndex = 5 + index;
    axisSheet.getRow(rowIndex).height = 22;
    const nameCell = axisSheet.getCell(`B${rowIndex}`);
    nameCell.value = axis.axisName;
    nameCell.font = { name: fontName, size: 10 };
    nameCell.alignment = { vertical: 'middle', horizontal: 'right' };
    nameCell.border = borderStyle;
    const scoreCell = axisSheet.getCell(`C${rowIndex}`);
    scoreCell.value = axis.score;
    scoreCell.font = { name: fontName, size: 10 };
    scoreCell.alignment = { vertical: 'middle', horizontal: 'center' };
    scoreCell.border = borderStyle;
    const maxCell = axisSheet.getCell(`D${rowIndex}`);
    maxCell.value = axis.maxScore;
    maxCell.font = { name: fontName, size: 10 };
    maxCell.alignment = { vertical: 'middle', horizontal: 'center' };
    maxCell.border = borderStyle;
    const pctCell = axisSheet.getCell(`E${rowIndex}`);
    pctCell.value = axis.percentage / 100;
    pctCell.numFmt = '0%';
    pctCell.alignment = { vertical: 'middle', horizontal: 'center' };
    pctCell.border = borderStyle;
    const pct = axis.percentage;
    let colorStyle = levelColors.low;
    if (pct >= 80) colorStyle = levelColors.high;
    else if (pct >= 60) colorStyle = levelColors.good;
    else if (pct >= 40) colorStyle = levelColors.medium;
    pctCell.font = { name: fontName, bold: true, size: 10, color: { argb: colorStyle.font } };
    pctCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorStyle.fill } };
    const zebra = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 1 ? 'FFF9F2FB' : 'FFFFFFFF' } };
    nameCell.fill = zebra; scoreCell.fill = zebra; maxCell.fill = zebra;
  });

  const totalRowIndex = 5 + axisScores.length;
  axisSheet.getRow(totalRowIndex).height = 25;
  const totalLabelCell = axisSheet.getCell(`B${totalRowIndex}`);
  totalLabelCell.value = 'المجموع الإجمالي';
  totalLabelCell.font = { name: fontName, bold: true, size: 11 };
  totalLabelCell.alignment = { vertical: 'middle', horizontal: 'right' };
  axisSheet.getCell(`C${totalRowIndex}`).value = { formula: `=SUM(C5:C${totalRowIndex - 1})` };
  axisSheet.getCell(`D${totalRowIndex}`).value = { formula: `=SUM(D5:D${totalRowIndex - 1})` };
  axisSheet.getCell(`E${totalRowIndex}`).value = { formula: `=C${totalRowIndex}/D${totalRowIndex}` };
  axisSheet.getCell(`E${totalRowIndex}`).numFmt = '0%';
  const totalBorder = {
    top: { style: 'thin', color: { argb: 'FF00ACC1' } },
    bottom: { style: 'double', color: { argb: 'FF00ACC1' } },
    left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
    right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
  };
  ['B', 'C', 'D', 'E'].forEach(col => {
    const cell = axisSheet.getCell(`${col}${totalRowIndex}`);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F7FA' } };
    cell.border = totalBorder;
    cell.font = { name: fontName, bold: true, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // --- 3. Detailed Answers Sheet ---
  const detailSheet = workbook.addWorksheet('الإجابات التفصيلية');
  detailSheet.views = [{ rightToLeft: true, showGridLines: true }];
  detailSheet.columns = [
    { key: 'spacer', width: 3 },
    { key: 'axisName', width: 35 },
    { key: 'question', width: 85 },
    { key: 'score', width: 22 }
  ];
  detailSheet.addRow([]);
  detailSheet.mergeCells('B2:D2');
  const detailTitleCell = detailSheet.getCell('B2');
  detailTitleCell.value = 'تفاصيل الإجابات والامتثال لكل محور';
  detailTitleCell.font = { name: fontName, bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  detailTitleCell.fill = tealHeaderFill;
  detailTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  detailSheet.getRow(2).height = 35;
  detailSheet.addRow([]);

  const detailHeaders = [
    { col: 'B', val: 'المحور' }, { col: 'C', val: 'السؤال' }, { col: 'D', val: 'حالة الامتثال' }
  ];
  detailSheet.getRow(4).height = 25;
  detailHeaders.forEach(h => {
    const cell = detailSheet.getCell(`${h.col}4`);
    cell.value = h.val;
    cell.font = { name: fontName, bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    cell.fill = purpleHeaderFill;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = borderStyle;
  });

  let currentRow = 5;
  AXES.forEach(axis => {
    const startRow = currentRow;
    axis.questions.forEach((question, qIndex) => {
      const answer = answers.find(a => a.axis_id === axis.id && a.question_index === qIndex);
      const scoreVal = answer ? answer.score : -1;
      let label = 'لم تتم الإجابة';
      if (scoreVal === 0) label = 'غير مطبق';
      else if (scoreVal === 1) label = 'تطبيق جزئي';
      else if (scoreVal === 2) label = 'مطبق بالكامل';

      detailSheet.addRow({ axisName: axis.name, question, score: label });
      detailSheet.getRow(currentRow).height = 26;

      detailSheet.getCell(`B${currentRow}`).border = borderStyle;
      detailSheet.getCell(`B${currentRow}`).font = { name: fontName, size: 10 };

      const qCell = detailSheet.getCell(`C${currentRow}`);
      qCell.font = { name: fontName, size: 10, color: { argb: 'FF333333' } };
      qCell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };
      qCell.border = borderStyle;

      const valCell = detailSheet.getCell(`D${currentRow}`);
      valCell.font = { name: fontName, bold: true, size: 10 };
      valCell.alignment = { vertical: 'middle', horizontal: 'center' };
      valCell.border = borderStyle;

      if (scoreVal === 0) {
        valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
        valCell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FFC62828' } };
      } else if (scoreVal === 1) {
        valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
        valCell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FFE65100' } };
      } else if (scoreVal === 2) {
        valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        valCell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FF2E7D32' } };
      } else {
        valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        valCell.font = { name: fontName, size: 10, color: { argb: 'FF757575' } };
      }
      currentRow++;
    });

    if (currentRow - 1 >= startRow) {
      detailSheet.mergeCells(startRow, 2, currentRow - 1, 2);
      const mergedAxisCell = detailSheet.getCell(startRow, 2);
      mergedAxisCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      mergedAxisCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } };
      mergedAxisCell.font = { name: fontName, bold: true, size: 10, color: { argb: 'FF4A148C' } };
      for (let r = startRow; r < currentRow; r++) {
        detailSheet.getCell(r, 2).border = {
          top: { style: 'thin', color: { argb: 'FFD1C4E9' } },
          bottom: { style: 'thin', color: { argb: 'FFD1C4E9' } },
          left: { style: 'thin', color: { argb: 'FFD1C4E9' } },
          right: { style: 'thin', color: { argb: 'FFD1C4E9' } }
        };
      }
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=assessment-${assessment.id}.xlsx`
    }
  });
}

async function getAssessment(db, id, user) {
  if (user && user.role === 'admin') {
    return db.prepare('SELECT * FROM assessments WHERE id = ?').get(id);
  } else if (user) {
    return db.prepare('SELECT * FROM assessments WHERE id = ? AND (user_id = ? OR user_id IS NULL)').get(id, user.id);
  } else {
    return db.prepare('SELECT * FROM assessments WHERE id = ? AND user_id IS NULL').get(id);
  }
}

export async function GET(request, { params }) {
  try {
    const user = await optionalAuthenticate(request);
    const db = await getDbReady();
    const assessment = await getAssessment(db, params.id, user);
    if (!assessment) return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
    const answers = db.prepare('SELECT * FROM answers WHERE assessment_id = ? ORDER BY axis_id, question_index').all(assessment.id);
    const axisScores = calculateAxisScores(answers);
    return buildExcelResponse(assessment, answers, axisScores, null);
  } catch (err) {
    console.error('Excel export error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const user = await optionalAuthenticate(request);
    const db = await getDbReady();
    const assessment = await getAssessment(db, params.id, user);
    if (!assessment) return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
    const answers = db.prepare('SELECT * FROM answers WHERE assessment_id = ? ORDER BY axis_id, question_index').all(assessment.id);
    const axisScores = calculateAxisScores(answers);
    let radarImage = null;
    try {
      const body = await request.json();
      radarImage = body.radarImage || null;
    } catch (e) { /* no body */ }
    return buildExcelResponse(assessment, answers, axisScores, radarImage);
  } catch (err) {
    console.error('Excel export error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
