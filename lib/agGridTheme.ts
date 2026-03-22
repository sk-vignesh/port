import { themeQuartz } from 'ag-grid-community'

/**
 * Shared AG Grid theme using themeQuartz JS API (AG Grid v33+).
 * Montserrat font + app CSS design tokens.
 * Usage: <AgGridReact theme={appGridTheme} />
 */
export const appGridTheme = themeQuartz.withParams({
  fontFamily:                 'Montserrat, sans-serif',
  fontSize:                   13,
  rowHeight:                  44,
  headerHeight:               42,
  cellHorizontalPaddingScale: 1.4,
  columnBorder:               false,
  rowBorder:                  true,
  backgroundColor:            'var(--color-bg-card)',
  oddRowBackgroundColor:      'var(--color-bg-card)',
  headerBackgroundColor:      'var(--color-bg-elevated)',
  foregroundColor:            'var(--color-text-primary)',
  headerTextColor:            'var(--color-text-muted)',
  borderColor:                'var(--color-border)',
  rowHoverColor:              'rgba(59,130,246,0.07)',
  selectedRowBackgroundColor: 'rgba(59,130,246,0.12)',
  inputBorder:                'solid 1px var(--color-border)',
  inputFocusBorder:           'solid 1px var(--color-accent-light)',
  checkboxCheckedBackgroundColor:  'var(--color-accent)',
  checkboxCheckedBorderColor:      'var(--color-accent)',
  checkboxUncheckedBorderColor:    'var(--color-border)',
})
