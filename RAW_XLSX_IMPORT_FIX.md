# Raw XLSX import fallback

Hotfix for device Excel import. The browser first reads `.xlsx` directly as ZIP/XML instead of calling `ExcelJS.Workbook.xlsx.load()`, which can fail with `Cannot read properties of undefined (reading 'sheets')` on some workbooks. The existing protected server reader remains as a fallback.

The reader only extracts workbook relationships, shared strings, the preferred `IMPORT_READY`/`NHAP_THIET_BI` worksheet, and cell values required by the existing import validation flow. It does not alter database schema or import data automatically.
