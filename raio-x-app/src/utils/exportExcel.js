import * as XLSX from 'xlsx'

export function exportToExcel(data, filename = 'dados') {
  if (!data?.length) return
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
