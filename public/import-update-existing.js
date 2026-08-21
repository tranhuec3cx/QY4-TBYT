(() => {
  const UPDATE_FIELDS = [
    ['manufacturer', ['Hãng sản xuất','Hãng SX']],
    ['model', ['Model','Ký hiệu / Model','Ký hiệu']],
    ['country', ['Nước sản xuất','Nước SX']],
    ['year_manufactured', ['Năm sản xuất','Năm SX']],
    ['year_in_use', ['Năm sử dụng','Năm SD']],
    ['warranty_end', ['Hạn bảo hành đến','Hạn bảo hành','Hạn BH']],
    ['quality_level', ['Cấp chất lượng']],
    ['cost', ['Nguyên giá (VNĐ)','Nguyên giá']],
    ['funding', ['Nguồn kinh phí']],
    ['location', ['Vị trí đặt máy','Vị trí']],
    ['insurance_code', ['Mã máy BHXH / mã quản lý','Mã máy BHXH','Mã quản lý']]
  ];

  const FIELD_LABELS = {
    manufacturer:'Hãng sản xuất',
    model:'Model',
    country:'Nước sản xuất',
    year_manufactured:'Năm sản xuất',
    year_in_use:'Năm sử dụng',
    warranty_end:'Hạn bảo hành',
    quality_level:'Cấp chất lượng',
    cost:'Nguyên giá',
    funding:'Nguồn kinh phí',
    location:'Vị trí đặt máy',
    insurance_code:'Mã BHXH/mã quản lý'
  };

  function mode() {
    return document.getElementById('importMode')?.value === 'update' ? 'update' : 'insert';
  }

  function normHeader(value) {
    return String(value ?? '').trim().toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[*_:/\\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function headerIndex(headers, aliases) {
    const normalized = headers.map(normHeader);
    for (const alias of aliases) {
      const i = normalized.indexOf(normHeader(alias));
      if (i >= 0) return i;
    }
    return -1;
  }

  function isBlank(value) {
    return value === null || value === undefined || String(value).trim() === '';
  }

  function parseUpdateValue(field, value) {
    if (isBlank(value)) return undefined;
    if (field === 'cost') return Math.max(0, numberValue(value, 0));
    if (field === 'quality_level') {
      const n = Number(String(value).match(/[1-5]/)?.[0] || value);
      return Number.isFinite(n) && n >= 1 && n <= 5 ? n : undefined;
    }
    if (field === 'year_manufactured' || field === 'year_in_use') {
      return yearValue(value) ?? undefined;
    }
    if (field === 'warranty_end') return dateValue(value) || undefined;
    return normalizeText(value);
  }

  async function readUpdateWorkbook(file) {
    if (!window.XLSX) throw new Error('Không tải được bộ đọc Excel XLSX.');
    if (!file) throw new Error('Chưa chọn file Excel.');
    if (!/\.xlsx$/i.test(String(file.name || ''))) {
      throw new Error('Chỉ hỗ trợ file Excel định dạng .xlsx.');
    }
    if (Number(file.size || 0) > 25 * 1024 * 1024) {
      throw new Error('File Excel vượt quá 25 MB.');
    }

    const book = XLSX.read(await file.arrayBuffer(), {
      type:'array',
      cellDates:true,
      raw:true
    });

    const sheetName = book.SheetNames.includes('CAP_NHAT_HIEN_CO')
      ? 'CAP_NHAT_HIEN_CO'
      : (book.SheetNames.includes('UPDATE_EXISTING') ? 'UPDATE_EXISTING' : '');

    if (!sheetName) {
      throw new Error('Chế độ cập nhật cần sheet CAP_NHAT_HIEN_CO hoặc UPDATE_EXISTING.');
    }

    const matrix = XLSX.utils.sheet_to_json(book.Sheets[sheetName], {
      header:1,
      raw:true,
      defval:''
    });

    const headerRowIndex = matrix.findIndex(
      row => Array.isArray(row) && row.some(cell => normHeader(cell) === 'serial number')
    );
    if (headerRowIndex < 0) {
      throw new Error(`Sheet ${sheetName} không có cột Serial Number.`);
    }

    const headers = matrix[headerRowIndex].map(v => String(v ?? '').trim());
    const serialCol = headerIndex(headers, ['Serial Number','Serial']);
    const nameRefCol = headerIndex(headers, ['Tên thiết bị (đối chiếu)','Tên thiết bị']);

    const fieldCols = new Map();
    UPDATE_FIELDS.forEach(([field, aliases]) => {
      const col = headerIndex(headers, aliases);
      if (col >= 0) fieldCols.set(field, col);
    });

    if (serialCol < 0) throw new Error('Không xác định được cột Serial Number.');
    if (!fieldCols.size) {
      throw new Error('Không tìm thấy trường dữ liệu nào có thể cập nhật trong sheet.');
    }

    const rows = [];
    for (let r = headerRowIndex + 1; r < matrix.length; r++) {
      const values = matrix[r] || [];
      if (values.every(isBlank)) continue;

      const serial = normalizeText(values[serialCol]);
      const updates = {};

      fieldCols.forEach((col, field) => {
        const parsed = parseUpdateValue(field, values[col]);
        if (parsed !== undefined && !isBlank(parsed)) updates[field] = parsed;
        if (field === 'cost' && parsed === 0 && !isBlank(values[col])) updates[field] = 0;
      });

      rows.push({
        rowNumber:r + 1,
        sourceStt:String(r - headerRowIndex),
        serial,
        nameRef:nameRefCol >= 0 ? normalizeText(values[nameRefCol]) : '',
        updates,
        validation:null,
        existing:null
      });
    }

    return { sheetName, rows };
  }

  function analyzeUpdateRows(rows) {
    const devices = Array.isArray(IMPORT_STATE.existingDevices)
      ? IMPORT_STATE.existingDevices
      : [];

    const bySerial = new Map();
    devices.forEach(device => {
      const key = normalizeText(device.serial).toLowerCase();
      if (!key) return;
      if (!bySerial.has(key)) bySerial.set(key, []);
      bySerial.get(key).push(device);
    });

    const fileSerialCounts = new Map();
    rows.forEach(row => {
      const key = normalizeText(row.serial).toLowerCase();
      if (key) fileSerialCounts.set(key, (fileSerialCounts.get(key) || 0) + 1);
    });

    let ready = 0;
    let notFound = 0;
    let errors = 0;

    rows.forEach(row => {
      const issues = [];
      const key = normalizeText(row.serial).toLowerCase();

      if (!key) issues.push('Thiếu Serial Number');
      if (key && (fileSerialCounts.get(key) || 0) > 1) {
        issues.push('Trùng Serial trong file cập nhật');
      }

      const matches = key ? (bySerial.get(key) || []) : [];

      if (key && matches.length === 0) {
        row.validation = { state:'notfound', issues:['Serial chưa có trong hệ thống'] };
        row.existing = null;
        notFound++;
        return;
      }

      if (matches.length > 1) issues.push('Serial đang trùng trong hệ thống');
      if (!Object.keys(row.updates || {}).length) {
        issues.push('Không có trường nào để cập nhật');
      }

      row.existing = matches[0] || null;

      if (issues.length) {
        row.validation = { state:'error', issues };
        errors++;
      } else {
        row.validation = { state:'update', issues:[] };
        ready++;
      }
    });

    return { total:rows.length, ready, notFound, errors };
  }

  function updateStateLabel(row) {
    if (row.validation?.state === 'update') {
      return '<span class="tag green">Sẵn sàng cập nhật</span>';
    }
    if (row.validation?.state === 'notfound') {
      return '<span class="tag yellow">Không tìm thấy</span>';
    }
    return '<span class="tag red">Cần sửa</span>';
  }

  function updateFieldSummary(row) {
    const fields = Object.keys(row.updates || {}).map(k => FIELD_LABELS[k] || k);
    return fields.length ? fields.join(', ') : '—';
  }

  function renderUpdateAnalysis() {
    const a = IMPORT_STATE.analysis || { total:0, ready:0, notFound:0, errors:0 };

    q('statTotal').textContent = a.total;
    q('statReady').textContent = a.ready;
    q('statExisting').textContent = a.notFound;
    q('statError').textContent = a.errors;
    q('statReadyLabel').textContent = 'Sẵn sàng cập nhật';
    q('statExistingLabel').textContent = 'Không tìm thấy Serial';
    q('statErrorLabel').textContent = 'Cần sửa';
    q('sheetInfo').textContent = IMPORT_STATE.sheetName
      ? `Đang đọc sheet: ${IMPORT_STATE.sheetName}`
      : 'Chưa chọn file.';
    q('catalogInfo').textContent =
      'Đối chiếu bằng Serial Number. Khoa/Nhóm/Mã thiết bị/Serial và lịch sử máy không bị thay đổi.';
    q('importBtn').disabled = IMPORT_STATE.importing || a.ready === 0;
    q('importBtn').textContent = 'Cập nhật chính thức';

    q('previewRows').innerHTML = IMPORT_STATE.rows.map((row, i) => {
      const device = row.existing || {};
      const issue = row.validation?.issues?.join('; ')
        || `Cập nhật: ${updateFieldSummary(row)}`;
      return `<tr>
        <td>${i + 1}</td>
        <td>${escHtml(row.sourceStt)}</td>
        <td>${escHtml(device.department_code || '')}</td>
        <td>${escHtml(device.group_code || '')}</td>
        <td>${escHtml(device.name || row.nameRef || '')}</td>
        <td class="device-code">${escHtml(row.serial)}</td>
        <td>${updateStateLabel(row)}</td>
        <td class="import-issue">${escHtml(issue)}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="8" class="center-empty">Chưa có dữ liệu để xem trước.</td></tr>';
  }

  async function validateUpdateFile() {
    if (!IMPORT_STATE.file) {
      alert('Anh chọn file Excel trước.');
      return;
    }

    setMessage('Đang đọc sheet CAP_NHAT_HIEN_CO và đối chiếu Serial...', 'info');

    try {
      const parsed = await readUpdateWorkbook(IMPORT_STATE.file);
      IMPORT_STATE.sheetName = parsed.sheetName;
      IMPORT_STATE.rows = parsed.rows;

      await refreshServerState();
      IMPORT_STATE.analysis = analyzeUpdateRows(IMPORT_STATE.rows);
      renderUpdateAnalysis();

      setMessage(
        `Đã kiểm tra ${IMPORT_STATE.analysis.total} dòng. Có ${IMPORT_STATE.analysis.ready} thiết bị sẵn sàng cập nhật.`,
        'success'
      );
    } catch (e) {
      IMPORT_STATE.rows = [];
      IMPORT_STATE.analysis = null;
      renderUpdateAnalysis();
      setMessage(e?.message || 'Không đọc được file cập nhật.', 'error');
    }
  }

  function mergedPayload(existing, updates) {
    const has = key => Object.prototype.hasOwnProperty.call(updates, key);

    return {
      department_code: existing.department_code,
      group_code: existing.group_code,
      name: existing.name || '',
      manufacturer: has('manufacturer') ? updates.manufacturer : (existing.manufacturer || ''),
      model: has('model') ? updates.model : (existing.model || ''),
      year_in_use: has('year_in_use') ? updates.year_in_use : (existing.year_in_use || null),
      warranty_end: has('warranty_end') ? updates.warranty_end : (existing.warranty_end || ''),
      status: existing.status || 'Đang hoạt động',
      quality_level: has('quality_level')
        ? updates.quality_level
        : Number(existing.quality_level || 3),
      serial: existing.serial || '',
      country: has('country') ? updates.country : (existing.country || ''),
      year_manufactured: has('year_manufactured')
        ? updates.year_manufactured
        : (existing.year_manufactured || null),
      cost: has('cost') ? updates.cost : Number(existing.cost || 0),
      funding: has('funding') ? updates.funding : (existing.funding || ''),
      location: has('location') ? updates.location : (existing.location || ''),
      note: existing.note || '',
      device_code: existing.device_code || '',
      insurance_code: has('insurance_code')
        ? updates.insurance_code
        : (existing.insurance_code || '')
    };
  }

  async function updateValidatedRows() {
    if (IMPORT_STATE.importing) return;
    if (!IMPORT_STATE.rows.length) {
      alert('Chưa có dữ liệu đã kiểm tra.');
      return;
    }

    await refreshServerState();
    IMPORT_STATE.analysis = analyzeUpdateRows(IMPORT_STATE.rows);
    renderUpdateAnalysis();

    const candidates = IMPORT_STATE.rows.filter(
      row => row.validation?.state === 'update'
    );

    if (!candidates.length) {
      setMessage('Không có thiết bị nào sẵn sàng cập nhật.', 'info');
      return;
    }

    const fields = [
      ...new Set(
        candidates.flatMap(row => Object.keys(row.updates || {}))
          .map(key => FIELD_LABELS[key] || key)
      )
    ];

    if (!confirm(
      `Cập nhật ${candidates.length} thiết bị theo Serial Number?\n\n`
      + `Các trường có dữ liệu sẽ cập nhật: ${fields.join(', ')}.\n`
      + 'Khoa/Nhóm/Mã thiết bị/Serial và lịch sử máy được giữ nguyên.'
    )) return;

    IMPORT_STATE.importing = true;
    q('importBtn').disabled = true;
    setProgress(0, candidates.length);

    let success = 0;
    const failures = [];

    try {
      for (let i = 0; i < candidates.length; i++) {
        const row = candidates[i];
        try {
          await api(`/api/devices/${row.existing.id}`, {
            method:'PUT',
            body:JSON.stringify(mergedPayload(row.existing, row.updates))
          });
          success++;
        } catch (e) {
          failures.push({
            serial:row.serial,
            error:e?.message || 'Lỗi không xác định'
          });
        }

        setProgress(i + 1, candidates.length);

        if ((i + 1) % 10 === 0 || i + 1 === candidates.length) {
          setMessage(
            `Đang cập nhật: ${i + 1}/${candidates.length} — thành công ${success}, lỗi ${failures.length}.`,
            'info'
          );
        }
      }

      await refreshServerState();
      IMPORT_STATE.analysis = analyzeUpdateRows(IMPORT_STATE.rows);
      renderUpdateAnalysis();

      if (failures.length) {
        setMessage(
          `Đã cập nhật ${success} thiết bị; ${failures.length} dòng lỗi. Serial: `
          + failures.slice(0, 5).map(x => x.serial).join(', ')
          + (failures.length > 5 ? '…' : ''),
          'error'
        );
      } else {
        setMessage(
          `Hoàn tất: đã cập nhật ${success} thiết bị theo Serial Number.`,
          'success'
        );
      }
    } finally {
      IMPORT_STATE.importing = false;
      q('importBtn').disabled = !(IMPORT_STATE.analysis?.ready > 0);
    }
  }

  function applyModeUi() {
    const update = mode() === 'update';

    q('importBtn').textContent = update ? 'Cập nhật chính thức' : 'Nhập chính thức';
    q('statReadyLabel').textContent = update ? 'Sẵn sàng cập nhật' : 'Sẵn sàng nhập';
    q('statExistingLabel').textContent = update ? 'Không tìm thấy Serial' : 'Đã tồn tại';
    q('statErrorLabel').textContent = 'Cần sửa';

    const catalogLabel = q('autoCreateCatalogs')?.closest('label');
    if (catalogLabel) catalogLabel.style.display = update ? 'none' : '';

    q('modeHelp').textContent = update
      ? 'Cập nhật thiết bị đã có theo Serial Number; ưu tiên sheet CAP_NHAT_HIEN_CO. Chỉ trường có giá trị trong file mới được cập nhật.'
      : 'Thêm thiết bị mới; ưu tiên sheet IMPORT_READY. Serial đã có sẽ được bỏ qua.';

    q('importNote').innerHTML = update
      ? 'Khóa đối chiếu: <b>Serial Number</b>. Không thay đổi <b>Khoa/Phòng, Nhóm, Mã thiết bị, Serial Number</b> và lịch sử máy.'
      : 'File được kiểm tra theo 4 trường bắt buộc: <b>Khoa/Phòng, Nhóm thiết bị, Tên thiết bị, Serial Number</b>. Serial đã có trong hệ thống sẽ tự động bỏ qua, không tạo bản ghi trùng.';
  }

  function installUpdateModeHandlers() {
    if (window.__QY4_UPDATE_EXISTING_INSTALLED__) return;

    const originalValidate = validateCurrentFile;
    const originalImport = importValidatedRows;
    const originalReset = resetImport;
    const originalRender = renderAnalysis;

    const oldInput = q('excelFile');
    if (!oldInput) return;

    const input = oldInput.cloneNode(true);
    oldInput.replaceWith(input);

    function resetState() {
      IMPORT_STATE.file = null;
      IMPORT_STATE.sheetName = '';
      IMPORT_STATE.rows = [];
      IMPORT_STATE.analysis = null;
      input.value = '';
      setProgress(0, 0);
      setMessage('', 'info');
      if (mode() === 'update') renderUpdateAnalysis();
      else originalRender();
    }

    input.addEventListener('change', () => {
      IMPORT_STATE.file = input.files?.[0] || null;
      IMPORT_STATE.rows = [];
      IMPORT_STATE.analysis = null;

      if (mode() === 'update') renderUpdateAnalysis();
      else originalRender();

      if (IMPORT_STATE.file) {
        if (mode() === 'update') validateUpdateFile();
        else originalValidate();
      }
    });

    q('checkBtn').onclick = () => {
      if (mode() === 'update') validateUpdateFile();
      else originalValidate();
    };

    q('importBtn').onclick = () => {
      if (mode() === 'update') updateValidatedRows();
      else originalImport();
    };

    q('resetImportBtn').onclick = () => {
      if (mode() === 'update') resetState();
      else {
        originalReset();
        input.value = '';
      }
    };

    q('importMode').addEventListener('change', () => {
      resetState();
      applyModeUi();
    });

    window.__QY4_UPDATE_EXISTING_INSTALLED__ = true;
    window.__QY4_UPDATE_EXISTING__ = {
      parseUpdateValue,
      analyzeUpdateRows,
      mergedPayload,
      readUpdateWorkbook,
      validateUpdateFile
    };

    applyModeUi();
  }

  function waitForBaseInitialization(attempt = 0) {
    if (typeof IMPORT_STATE !== 'undefined'
        && IMPORT_STATE.user
        && typeof validateCurrentFile === 'function'
        && typeof importValidatedRows === 'function'
        && q('excelFile')) {
      setTimeout(installUpdateModeHandlers, 0);
      return;
    }

    if (attempt >= 200) {
      console.error('[IMPORT UPDATE] Không thể chờ module nhập nền khởi tạo.');
      return;
    }
    setTimeout(() => waitForBaseInitialization(attempt + 1), 25);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForBaseInitialization(), { once:true });
  } else {
    waitForBaseInitialization();
  }
})();
