(() => {
  // RC1: reports-p3-fix.js tinh chỉnh dữ liệu hiển thị nhưng không được ghi đè
  // cơ chế xuất Excel A4 hành chính của reports.js/server.js.
  exportExcel = function rc1ExportCurrentReportA4() {
    const selectedType = q('reportType')?.value || 'incidents';
    const type = typeof reportTypeForA4 === 'function' ? reportTypeForA4(selectedType) : selectedType;
    const params = new URLSearchParams({
      type,
      from: q('fromDate')?.value || firstDayOfYearISO(),
      to: q('toDate')?.value || todayISO(),
      dept: q('deptFilter')?.value || 'ALL',
      group: q('groupFilter')?.value || 'ALL'
    });
    window.location.href = `/api/reports/export-a4?${params.toString()}`;
  };
})();
