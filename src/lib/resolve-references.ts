import { TableReference, ColumnReference, ValueReference } from '../listeners/parser-listener'

export function resolveColumns(
  columnReferences: ColumnReference[],
  tableReferences: TableReference[]
): ColumnReference[] {
  const columnRefs = [...columnReferences]

  if (tableReferences.length === 1) {
    for (const columnRef of columnRefs) {
      columnRef.tableReference = tableReferences[0]
    }
  }

  return columnRefs
}

export function resolveValues(
  valueReferences: ValueReference[],
  tableReferences: TableReference[],
  columnReferences: ColumnReference[]
): ValueReference[] {
  const valueRefs = [...valueReferences]

  if (tableReferences.length === 1) {
    for (const [i, valueRef] of valueRefs.entries()) {
      if (valueRef.columnReference) {
        valueRef.columnReference.tableReference = tableReferences[0]
      } else {
        valueRef.columnReference = columnReferences[i]
      }
    }
  }

  return valueRefs
}
