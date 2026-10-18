import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { api, RefundRequest } from '../api'

ModuleRegistry.registerModules([AllCommunityModule])

// PayPal-branded AG Grid theme
const paypalTheme = themeQuartz.withParams({
  accentColor: '#0070BA',
  headerBackgroundColor: '#003087',
  headerTextColor: '#ffffff',
  borderRadius: 8,
  fontFamily: 'inherit',
})

const STATUS_STYLE: Record<string, string> = {
  pending: 'background:#FEF3C7;color:#92400E',
  analyzed: 'background:#DBEAFE;color:#1E40AF',
  approved: 'background:#E0E7FF;color:#3730A3',
  executing: 'background:#F3E8FF;color:#6B21A8',
  executed: 'background:#D1FAE5;color:#065F46',
  rejected: 'background:#FEE2E2;color:#991B1B',
  failed: 'background:#FECACA;color:#7F1D1D',
}

function StatusCell(p: ICellRendererParams<RefundRequest>) {
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      ...(Object.fromEntries((STATUS_STYLE[p.value] ?? 'background:#F3F4F6;color:#374151')
        .split(';').map((s) => s.split(':') as [string, string])) as any),
    }}>
      {p.value}
    </span>
  )
}

function ActionCell(p: ICellRendererParams<RefundRequest>) {
  return (
    <Link to={`/analyze/${p.data!.id}`} style={{ color: '#0070BA', fontWeight: 600 }}>
      Open →
    </Link>
  )
}

export default function RequestsGrid() {
  const [rows, setRows] = useState<RefundRequest[]>([])
  const [error, setError] = useState('')
  const gridRef = useRef<AgGridReact<RefundRequest>>(null)
  const nav = useNavigate()

  useEffect(() => {
    api.list().then(setRows).catch((e) => setError(e.message))
  }, [])

  const cols = useMemo<ColDef<RefundRequest>[]>(() => [
    { field: 'id', headerName: '#', width: 80, filter: 'agNumberColumnFilter' },
    { field: 'order_id', headerName: 'Order', width: 140 },
    { field: 'customer_name', headerName: 'Customer', flex: 1, minWidth: 140 },
    {
      field: 'amount', headerName: 'Amount', width: 120, filter: 'agNumberColumnFilter',
      valueFormatter: (p) => (p.value != null ? `$${Number(p.value).toFixed(2)}` : '—'),
      cellStyle: { fontWeight: 600, textAlign: 'right' },
    },
    { field: 'currency', headerName: 'Cur', width: 80 },
    {
      field: 'status', headerName: 'Status', width: 130, cellRenderer: StatusCell,
      filter: 'agTextColumnFilter',  // agSetColumnFilter is Enterprise-only
    },
    {
      field: 'created_at', headerName: 'Created', width: 170,
      valueFormatter: (p) => new Date(p.value + 'Z').toLocaleString(),
      sort: 'desc',
    },
    { headerName: '', width: 90, cellRenderer: ActionCell, sortable: false, filter: false },
  ], [])

  const exportCsv = useCallback(() => gridRef.current?.api.exportDataAsCsv(), [])

  return (
    <div className="min-h-screen">
      <header className="bg-paypal px-8 py-4 text-white flex items-center gap-6">
        <Link to="/dashboard" className="opacity-80 hover:opacity-100">← Dashboard</Link>
        <h1 className="text-lg font-semibold">Refund Requests — AG Grid</h1>
        <button onClick={exportCsv}
          className="ml-auto bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-lg text-sm font-medium transition">
          Export CSV
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <input
          placeholder="Quick filter (order, customer, status…)"
          onChange={(e) => gridRef.current?.api.setGridOption('quickFilterText', e.target.value)}
          className="mb-4 w-96 border rounded-lg p-2 text-sm focus:ring-2 focus:ring-paypal focus:outline-none"
        />
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-3">{error}</div>}

        <div style={{ height: 560 }}>
          <AgGridReact<RefundRequest>
            ref={gridRef}
            theme={paypalTheme}
            rowData={rows}
            columnDefs={cols}
            defaultColDef={{ sortable: true, filter: true, resizable: true, floatingFilter: true }}
            pagination
            paginationPageSize={20}
            paginationPageSizeSelector={[20, 50, 100]}
            animateRows
            rowSelection={{ mode: 'multiRow' }}
            onRowClicked={(e) => nav(`/analyze/${e.data!.id}`)}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">Click a row to open the analysis panel. Column headers support sort / filter / resize.</p>
      </main>
    </div>
  )
}
