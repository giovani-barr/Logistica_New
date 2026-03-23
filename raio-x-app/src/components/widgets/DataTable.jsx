import { useMemo, useState, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Search, ChevronLeft, ChevronRight, Columns3 } from 'lucide-react'
import { useRaioX } from '../../context/RaioXContext'

export default function DataTable({ data, colunasVisiveis, abaId, onExport, expanded = false }) {
  const { theme } = useRaioX()
  const dark = theme === 'dark'

  const [sorting, setSorting] = useState([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState([])
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const [colSearch, setColSearch] = useState('')
  const [columnVisibility, setColumnVisibility] = useState(() => {
    if (!colunasVisiveis?.length) return {}
    const allCols = data.length ? Object.keys(data[0]) : []
    const vis = {}
    allCols.forEach(c => { vis[c] = colunasVisiveis.includes(c) })
    return vis
  })

  useEffect(() => {
    if (!colunasVisiveis?.length) {
      setColumnVisibility({})
      return
    }
    const allCols = data.length ? Object.keys(data[0]) : []
    const vis = {}
    allCols.forEach((column) => {
      vis[column] = colunasVisiveis.includes(column)
    })
    setColumnVisibility(vis)
  }, [colunasVisiveis, data])

  useEffect(() => {
    table.setPageSize(expanded ? 50 : 25)
  }, [expanded])

  const columns = useMemo(() => {
    if (!data.length) return []
    return Object.keys(data[0]).map(key => ({
      accessorKey: key,
      header: key,
      cell: info => {
        const v = info.getValue()
        if (v == null) return <span className="text-slate-400">—</span>
        return String(v)
      },
      size: 150,
    }))
  }, [data])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  const SortIcon = ({ column }) => {
    const s = column.getIsSorted()
    if (s === 'asc') return <ArrowUp size={12} />
    if (s === 'desc') return <ArrowDown size={12} />
    return <ArrowUpDown size={12} className="opacity-40" />
  }

  const cls = {
    input: `w-full rounded-lg border ${expanded ? 'px-3.5 py-2 text-sm' : 'px-3 py-1.5 text-xs'} outline-none ${dark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'}`,
    th: `text-left font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap ${expanded ? 'px-3 py-2.5 text-xs' : 'px-3 py-2 text-[11px]'} ${dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`,
    td: `${expanded ? 'px-3 py-2.5 text-sm' : 'px-3 py-2 text-xs'} whitespace-nowrap text-left ${dark ? 'text-slate-300' : 'text-slate-700'}`,
    btn: `${expanded ? 'px-2.5 py-1.5 text-sm' : 'px-2 py-1 text-xs'} rounded ${dark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`,
    btnActive: `${expanded ? 'px-2.5 py-1.5 text-sm' : 'px-2 py-1 text-xs'} rounded bg-blue-500 text-white`,
  }

  return (
    <div className="flex flex-col h-full">
      {/* toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className={`relative flex-1 ${expanded ? 'min-w-[280px]' : 'min-w-[180px]'}`}>
          <Search size={expanded ? 16 : 14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar em todas as colunas..."
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
            className={`${cls.input} pl-8`}
          />
        </div>
        <div className="relative">
          <button onClick={() => { setColMenuOpen(v => !v); setColSearch('') }} className={cls.btn} title="Colunas">
            <Columns3 size={14} />
          </button>
          {colMenuOpen && (
            <div className={`absolute right-0 top-full mt-1 z-50 rounded-lg border shadow-lg min-w-[200px] ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className="p-2 border-b" style={{ borderColor: dark ? '#334155' : '#e2e8f0' }}>
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar campo..."
                    value={colSearch}
                    onChange={e => setColSearch(e.target.value)}
                    className={`w-full rounded border pl-6 pr-2 ${expanded ? 'py-1.5 text-sm' : 'py-1 text-xs'} outline-none ${dark ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`}
                    autoFocus
                  />
                </div>
              </div>
              <div className="overflow-y-auto max-h-52 p-1">
                {table.getAllLeafColumns()
                  .filter(col => col.id.toLowerCase().includes(colSearch.toLowerCase()))
                  .map(col => (
                    <label key={col.id} className={`flex items-center gap-2 px-2 py-1 rounded ${expanded ? 'text-sm' : 'text-xs'} cursor-pointer ${dark ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <input type="checkbox" checked={col.getIsVisible()} onChange={col.getToggleVisibilityHandler()} />
                      {col.id}
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>
        {onExport && (
          <button onClick={() => onExport(table.getFilteredRowModel().rows.map(r => r.original))} className={cls.btn} title="Exportar Excel">
            <Download size={14} />
          </button>
        )}
      </div>

      {/* table */}
      <div className="flex-1 overflow-auto rounded-lg border" style={{ minHeight: 0 }}>
        <table className="w-full border-collapse">
          <thead className={`sticky top-0 ${dark ? 'bg-slate-800 border-b border-slate-700' : 'bg-slate-50 border-b border-slate-200'}`}>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id} className={cls.th} style={{ width: h.getSize() }} onClick={h.column.getToggleSortingHandler()}>
                    <div className="flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      <SortIcon column={h.column} />
                    </div>
                  </th>
                ))}
              </tr>
            ))}
            {/* column filters row */}
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id + '-filter'}>
                {hg.headers.map(h => (
                  <th key={h.id} className="px-2 py-1">
                    <input
                      type="text"
                      value={(table.getColumn(h.id)?.getFilterValue() ?? '')}
                      onChange={e => table.getColumn(h.id)?.setFilterValue(e.target.value)}
                      placeholder="filtrar…"
                      className={`w-full rounded border ${expanded ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]'} outline-none ${dark ? 'bg-slate-900 border-slate-700 text-slate-300 placeholder-slate-600' : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'}`}
                    />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr key={row.id} className={`${dark ? (i % 2 ? 'bg-slate-800/50' : '') + ' hover:bg-slate-700/50' : (i % 2 ? 'bg-slate-50/50' : '') + ' hover:bg-blue-50/40'} transition-colors`}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className={cls.td}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className={`flex items-center justify-between mt-2 ${expanded ? 'text-sm' : 'text-xs'} text-slate-500`}>
        <span>{table.getFilteredRowModel().rows.length} registros</span>
        <div className="flex items-center gap-1">
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className={cls.btn}>
            <ChevronLeft size={14} />
          </button>
          <span className={dark ? 'text-slate-400' : 'text-slate-600'}>
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className={cls.btn}>
            <ChevronRight size={14} />
          </button>
          <select
            value={table.getState().pagination.pageSize}
            onChange={e => table.setPageSize(Number(e.target.value))}
            className={`ml-2 rounded border ${expanded ? 'px-2 py-1 text-sm' : 'px-1 py-0.5 text-xs'} ${dark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}
          >
            {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s} linhas</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
