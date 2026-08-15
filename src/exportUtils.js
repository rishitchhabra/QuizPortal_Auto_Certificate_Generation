import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { sortBatches, formatTime, showToast } from './utils.js';

// ============================================================
// Core Excel Export Helper
// ============================================================
export function exportExcelFile(filename, sheets) {
  const wb = XLSX.utils.book_new();

  sheets.forEach(sheet => {
    const { name, data, aoa, colWidths } = sheet;
    let ws;
    if (aoa) {
      ws = XLSX.utils.aoa_to_sheet(aoa);
    } else {
      ws = XLSX.utils.json_to_sheet(data || []);
    }
    if (colWidths) {
      ws['!cols'] = colWidths.map(w => ({ wch: w }));
    }
    XLSX.utils.book_append_sheet(wb, ws, name || 'Sheet1');
  });

  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

// ============================================================
// Core PDF Export Helper
// ============================================================
export function exportPDFFile({ filename, title, subtitle, summaryStats = [], columns, rows }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 12;
  let currentY = margin;

  // Header background bar
  doc.setFillColor(30, 41, 59); // dark slate (#1e293b)
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(title || 'Report', margin, 13);

  // Subtitle / Timestamp
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  const dateStr = new Date().toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.text(`${subtitle ? `${subtitle}   |   ` : ''}Generated: ${dateStr}`, margin, 20);

  currentY = 32;

  // Summary Stat cards
  if (summaryStats && summaryStats.length > 0) {
    const gap = 3;
    const cardWidth = (pageWidth - margin * 2 - (summaryStats.length - 1) * gap) / summaryStats.length;
    summaryStats.forEach((stat, i) => {
      const cardX = margin + i * (cardWidth + gap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(cardX, currentY, cardWidth, 13, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(String(stat.label).toUpperCase(), cardX + 3, currentY + 4.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(String(stat.value), cardX + 3, currentY + 10.5);
    });
    currentY += 17;
  }

  // Table Column Calculations
  const usableWidth = pageWidth - margin * 2;
  const totalWeight = columns.reduce((acc, col) => acc + (col.weight || 1), 0);
  const colWidths = columns.map(col => ((col.weight || 1) / totalWeight) * usableWidth);

  const rowHeight = 7.5;
  const headerHeight = 8.5;

  function renderTableHeader(y) {
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(margin, y, usableWidth, headerHeight, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y + headerHeight, margin + usableWidth, y + headerHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);

    let currentX = margin;
    columns.forEach((col, idx) => {
      const w = colWidths[idx];
      const align = col.align || 'left';
      let textX = currentX + 2;
      if (align === 'right') textX = currentX + w - 2;
      else if (align === 'center') textX = currentX + w / 2;

      doc.text(col.header, textX, y + 5.5, { align });
      currentX += w;
    });
    return y + headerHeight;
  }

  currentY = renderTableHeader(currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  let dataRowIndex = 0;
  rows.forEach((row) => {
    // Section Header row (for batch dividers)
    if (row._isSectionHeader) {
      if (currentY + 10 > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
        currentY = renderTableHeader(currentY);
      }
      doc.setFillColor(238, 242, 255);
      doc.rect(margin, currentY, usableWidth, 7.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(67, 56, 202);
      doc.text(String(row._sectionTitle), margin + 3, currentY + 5.2);
      currentY += 7.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      dataRowIndex = 0;
      return;
    }

    if (currentY + rowHeight > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
      currentY = renderTableHeader(currentY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }

    // Zebra striping
    if (dataRowIndex % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, usableWidth, rowHeight, 'F');
    }
    dataRowIndex++;

    // Row border line
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + rowHeight, margin + usableWidth, currentY + rowHeight);

    let currentX = margin;
    columns.forEach((col, idx) => {
      const w = colWidths[idx];
      const val = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '';
      const align = col.align || 'left';
      let textX = currentX + 2;
      if (align === 'right') textX = currentX + w - 2;
      else if (align === 'center') textX = currentX + w / 2;

      const valLower = val.toLowerCase();
      if (valLower === 'passed' || valLower === 'yes' || valLower.includes('passed')) {
        doc.setTextColor(22, 101, 52);
      } else if (valLower === 'failed' || valLower === 'no' || valLower.includes('not attempted')) {
        doc.setTextColor(185, 28, 28);
      } else {
        doc.setTextColor(51, 65, 85);
      }

      // Truncate text if wide
      const maxTextWidth = w - 4;
      let textToDraw = val;
      if (doc.getTextWidth(textToDraw) > maxTextWidth) {
        while (textToDraw.length > 2 && doc.getTextWidth(textToDraw + '…') > maxTextWidth) {
          textToDraw = textToDraw.slice(0, -1);
        }
        textToDraw += '…';
      }

      doc.text(textToDraw, textX, currentY + 5, { align });
      currentX += w;
    });

    currentY += rowHeight;
  });

  // Footer with Page Numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${page} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    doc.text('Gyan International School — Quiz Management Portal', margin, pageHeight - 6);
  }

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

// ============================================================
// 1. Batch Summary Export (Reports Page)
// ============================================================
export function exportBatchSummary({ batches, quizTitle, format = 'excel' }) {
  const safeQuiz = (quizTitle || 'Quiz').replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
  const filename = `report_batch_summary_${safeQuiz}_${Date.now()}`;

  if (format === 'pdf') {
    const totalStudents = batches.reduce((s, b) => s + (b.totalStudents || 0), 0);
    const totalAttempted = batches.reduce((s, b) => s + (b.attempted || 0), 0);
    const totalPassed = batches.reduce((s, b) => s + (b.passed || 0), 0);
    const overallAvg = batches.length > 0 ? Math.round(batches.reduce((s, b) => s + (b.avgPercent || 0), 0) / batches.length) : 0;

    const columns = [
      { key: 'batch', header: 'Batch / Class', weight: 2.2 },
      { key: 'totalStudents', header: 'Total', weight: 1, align: 'center' },
      { key: 'attempted', header: 'Attempted', weight: 1.1, align: 'center' },
      { key: 'notAttempted', header: 'Not Attempted', weight: 1.3, align: 'center' },
      { key: 'passed', header: 'Passed', weight: 1, align: 'center' },
      { key: 'avgPercent', header: 'Avg %', weight: 1, align: 'center' },
      { key: 'maxPercent', header: 'Max %', weight: 1, align: 'center' },
      { key: 'minPercent', header: 'Min %', weight: 1, align: 'center' }
    ];

    const rows = batches.map(b => ({
      batch: b.batch || 'Unassigned',
      totalStudents: b.totalStudents,
      attempted: b.attempted,
      notAttempted: b.notAttempted,
      passed: b.passed,
      avgPercent: `${b.avgPercent}%`,
      maxPercent: `${b.maxPercent}%`,
      minPercent: `${b.minPercent}%`
    }));

    exportPDFFile({
      filename: `${filename}.pdf`,
      title: 'Batch Performance Summary',
      subtitle: `Quiz: ${quizTitle || 'Untitled Quiz'}`,
      summaryStats: [
        { label: 'Batches', value: batches.length },
        { label: 'Total Students', value: totalStudents },
        { label: 'Attempted', value: totalAttempted },
        { label: 'Passed', value: totalPassed },
        { label: 'Avg Score', value: `${overallAvg}%` }
      ],
      columns,
      rows
    });
    showToast('Exported Batch Summary as PDF');
  } else {
    const data = batches.map(b => ({
      'Batch': b.batch || 'Unassigned',
      'Total Students': b.totalStudents,
      'Attempted': b.attempted,
      'Not Attempted': b.notAttempted,
      'Passed': b.passed,
      'Avg %': b.avgPercent,
      'Max %': b.maxPercent,
      'Min %': b.minPercent
    }));

    exportExcelFile(`${filename}.xlsx`, [
      { name: 'Batch Summary', data, colWidths: [22, 14, 14, 15, 12, 10, 10, 10] }
    ]);
    showToast('Exported Batch Summary as Excel');
  }
}

// ============================================================
// 2. Student-Wise Report Export (Reports Page)
// ============================================================
export function exportStudentReport({ studentRows, quizTitle, batchFilter = '', format = 'excel' }) {
  const safeQuiz = (quizTitle || 'Quiz').replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
  const safeBatch = batchFilter ? batchFilter.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_') : 'all_batches';
  const filename = `report_students_${safeBatch}_${safeQuiz}_${Date.now()}`;

  let rowsToExport = studentRows || [];
  if (batchFilter) {
    rowsToExport = rowsToExport.filter(s => (s.classSection || '') === batchFilter);
  }

  if (rowsToExport.length === 0) {
    showToast('No students match the selected batch for export', 'error');
    return;
  }

  if (format === 'pdf') {
    const totalCount = rowsToExport.length;
    const attemptedCount = rowsToExport.filter(s => s.attempted).length;
    const passedCount = rowsToExport.filter(s => s.passed).length;
    const attemptedRows = rowsToExport.filter(s => s.attempted && s.percent != null);
    const avgScore = attemptedRows.length > 0 ? Math.round(attemptedRows.reduce((acc, s) => acc + s.percent, 0) / attemptedRows.length) : 0;

    const columns = [
      { key: 'num', header: '#', weight: 0.6, align: 'center' },
      { key: 'name', header: 'Student Name', weight: 2.5 },
      { key: 'userId', header: 'User ID', weight: 1.8 },
      { key: 'classSection', header: 'Batch', weight: 1.4 },
      { key: 'status', header: 'Status', weight: 1.6 },
      { key: 'score', header: 'Score', weight: 1.2, align: 'center' },
      { key: 'percent', header: '%', weight: 1, align: 'center' },
      { key: 'time', header: 'Time', weight: 1.2, align: 'center' }
    ];

    const pdfRows = [];
    const groupKeys = sortBatches(Array.from(new Set(rowsToExport.map(s => s.classSection || ''))));

    groupKeys.forEach(b => {
      const grp = rowsToExport.filter(s => (s.classSection || '') === b);
      if (!batchFilter && groupKeys.length > 1) {
        pdfRows.push({ _isSectionHeader: true, _sectionTitle: `${b || 'Unassigned Batch'} — ${grp.length} student${grp.length === 1 ? '' : 's'}` });
      }
      grp.forEach((s, idx) => {
        pdfRows.push({
          num: idx + 1,
          name: s.name || '',
          userId: s.userId || '',
          classSection: s.classSection || '—',
          status: s.attempted ? (s.passed ? 'Passed' : 'Failed') : 'Not Attempted',
          score: s.attempted ? `${s.score}/${s.totalPoints}` : '—',
          percent: s.attempted ? `${s.percent}%` : '—',
          time: s.attempted ? formatTime(s.timeTaken) : '—'
        });
      });
    });

    exportPDFFile({
      filename: `${filename}.pdf`,
      title: 'Student Performance Report',
      subtitle: `Quiz: ${quizTitle || 'Quiz'}${batchFilter ? `  |  Batch: ${batchFilter}` : '  |  All Batches'}`,
      summaryStats: [
        { label: 'Students', value: totalCount },
        { label: 'Attempted', value: attemptedCount },
        { label: 'Passed', value: passedCount },
        { label: 'Avg Score', value: `${avgScore}%` }
      ],
      columns,
      rows: pdfRows
    });
    showToast(`Exported ${batchFilter ? batchFilter : 'All Batches'} Student Report as PDF`);
  } else {
    const headers = ['#', 'Name', 'User ID', 'Batch', 'Attempted', 'Score', 'Percentage', 'Passed', 'Time Taken'];
    const groupKeys = sortBatches(Array.from(new Set(rowsToExport.map(s => s.classSection || ''))));
    const aoa = [];

    groupKeys.forEach(batch => {
      const group = rowsToExport.filter(s => (s.classSection || '') === batch);
      aoa.push([`${batch || 'Unassigned'} — ${group.length} student${group.length === 1 ? '' : 's'}`]);
      aoa.push(headers);
      group.forEach((s, i) => aoa.push([
        i + 1,
        s.name,
        s.userId,
        s.classSection || '',
        s.attempted ? 'Yes' : 'No',
        s.attempted ? `${s.score}/${s.totalPoints}` : '—',
        s.percent != null ? `${s.percent}%` : '—',
        s.passed ? 'Yes' : 'No',
        s.attempted ? formatTime(s.timeTaken) : '—'
      ]));
      aoa.push([]);
    });

    exportExcelFile(`${filename}.xlsx`, [
      { name: 'Student Report', aoa, colWidths: [6, 26, 18, 14, 12, 12, 12, 10, 12] }
    ]);
    showToast(`Exported ${batchFilter ? batchFilter : 'All Batches'} Student Report as Excel`);
  }
}

// ============================================================
// 3. Student Master Export (Users Page)
// ============================================================
export function exportStudentMaster({ usersList, batchFilter = '', searchQuery = '', format = 'excel' }) {
  let rowsToExport = usersList || [];

  if (batchFilter) {
    rowsToExport = rowsToExport.filter(u => (u.classSection || '') === batchFilter);
  }
  if (searchQuery) {
    const q = searchQuery.trim().toLowerCase();
    rowsToExport = rowsToExport.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.userId || '').toLowerCase().includes(q) ||
      (u.classSection || '').toLowerCase().includes(q) ||
      (u.parentMobile || '').toLowerCase().includes(q)
    );
  }

  if (rowsToExport.length === 0) {
    showToast('No students match the criteria to export', 'error');
    return;
  }

  const safeBatch = batchFilter ? batchFilter.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_') : 'all_batches';
  const filename = `student_master_${safeBatch}_${Date.now()}`;

  if (format === 'pdf') {
    const groupKeys = sortBatches(Array.from(new Set(rowsToExport.map(u => u.classSection || ''))));
    const columns = [
      { key: 'num', header: '#', weight: 0.8, align: 'center' },
      { key: 'name', header: 'Student Name', weight: 3 },
      { key: 'userId', header: 'User ID', weight: 2.2 },
      { key: 'classSection', header: 'Class-Section', weight: 1.8 },
      { key: 'parentMobile', header: "Parent's Mobile", weight: 2.2 }
    ];

    const pdfRows = [];
    groupKeys.forEach(b => {
      const grp = rowsToExport.filter(u => (u.classSection || '') === b);
      if (!batchFilter && groupKeys.length > 1) {
        pdfRows.push({ _isSectionHeader: true, _sectionTitle: `${b || 'Unassigned Batch'} — ${grp.length} student${grp.length === 1 ? '' : 's'}` });
      }
      grp.forEach((u, idx) => {
        pdfRows.push({
          num: idx + 1,
          name: u.name || '',
          userId: u.userId || '',
          classSection: u.classSection || '—',
          parentMobile: u.parentMobile || '—'
        });
      });
    });

    exportPDFFile({
      filename: `${filename}.pdf`,
      title: 'Student Master Database',
      subtitle: `Filter: ${batchFilter ? `Batch ${batchFilter}` : 'All Batches'}${searchQuery ? ` ("${searchQuery}")` : ''}`,
      summaryStats: [
        { label: 'Total Students', value: rowsToExport.length },
        { label: 'Total Batches', value: groupKeys.length }
      ],
      columns,
      rows: pdfRows
    });
    showToast(`Exported ${rowsToExport.length} student(s) as PDF`);
  } else {
    const headers = ['#', 'Name', 'User ID', 'Class-Section', "Parent's Mobile"];
    const groupKeys = sortBatches(Array.from(new Set(rowsToExport.map(u => u.classSection || ''))));
    const aoa = [];

    groupKeys.forEach(batch => {
      const group = rowsToExport.filter(u => (u.classSection || '') === batch);
      aoa.push([`${batch || 'Unassigned'} — ${group.length} student${group.length === 1 ? '' : 's'}`]);
      aoa.push(headers);
      group.forEach((u, i) => aoa.push([i + 1, u.name, u.userId, u.classSection, u.parentMobile || '']));
      aoa.push([]);
    });

    exportExcelFile(`${filename}.xlsx`, [
      { name: 'Students', aoa, colWidths: [6, 26, 20, 15, 18] }
    ]);
    showToast(`Exported ${rowsToExport.length} student(s) as Excel`);
  }
}

// ============================================================
// 4. Leaderboard / Submissions Export (Responses Page)
// ============================================================
export function exportLeaderboard({ submissions, quizTitle, batchFilter = '', format = 'excel' }) {
  const safeQuiz = (quizTitle || 'Quiz').replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
  const safeBatch = batchFilter ? batchFilter.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_') : 'all_batches';
  const filename = `leaderboard_${safeBatch}_${safeQuiz}_${Date.now()}`;

  let filtered = [...submissions];
  if (batchFilter) {
    filtered = filtered.filter(s => {
      const cls = s.participant?.classSection || s.participant?.class || s.participant?.custom?.['Class / Grade'] || s.participant?.custom?.['Class'] || '';
      return cls === batchFilter;
    });
  }

  if (filtered.length === 0) {
    showToast('No responses match the selected batch', 'error');
    return;
  }

  // Sort leaderboard: score desc, time asc, submittedAt asc
  filtered.sort((a, b) => {
    if (b.percent !== a.percent) return b.percent - a.percent;
    if (a.timeTaken !== b.timeTaken) return (a.timeTaken || 0) - (b.timeTaken || 0);
    return new Date(a.submittedAt) - new Date(b.submittedAt);
  });

  if (format === 'pdf') {
    const total = filtered.length;
    const passCount = filtered.filter(s => s.passed).length;
    const avgScore = total > 0 ? Math.round(filtered.reduce((s, x) => s + x.percent, 0) / total) : 0;

    const columns = [
      { key: 'rank', header: 'Rank', weight: 0.8, align: 'center' },
      { key: 'name', header: 'Participant Name', weight: 2.8 },
      { key: 'userId', header: 'User ID / Email', weight: 2.2 },
      { key: 'batch', header: 'Batch / Class', weight: 1.4 },
      { key: 'score', header: 'Score', weight: 1.2, align: 'center' },
      { key: 'percent', header: '%', weight: 1, align: 'center' },
      { key: 'status', header: 'Status', weight: 1.2, align: 'center' },
      { key: 'time', header: 'Time', weight: 1.2, align: 'center' }
    ];

    const pdfRows = filtered.map((s, i) => {
      const cls = s.participant?.classSection || s.participant?.class || s.participant?.custom?.['Class / Grade'] || s.participant?.custom?.['Class'] || '—';
      const uid = s.participant?.userId || s.participant?.email || '—';
      return {
        rank: `${i + 1}`,
        name: s.participant?.name || 'Participant',
        userId: uid,
        batch: cls,
        score: `${s.score}/${s.totalPoints}`,
        percent: `${s.percent}%`,
        status: s.passed ? 'Passed' : 'Failed',
        time: formatTime(s.timeTaken)
      };
    });

    exportPDFFile({
      filename: `${filename}.pdf`,
      title: 'Quiz Leaderboard & Submissions',
      subtitle: `Quiz: ${quizTitle || 'Quiz'}${batchFilter ? `  |  Batch: ${batchFilter}` : '  |  All Batches'}`,
      summaryStats: [
        { label: 'Total Responses', value: total },
        { label: 'Passed', value: passCount },
        { label: 'Avg Score', value: `${avgScore}%` }
      ],
      columns,
      rows: pdfRows
    });
    showToast(`Exported Leaderboard as PDF`);
  } else {
    const data = filtered.map((s, i) => {
      const cls = s.participant?.classSection || s.participant?.class || s.participant?.custom?.['Class / Grade'] || s.participant?.custom?.['Class'] || '—';
      const uid = s.participant?.userId || s.participant?.email || '—';
      return {
        'Rank': i + 1,
        'Name': s.participant?.name || '',
        'User ID / Email': uid,
        'Batch / Class': cls,
        'Score': `${s.score}/${s.totalPoints}`,
        'Percentage': `${s.percent}%`,
        'Passed': s.passed ? 'Yes' : 'No',
        'Time Taken': formatTime(s.timeTaken),
        'Submitted At': s.submittedAt ? new Date(s.submittedAt).toLocaleString() : ''
      };
    });

    exportExcelFile(`${filename}.xlsx`, [
      { name: 'Leaderboard', data, colWidths: [8, 26, 22, 14, 12, 12, 10, 12, 20] }
    ]);
    showToast(`Exported Leaderboard as Excel`);
  }
}
