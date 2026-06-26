// Inline copy of relevant parsing logic with logs
import * as XLSX from "xlsx";
import * as fs from "fs";
const buf = fs.readFileSync("/mnt/user-uploads/02_SMP_CCM_MDR_progress-13.xlsx");
const wb = XLSX.read(buf, { type: "buffer", cellStyles: true, cellDates: false, cellNF: true });
const ws = wb.Sheets["STR"];

// monkeypatch console.log into parser by re-importing it after env tweak — simpler: just instrument parseSheet via dynamic
process.env.MDR_DEBUG = "1";
