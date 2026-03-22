'use client'

import { useRef, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import * as XLSX from 'xlsx'

import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

ModuleRegistry.registerModules([AllCommunityModule])

// Fine-tune the dark quartz base theme to match the app's design system
const GRID_VARS: React.CSSProperties = {
  // Backgrounds — pulled from app tokens
  '--ag-background-color':               'var(--color-bg-card)',
  '--ag-odd-row-background-color':       'var(--color-bg-card)',
  '--ag-header-background-color':        'var(--color-bg-elevated)',
  '--ag-row-hover-color':                '#1e3a5f',
  '--ag-selected-row-background-color':  '#1e3a5f',
  '--ag-modal-overlay-background-color': 'rgba(0,0,0,0.5)',

  // Text
  '--ag-foreground-color':        'var(--color-text-primary)',
  '--ag-header-foreground-color': 'var(--color-text-muted)',
  '--ag-secondary-foreground-color': 'var(--color-text-muted)',

  // Borders — subtle
  '--ag-border-color':            'var(--color-border)',
  '--ag-row-border-color':        'var(--color-border)',
  '--ag-cell-horizontal-border':  'none',

  // Inputs / focus
  '--ag-input-focus-border-color': 'var(--color-accent-light)',
  '--ag-input-border-color':       'var(--color-border)',

  // Typography — hardcoded Montserrat bypasses CSS var resolution issues
  '--ag-font-family':   'Montserrat, sans-serif',
  '--ag-font-size':     '13px',
  '--ag-font-weight-normal': '400',

  // Layout
  '--ag-cell-horizontal-padding': '16px',
  '--ag-header-height':           '42px',
  '--ag-row-height':               '44px',
  '--ag-list-item-height':         '36px',

  // Hide column separators for a cleaner look
  '--ag-header-column-separator-display':       'none',
  '--ag-header-column-resize-handle-display':   'none',

  // Range selection
  '--ag-range-selection-border-color':          'var(--color-accent)',
  '--ag-range-selection-background-color':      'rgba(59,130,246,0.08)',
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
    width: 40, minWidth: 40, maxWidth: 40,
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
          {rowData.length} {rowData.length !== 1 ? 'records' : 'record'}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={exportToExcel} style={{
          padding: '5px 14px', borderRadius: 6,
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)',
          cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'Montserrat, sans-serif',
        }}>
          ↓ Export
        </button>
      </div>

      {/* ag-theme-quartz-dark = proper dark base; GRID_VARS refine colors to match app */}
      <div
        className="ag-theme-quartz-dark"
        style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden', ...GRID_VARS }}
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
