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

// Map AG Grid's CSS vars to the app's own design tokens — keeps the grid consistent with all other components
const GRID_VARS: React.CSSProperties = {
  '--ag-background-color':              'var(--color-bg-card)',
  '--ag-foreground-color':              'var(--color-text-primary)',
  '--ag-border-color':                  'var(--color-border)',
  '--ag-row-border-color':              'var(--color-border)',
  '--ag-header-background-color':       'var(--color-bg-elevated)',
  '--ag-header-foreground-color':       'var(--color-text-muted)',
  '--ag-row-hover-color':               'color-mix(in srgb, var(--color-accent-light) 6%, var(--color-bg-card))',
  '--ag-selected-row-background-color': 'color-mix(in srgb, var(--color-accent-light) 10%, var(--color-bg-card))',
  '--ag-odd-row-background-color':      'var(--color-bg-card)',
  '--ag-input-focus-border-color':      'var(--color-accent-light)',
  '--ag-font-family':                   'var(--font-sans, Montserrat, Inter, system-ui, sans-serif)',
  '--ag-font-size':                     '13.5px',
  '--ag-cell-horizontal-padding':       '18px',
  '--ag-header-height':                 '42px',
  '--ag-row-height':                    '46px',
  '--ag-header-column-separator-display': 'none',
  '--ag-header-column-resize-handle-display': 'none',
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
        style={{ height, width: '100%', ...GRID_VARS }}
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
