'use client'

import { useRef, useCallback, useState } from 'react'
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
  showSearch?: boolean
}

export default function AppGrid({
  rowData,
  columnDefs,
  exportFilename = 'export',
  height = 460,
  showSearch = true,
}: AppGridProps) {
  const gridRef  = useRef<AgGridReact>(null)
  const [search,         setSearch]         = useState('')
  const [filtersEnabled, setFiltersEnabled] = useState(false)

  const defaultColDef: ColDef = {
    sortable: true,
    filter: filtersEnabled,   // hidden by default; shown when toggled on
    resizable: true,
    minWidth: 80,
  }

  const selectionColDef: ColDef = {
    checkboxSelection: true,
    headerCheckboxSelection: true,
    width: 40, minWidth: 40, maxWidth: 40,
    pinned: 'left', resizable: false, sortable: false, filter: false,
  }

  const handleSearch = useCallback((val: string) => {
    setSearch(val)
    gridRef.current?.api.setGridOption('quickFilterText', val)
  }, [])

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

  // When turning filters off, also clear any active filters
  const toggleFilters = useCallback(() => {
    const next = !filtersEnabled
    setFiltersEnabled(next)
    if (!next) gridRef.current?.api.setFilterModel(null)
  }, [filtersEnabled])

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 2px 10px', flexWrap: 'wrap' }}>
        {showSearch && (
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)', fontSize: 13, pointerEvents: 'none',
            }}>🔍</span>
            <input
              type="text"
              className="form-input"
              placeholder="Search…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              style={{ paddingLeft: 30, fontSize: '0.82rem', height: 34 }}
            />
          </div>
        )}
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
          {rowData.length} {rowData.length !== 1 ? 'records' : 'record'}
        </span>
        <div style={{ flex: 1 }} />

        {/* Filter toggle */}
        <button
          onClick={toggleFilters}
          title={filtersEnabled ? 'Hide column filters' : 'Show column filters'}
          style={{
            padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
            fontSize: '0.75rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: 'Montserrat, sans-serif',
            border: filtersEnabled
              ? '1px solid var(--color-accent-light)'
              : '1px solid var(--color-border)',
            background: filtersEnabled
              ? 'var(--color-accent-glow, rgba(59,130,246,0.12))'
              : 'var(--color-bg-elevated)',
            color: filtersEnabled
              ? 'var(--color-accent-light)'
              : 'var(--color-text-muted)',
            transition: 'all 0.15s',
          }}
        >
          ⚡ Filters {filtersEnabled ? 'on' : 'off'}
        </button>

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

      {/* Grid */}
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
