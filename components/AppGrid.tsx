'use client'

import { useRef, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import * as XLSX from 'xlsx'
import { appGridTheme } from '@/lib/agGridTheme'

ModuleRegistry.registerModules([AllCommunityModule])

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

      <div style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden' }}>
        <AgGridReact
          ref={gridRef}
          theme={appGridTheme}
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
