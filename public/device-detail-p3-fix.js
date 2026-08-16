(() => {
  // Serial Number hãng và mã HIS/BHXH là hai trường độc lập trên mọi màn hình.
  autoFillGeneralSerial = function p3NoSerialAutofill() {};

  saveGeneral = async function p3SaveGeneralStrictSerial() {
    const payload = {
      department_code: q("generalDepartment").value,
      group_code: q("generalGroup").value,
      device_code: q("generalDeviceCode").value,
      insurance_code: q("generalInsuranceCode").value.trim(),
      name: q("generalName").value.trim(),
      manufacturer: q("generalManufacturer").value.trim(),
      model: q("generalModel").value.trim(),
      serial: q("generalSerial").value.trim(),
      country: q("generalCountry").value.trim(),
      year_manufactured: Number(q("generalYearManufactured").value || 0),
      year_in_use: Number(q("generalYearInUse").value || 0),
      warranty_end: q("generalWarranty").value,
      status: q("generalStatus").value,
      quality_level: Number(q("generalQuality").value || 3),
      cost: Number(q("generalCost").value || 0),
      funding: q("generalFunding").value.trim(),
      location: q("generalLocation").value.trim(),
      note: q("generalNote").value.trim()
    };
    try {
      await api(`/api/devices/${DEVICE_ID}`, { method: "PUT", body: JSON.stringify(payload) });
      toggleGeneral(false);
      await loadDevice();
    } catch (e) {
      alert(e?.message || "Không cập nhật được thông tin thiết bị.");
    }
  };

  deleteMaint = async function p3CancelMaintenance(id) {
    const reason = prompt("Nhập lý do hủy bản ghi bảo dưỡng:", "Nhập nhầm / không còn áp dụng");
    if (reason === null) return;
    if (!reason.trim()) return alert("Vui lòng nhập lý do hủy.");
    try {
      await api(`/api/maintenances/${id}`, { method:"DELETE", body:JSON.stringify({ reason: reason.trim() }) });
      await loadDevice();
    } catch (e) {
      alert(e?.message || "Không hủy được bản ghi bảo dưỡng.");
    }
  };

  deleteInspection = async function p3CancelInspection(id) {
    const reason = prompt("Nhập lý do hủy hồ sơ kiểm định/hiệu chuẩn:", "Nhập nhầm / hồ sơ không còn áp dụng");
    if (reason === null) return;
    if (!reason.trim()) return alert("Vui lòng nhập lý do hủy.");
    try {
      await api(`/api/inspections/${id}`, { method:"DELETE", body:JSON.stringify({ reason: reason.trim() }) });
      await loadDevice();
    } catch (e) {
      alert(e?.message || "Không hủy được hồ sơ kiểm định/hiệu chuẩn.");
    }
  };

  // Các dữ liệu chung/tệp tài liệu được render thành HTML nên phải escape nội dung người dùng nhập.
  infoItem = function p3SafeInfoItem(label, value) {
    return `<div class="info-item"><div class="info-label">${esc(label)}</div><div class="info-value">${esc(value || "—")}</div></div>`;
  };
  docFileLabel = function p3SafeDocFileLabel(x) {
    if (!x.file_path) return "—";
    const name = x.original_name || x.stored_name || "Tệp đính kèm";
    return `<a href="${esc(x.file_path)}" target="_blank" rel="noopener">${esc(name)}</a>`;
  };

  const p3OriginalRenderAll = renderAll;
  renderAll = function p3RenderAll() {
    p3OriginalRenderAll();
    document.querySelectorAll('#maintRows button[onclick^="deleteMaint"]').forEach(btn => {
      btn.textContent = "Hủy";
      btn.title = "Hủy bản ghi nhưng vẫn giữ lịch sử";
    });
    document.querySelectorAll('#inspectionRows button[onclick^="deleteInspection"]').forEach(btn => {
      btn.textContent = "Hủy";
      btn.title = "Hủy hồ sơ nhưng vẫn giữ lịch sử";
    });
    if (q("detailStatus")) q("detailStatus").innerHTML = `<span class="tag ${statusTagClass(DEVICE.status)}">${esc(DEVICE.status || "")}</span>`;
  };
})();
