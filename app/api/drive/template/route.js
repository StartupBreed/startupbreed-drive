import * as XLSX from 'xlsx';

export async function GET() {
  const wb = XLSX.utils.book_new();

  // ── Instructions sheet ──────────────────────────────────────────────
  const instructions = [
    ['STARTUPBREED — PIPELINE IMPORT TEMPLATE'],
    [''],
    ['HOW TO USE:'],
    ['1. Fill in the "Pipeline" sheet with your data (one row per position)'],
    ['2. Do NOT rename or delete any column headers'],
    ['3. Save the file and upload it via the "Import Excel" button in the app'],
    ['4. Existing clients and positions will be skipped automatically — safe to run multiple times'],
    [''],
    ['COLUMN GUIDE:'],
    ['Client Name', 'The company/client name. A folder will be created for each unique client.'],
    ['Position Name', 'The job title. A subfolder will be created inside the client folder.'],
    ['Status', 'Must be one of: active | paused | inactive | closed'],
    ['Manager', 'Recruiter nickname (must match a name in your Employees list)'],
    ['Support', 'Supporting recruiter nickname (optional)'],
    ['Seniority', 'Must be one of: Entry | Mid | Senior | Management | Executive'],
    ['Location', 'City or "Remote" (optional)'],
    ['Salary Min', 'Minimum salary in THB — numbers only, no commas (e.g. 80000)'],
    ['Salary Max', 'Maximum salary in THB — numbers only, no commas (e.g. 120000)'],
    ['Commission', 'Commission percentage — number only, no % sign (e.g. 20)'],
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 20 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  // ── Pipeline sheet ───────────────────────────────────────────────────
  const headers = [
    'Client Name',
    'Position Name',
    'Status',
    'Manager',
    'Support',
    'Seniority',
    'Location',
    'Salary Min',
    'Salary Max',
    'Commission',
  ];

  const exampleRows = [
    ['Acme Corp', 'Senior Software Engineer', 'active', 'Billie', 'Cartoon', 'Senior', 'Bangkok', 80000, 120000, 20],
    ['Acme Corp', 'Head of Marketing', 'paused', 'Billie', '', 'Management', 'Remote', 100000, 150000, 20],
    ['Beta Startup', 'Data Analyst', 'active', 'Cartoon', '', 'Mid', 'Chiang Mai', 50000, 70000, 18],
  ];

  const wsData = [headers, ...exampleRows];
  const wsPipeline = XLSX.utils.aoa_to_sheet(wsData);
  wsPipeline['!cols'] = [
    { wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPipeline, 'Pipeline');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="StartupBreed_Pipeline_Template.xlsx"',
    },
  });
}
