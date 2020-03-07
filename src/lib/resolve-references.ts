import { ParserListener, Reference } from '../listeners/parser-listener'

export function resolveReferences(parserListener: ParserListener): Reference[] {
  const { tableReferences, columnReferences, valueReferences, aliasReferences } = parserListener

  // if there is only 1 table reference, all column and value references belong to that table
  if (tableReferences.length === 1) {
    for (const columnReference of columnReferences) {
      columnReference.tableReference = tableReferences[0]
    }
    for (const [i, valueReference] of valueReferences.entries()) {
      if (valueReference.columnReference) {
        valueReference.columnReference.tableReference = tableReferences[0]
      } else {
        // TODO: this is for INSERT references, and assumes that
        // the column references are ordered. It may be better to do
        // this in the parse listener.
        valueReference.columnReference = columnReferences[i]
      }
    }
  } else {
    // resolve aliases
    for (const columnReference of columnReferences) {
      const aliasReference = aliasReferences.find(r => r.alias === columnReference.tableReference?.table)
      if (aliasReference) {
        columnReference.tableReference = aliasReference.tableReference
      }
    }
    for (const valueReference of valueReferences) {
      if (valueReference.columnReference) {
        const aliasReference = aliasReferences.find(
          r => r.alias === valueReference.columnReference?.tableReference?.table
        )
        if (aliasReference) {
          valueReference.columnReference.tableReference = aliasReference.tableReference
        }
      }
    }
  }

  return [
    ...parserListener.functionReferences,
    ...parserListener.keywordReferences,
    ...parserListener.columnReferences,
    ...parserListener.tableReferences,
    ...parserListener.aliasReferences,
    ...parserListener.valueReferences
  ]
}
