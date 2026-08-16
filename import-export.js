
document.addEventListener("DOMContentLoaded", async () => {
  setLayout("import","Nhập / Xuất Excel","Xuất dữ liệu hiện có và khôi phục lại bộ dữ liệu mẫu");
  q("exportDevicesBtn").onclick = async () => {
    const rows = await api("/api/devices");
    const csv = [["Mã thiết bị","Tên thiết bị","Nhóm","Khoa/Phòng","Hãng SX","Model","Năm SD","Hạn BH","Tình trạng"]];
    rows.forEach(r => csv.push([r.device_code,r.name,r.group_name,r.department_name,r.manufacturer,r.model,r.year_in_use,formatDateVN(r.warranty_end),r.status]));
    exportCsv("thiet_bi.csv", csv);
  };
  q("exportUsersBtn").onclick = async () => {
    const rows = await api("/api/users");
    const csv = [["Họ tên","Tài khoản","Vai trò","Khoa/Phòng","Trạng thái","Số điện thoại"]];
    rows.forEach(r => csv.push([r.full_name,r.username,r.role,r.department_name || "",r.status,r.phone || ""]));
    exportCsv("nguoi_dung.csv", csv);
  };
  q("resetBtn").onclick = async () => {
    if (!confirm("Khôi phục dữ liệu mẫu?")) return;
    await api("/api/reset-seed", { method: "POST" });
    alert("Đã khôi phục dữ liệu mẫu.");
  };
});
