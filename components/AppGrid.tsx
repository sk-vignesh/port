'use client'

import { useRef, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import * as XLSX from 'xlsx'

// Import AG Grid base CSS (required for class-based theming)
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

ModuleRegistry.registerModules([AllCommunityModule])

// CSS custom properties override for dark mode — applied inline on the container
const DARK_VARS: React.CSSProperties = {
  '--ag-background-color':          '#0f172a',
  '--ag-foreground-color':          '#e2e8f0',
  '--ag-border-color':              '#1e293b',
  '--ag-header-background-color':   '#151f32',
  '--ag-header-foreground-color':   '#94a3b8',
  '--ag-row-hover-color':           '#1e2d4a',
  '--ag-selected-row-background-color': '#1e3a5f',
  '--ag-odd-row-background-color':  '#0a1628',
  '--ag-row-border-color':          '#1e293b',
  '--ag-input-focus-border-color':  '#3b82f6',
  '--ag-font-family':               'Inter, system-ui, sans-serif',
  '--ag-font-size':                 '13px',
  '--ag-cell-horizontal-padding':   '12px',
} as React.CSSProperties

export interface AppGridProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rowData: any[]
  columnDefs: ColDef[]
  exportFilename?: string
  height?: number | string
}

export default function AppGrid({
  rowData,
  columnDefs,
  exportFilename = 'export',
  height = 460,
}: AppGridProps) {
  const gridRef = useRef<AgGridReact>(null)

  const defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80,
  }

  const selectionColDef: ColDef = {
    checkboxSelection: true,
    headerCheckboxSelection: true,
    width: 44, minWidth: 44, maxWidth: 44,
    pinned: 'left', resizable: false, sortable: false, filter: false,
  }

  const exportToExcel = useCallback(() => {
    const api = gridRef.current?.api
    if (!api) return
    const selected = api.getSelectedRows()
    const data = selected.length > 0 ? selected : rowData
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    XLSX.writeFile(wb, `${exportFilename}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }, [rowData, exportFilename])

  const onFilterChanged = useCallback((e: { api: GridApi }) => {
    e.api.deselectAll()
  }, [])

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 4px 8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
          {rowData.length} row{rowData.length !== 1 ? 's' : ''}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={exportToExcel} style={{
          padding: '5px 14px', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-input)', color: 'var(--color-text-secondary)',
          cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          ⬇ Export Excel
        </button>
      </div>

      {/* Grid — dark theme via CSS custom properties on container */}
      <div
        className="ag-theme-quartz"
        style={{ height, width: '100%', ...DARK_VARS }}
      >
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={[selectionColDef, ...columnDefs]}
          defaultColDef={defaultColDef}
          rowSelection="multiple"
          suppressRowClickSelection
          animateRows
          onFilterChanged={onFilterChanged as never}
          domLayout="normal"
        />
      </div>
    </div>
  )
}
