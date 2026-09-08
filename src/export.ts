import * as XLSX from 'xlsx'

export function downloadXlsx(filename: string, headers: string[], rows: unknown[][]) {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  sheet['!cols'] = headers.map(() => ({ wch: 24 }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '当前筛选结果')
  XLSX.writeFile(workbook, filename)
}

function escapeCsv(value: unknown): string {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export function maskPhone(phone?: string): string {
  if (!phone) return '—'
  const visible = 4
  if (phone.length <= visible) return '*'.repeat(phone.length)
  return `${'*'.repeat(phone.length - visible)}${phone.slice(-visible)}`
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const content = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
