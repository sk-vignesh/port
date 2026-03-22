'use client'

import { useRef, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridReadyEvent, SelectionChangedEvent, GridApi } from 'ag-grid-community'
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community'
import * as XLSX from 'xlsx'

ModuleRegistry.registerModules([AllCommunityModule])

// Dark-mode theme matching the app's palette
const appTheme = themeQuartz.withParams({
  backgroundColor:        '#0f172a',
  foregroundColor:        '#e2e8f0',
  borderColor:            '#1e293b',
  chromeBackgroundColor:  '#151f32',
  rowHoverColor:          '#1e2d4a',
  selectedRowBackgroundColor: '#1e3a5f',
  headerBackgroundColor:  '#151f32',
  headerForegroundColor:  '#94a3b8',
  headerColumnResizeHandleColor: '#334155',
  oddRowBackgroundColor:  '#0f172a',
  inputFocusBorder:       '1px solid #3b82f6',
  fontFamily:             'Inter, system-ui, sans-serif',
  fontSize:               13,
})

export interface AppGridProps<T = Record<string, unknown>> {
  rowData: T[]
  columnDefs: ColDef[]
  exportFilename?: string
  height?: number | string
  quickFilter?: boolean
}

export default function AppGrid<T = Record<string, unknown>>({
  rowData,
  columnDefs,
  exportFilename = 'export',
  height = 460,
  quickFilter = true,
}: AppGridProps<T>) {
  const gridRef = useRef<AgGridReact<T>>(null)

  const defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 80,
  }

  const selectionColDef: ColDef = {
    checkboxSelection: true,
    headerCheckboxSelection: true,
    width: 44,
    minWidth: 44,
    maxWidth: 44,
    pinned: 'left',
    resizable: false,
    sortable: false,
    filter: false,
  }

  const exportToExcel = useCallback(() => {
    const api = gridRef.current?.api
    if (!api) return
    const selectedRows = api.getSelectedRows()
    const dataToExport: T[] = selectedRows.length > 0 ? selectedRows : rowData

    const ws = XLSX.utils.json_to_sheet(dataToExport as Record<string, unknown>[])
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
        <button
          onClick={exportToExcel}
          style={{
            padding: '5px 14px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-input)', color: 'var(--color-text-secondary)',
            cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          ⬇ Export Excel
        </button>
      </div>

      {/* Grid */}
      <div style={{ height, width: '100%' }}>
        <AgGridReact<T>
          ref={gridRef}
          rowData={rowData}
          columnDefs={[selectionColDef, ...columnDefs]}
          defaultColDef={defaultColDef}
          theme={appTheme}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          animateRows={true}
          onFilterChanged={onFilterChanged as never}
          domLayout="normal"
        />
      </div>
    </div>
  )
}
