(() => {
  const p3OriginalReportData = reportData;

  function p3Status(value) {
    return norm(value).replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
  }
  function p3IsFullyActive(value) {
    const s = p3Status(value);
    return s === 'dang hoat dong' || s === 'hoat dong' || s === 'binh thuong';
  }
  function p3IsInUse(value) {
    const s = p3Status(value);
    return (s.includes('hoat dong') || s === 'binh thuong') && !s.includes('ngung') && !s.includes('khong hoat dong');
  }
  function p3IsStopped(value) {
    const s = p3Status(value);
    return s.includes('ngung') || s.includes('khong hoat dong') || s.includes('da thanh ly');
  }
  function p3IsWaitingRepair(value) {
    const s = p3Status(value);
    return s.includes('cho sua') || s.includes('dang sua') || s.includes('sua chua');
  }
  function p3SelectedDevices() {
    return baseDeviceFilter([...(RAW.devices || [])]);
  }
  function p3DeviceMap() {
    return new Map((RAW.devices || []).map(d => [Number(d.id), d]));
  }
  function p3DeviceCodeMap() {
    return new Map((RAW.devices || []).map(d => [String(d.device_code || ''), d]));
  }
  function p3ScopedRaw(rows, dateField) {
    const dept = q('deptFilter')?.value || 'ALL';
    const group = q('groupFilter')?.value || 'ALL';
    const from = q('fromDate')?.value || '';
    const to = q('toDate')?.value || '';
    const dm = p3DeviceMap();
    return (rows || []).filter(r => {
      const d = dm.get(Number(r.device_id)) || {};
      const rowDept = r.department_code || d.department_code || '';
      const rowGroup = r.group_code || d.group_code || '';
      const dateOk = dateField ? inDateRange(r[dateField], from, to) : true;
      return dateOk && (dept === 'ALL' || rowDept === dept) && (group === 'ALL' || rowGroup === group);
    });
  }
  function p3ScopeRenderedRows(data) {
    const dept = q('deptFilter')?.value || 'ALL';
    const group = q('groupFilter')?.value || 'ALL';
    if (dept === 'ALL' && group === 'ALL') return data;
    const codeIndex = data.columns.indexOf('Mã TB');
    const deptIndex = data.columns.indexOf('Khoa');
    if (codeIndex < 0) return data;
    const byCode = p3DeviceCodeMap();
    return {
      ...data,
      rows: data.rows.filter(row => {
        const d = byCode.get(String(row[codeIndex] || '')) || {};
        const rowDept = d.department_code || (deptIndex >= 0 ? String(row[deptIndex] || '') : '');
        const rowGroup = d.group_code || '';
        return (dept === 'ALL' || rowDept === dept) && (group === 'ALL' || rowGroup === group);
      })
    };
  }
  function p3LatestByRecordDate(rows, dateField) {
    const latest = new Map();
    (rows || []).forEach(r => {
      const id = Number(r.device_id);
      if (!id) return;
      const old = latest.get(id);
      if (!old || String(r[dateField] || '') > String(old[dateField] || '')) latest.set(id, r);
    });
    return latest;
  }
  function p3DueReport(type) {
    const devices = p3SelectedDevices();
    const isMaintenance = type === 'maintenanceDue';
    const source = isMaintenance ? (RAW.maintenances || []) : (RAW.inspections || []);
    const latest = p3LatestByRecordDate(source, isMaintenance ? 'maintenance_date' : 'inspection_date');
    const rows = devices
      .map(d => ({ d, m: latest.get(Number(d.id)) }))
      .filter(x => {
        if (!x.m || !x.m.next_date) return false;
        const days = daysUntil(x.m.next_date);
        return days !== null && Number.isFinite(days) && days <= 60;
      })
      .sort((a,b) => daysUntil(a.m.next_date) - daysUntil(b.m.next_date))
      .map((x,i) => [
        i + 1,
        x.d.device_code || '',
        x.d.name || '',
        x.d.department_code || '',
        formatDateVN(isMaintenance ? x.m.maintenance_date : x.m.inspection_date),
        formatDateVN(x.m.next_date),
        dueLabel(x.m.next_date),
        isMaintenance ? (x.m.type || '') : (x.m.organization || '')
      ]);
    return { columns: cols.due, rows };
  }
  function p3RepairCostByDept() {
    const repairs = p3ScopedRaw(RAW.repairs || [], 'repair_date');
    const grouped = summarize(repairs, r => {
      const d = p3DeviceMap().get(Number(r.device_id)) || {};
      return r.department_code || d.department_code || 'Chưa rõ';
    });
    return { columns: cols.summary, rows: grouped.map((r,i) => [i+1, r.key, getDeptName(r.key), r.count, r.value, 'Phiếu sửa chữa']) };
  }
  function p3InventoryMinutes() {
    const devices = p3SelectedDevices();
    const grouped = summarize(devices, d => d.department_code || 'Chưa rõ');
    return {
      columns: ['STT','Khoa','Số thiết bị','Đang sử dụng','Chờ sửa chữa','Ngừng sử dụng','Ghi chú'],
      rows: grouped.map((r,i) => {
        const ds = devices.filter(d => (d.department_code || 'Chưa rõ') === r.key);
        return [
          i+1,
          `${r.key} - ${getDeptName(r.key)}`,
          ds.length,
          ds.filter(d => p3IsInUse(d.status)).length,
          ds.filter(d => p3IsWaitingRepair(d.status)).length,
          ds.filter(d => p3IsStopped(d.status)).length,
          ''
        ];
      })
    };
  }
  function p3AnnualUsage() {
    const devices = p3SelectedDevices();
    const repairs = p3ScopedRaw(RAW.repairs || [], 'repair_date');
    const latestInsp = p3LatestByRecordDate(RAW.inspections || [], 'inspection_date');
    const grouped = summarize(devices, d => d.department_code || 'Chưa rõ');
    return {
      columns: cols.usage,
      rows: grouped.map((r,i) => {
        const ds = devices.filter(d => (d.department_code || 'Chưa rõ') === r.key);
        return [
          i+1,
          `${r.key} - ${getDeptName(r.key)}`,
          ds.length,
          ds.filter(d => p3IsInUse(d.status)).length,
          ds.filter(d => p3IsStopped(d.status) || p3IsWaitingRepair(d.status)).length,
          repairs.filter(x => {
            const d = p3DeviceMap().get(Number(x.device_id)) || {};
            return (x.department_code || d.department_code || '') === r.key;
          }).length,
          ds.filter(d => latestInsp.has(Number(d.id))).length,
          ds.filter(d => !latestInsp.has(Number(d.id))).length,
          ''
        ];
      })
    };
  }

  reportData = function p3ReportData(type) {
    if (type === 'maintenanceDue' || type === 'inspectionDue') return p3DueReport(type);
    if (type === 'repairCostByDept') return p3RepairCostByDept();
    if (type === 'inventoryMinutes') return p3InventoryMinutes();
    if (type === 'annualUsage') return p3AnnualUsage();

    let data = p3OriginalReportData(type);

    if (type === 'assetOverview' && Array.isArray(data.rows) && data.rows[1]) {
      const devices = p3SelectedDevices();
      data = { ...data, rows: data.rows.map(r => [...r]) };
      data.rows[1][3] = devices.filter(d => p3IsFullyActive(d.status)).length;
    }

    if (type === 'devicesNeedReplace') {
      data = {
        ...data,
        rows: data.rows.map(row => row.length > data.columns.length ? [...row.slice(0, 10), row[row.length - 1]] : row)
      };
    }

    if (['incidents','repairs','openRepairs','maintenances','inspections'].includes(type)) {
      data = p3ScopeRenderedRows(data);
    }

    return data;
  };

  exportExcel = function p3ExportCurrentReport() {
    const rows = (CURRENT || []).map(row => Object.fromEntries((CURRENT_COLUMNS || []).map((c,i) => [c, row[i] ?? ''])));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Thông báo': 'Chưa có dữ liệu' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, String(CURRENT_TITLE || 'Bao cao').slice(0,31));
    const slug = norm(CURRENT_TITLE || 'bao cao').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'bao_cao';
    XLSX.writeFile(wb, `${slug}_${todayISO()}.xlsx`);
  };
})();
