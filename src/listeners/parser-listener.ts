import {
  BitExprContext,
  BoolLiteralContext,
  ColumnRefContext,
  IdentifierContext,
  NullLiteralContext,
  NumLiteralContext,
  PredicateContext,
  PrimaryExprCompareContext,
  SimpleExprLiteralContext,
  TableAliasContext,
  TableRefContext,
  TemporalLiteralContext,
  TextLiteralContext,
  QueryExpressionBodyContext,
  QueryExpressionContext,
  FunctionCallContext,
  PrimaryExprPredicateContext,
  WhereClauseContext,
  ValuesContext,
  FieldsContext,
  SelectAliasContext
} from '../grammar/MySQLParser'
import { MySQLParserListener } from '../grammar/MySQLParserListener'
import { unquote } from '../lib/unquote'
import { RuleContext } from 'antlr4ts'

export enum ReferenceType {
  FunctionRef = 'FunctionRef',
  KeywordRef = 'KeywordRef',
  ColumnRef = 'ColumnRef',
  SchemaRef = 'SchemaRef',
  TableRef = 'TableRef',
  AliasRef = 'AliasRef',
  ValueRef = 'ValueRef'
}

export type Reference =
  | FunctionReference
  | KeywordReference
  | TableReference
  | ColumnReference
  | SchemaReference
  | AliasReference
  | ValueReference

export interface KeywordReference {
  type: ReferenceType
  keyword: string
  start: number
  stop: number
}

export interface SchemaReference {
  type: ReferenceType
  schema: string
  start: number
  stop: number
}

export interface TableReference {
  type: ReferenceType
  schemaReference: SchemaReference | null
  aliasReference: AliasReference | null
  table: string
  start: number
  stop: number
}

export interface ColumnReference {
  type: ReferenceType
  context: ReferenceContext | null
  tableReference: TableReference | null
  aliasReference: AliasReference | null
  column: string
  start: number
  stop: number
}

export interface AliasReference {
  type: ReferenceType
  columnReference: ColumnReference | null
  tableReference: TableReference | null
  alias: string
  start: number
  stop: number
}

type DataType = 'string' | 'number' | 'boolean' | 'date' | 'null'

export interface ValueReference {
  type: ReferenceType
  context: ReferenceContext | null
  columnReference: ColumnReference | null
  dataType: DataType
  value: string
  start: number
  stop: number
}

export interface FunctionReference {
  type: ReferenceType
  function: string
  start: number
  stop: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getParentRule(ctx: RuleContext, parentRule: any): any {
  if (ctx instanceof parentRule) {
    return ctx
  }

  const parent = ctx.parent
  if (parent) {
    return getParentRule(parent, parentRule)
  }

  return null
}

type ReferenceContext = 'valuesClause' | 'whereClause' | 'fieldsClause'

function getReferenceContext(ctx: RuleContext): ReferenceContext | null {
  const whereClauseContext = getParentRule(ctx, WhereClauseContext)
  if (whereClauseContext) {
    return 'whereClause'
  }

  const valuesClauseContext = getParentRule(ctx, ValuesContext)
  if (valuesClauseContext) {
    return 'valuesClause'
  }

  const fieldsClauseContext = getParentRule(ctx, FieldsContext)
  if (fieldsClauseContext) {
    return 'fieldsClause'
  }

  return null
}

function getNestedColumnRef(ctx: RuleContext): ColumnRefContext | null {
  if (ctx instanceof ColumnRefContext) {
    return ctx
  }

  for (let i = 0; i < ctx.childCount; i++) {
    const child = ctx.getChild(i)
    if (child instanceof RuleContext) {
      return getNestedColumnRef(child)
    }
  }

  return null
}

function getDataType(predicate: PredicateContext): DataType | null {
  const literalContext = predicate
    .tryGetChild(0, BitExprContext)
    ?.tryGetChild(0, SimpleExprLiteralContext)
    ?.literal().children

  if (literalContext) {
    const literal = literalContext[0]
    switch (true) {
      case literal instanceof TextLiteralContext:
        return 'string'
      case literal instanceof NumLiteralContext:
        return 'number'
      case literal instanceof BoolLiteralContext:
        return 'boolean'
      case literal instanceof TemporalLiteralContext:
        return 'date'
      case literal instanceof NullLiteralContext:
        return 'null'
    }
  }

  return null
}

// Covers scenarios like top-level columns in WHERE clauses of JOINs + columns in ORDER BY
function getTableRefContext(ctx: RuleContext): TableRefContext | null {
  const queryExpressionBody = getParentRule(ctx, QueryExpressionBodyContext) as QueryExpressionBodyContext
  const queryExpression = getParentRule(ctx, QueryExpressionContext) as QueryExpressionContext
  const context = queryExpressionBody ?? queryExpression?.queryExpressionBody()

  const tableRefContext = context
    ?.querySpecification()
    ?.fromClause()
    ?.tableReferenceList()
    ?.tableReference()[0]
    .tableFactor()
    ?.singleTable()
    ?.tableRef()

  return tableRefContext ?? null
}

function getTableReference(ctx: TableRefContext | null): TableReference | null {
  if (ctx === null) {
    return null
  }

  const qualifierIdentifier = ctx.qualifiedIdentifier()
  if (qualifierIdentifier) {
    const identifier = qualifierIdentifier.identifier()
    const first = unquote(identifier.text)
    const start = identifier.start.startIndex
    const stop = identifier.start.stopIndex

    const dotIdentifier = qualifierIdentifier.dotIdentifier()
    if (dotIdentifier) {
      return {
        type: ReferenceType.TableRef,
        table: unquote(dotIdentifier.identifier().text),
        aliasReference: null,
        schemaReference: {
          type: ReferenceType.SchemaRef,
          schema: first,
          start,
          stop
        },
        start: dotIdentifier.identifier().start.startIndex,
        stop: dotIdentifier.identifier().start.stopIndex
      }
    }

    return {
      type: ReferenceType.TableRef,
      aliasReference: null,
      schemaReference: null,
      table: first,
      start: identifier.start.startIndex,
      stop: identifier.start.stopIndex
    }
  }

  const identifier = ctx.dotIdentifier()?.identifier()
  if (identifier) {
    return {
      type: ReferenceType.TableRef,
      aliasReference: null,
      schemaReference: null,
      table: unquote(identifier.text),
      start: identifier.start.startIndex,
      stop: identifier.start.stopIndex
    }
  }

  return null
}

function getParentTableReference(ctx: RuleContext): TableReference | null {
  const tableRefContext = getTableRefContext(ctx)

  if (!tableRefContext) {
    return null
  }

  return getTableReference(tableRefContext)
}

function getColumnReference(ctx: ColumnRefContext | null): ColumnReference | null {
  if (ctx === null) {
    return null
  }

  const context = ctx.fieldIdentifier()

  const qualifierIdentifier = context.qualifiedIdentifier()
  if (qualifierIdentifier) {
    const identifier = qualifierIdentifier.identifier()
    const first = unquote(identifier.text)
    const start = identifier.start.startIndex
    const stop = identifier.start.stopIndex

    const dotIdentifier = qualifierIdentifier.dotIdentifier()
    if (dotIdentifier) {
      return {
        type: ReferenceType.ColumnRef,
        context: getReferenceContext(ctx),
        column: unquote(dotIdentifier.identifier().text),
        aliasReference: null,
        tableReference: {
          type: ReferenceType.TableRef,
          aliasReference: null,
          schemaReference: null,
          table: first,
          start,
          stop
        },
        start: dotIdentifier.identifier().start.startIndex,
        stop: dotIdentifier.identifier().start.stopIndex
      }
    }

    return {
      type: ReferenceType.ColumnRef,
      column: first,
      context: getReferenceContext(ctx),
      aliasReference: null,
      tableReference: getParentTableReference(context),
      start,
      stop
    }
  }

  const identifier = context.dotIdentifier()?.identifier()
  if (identifier) {
    return {
      type: ReferenceType.ColumnRef,
      column: unquote(identifier.text),
      context: getReferenceContext(ctx),
      aliasReference: null,
      tableReference: getParentTableReference(context),
      start: identifier.start.startIndex,
      stop: identifier.start.stopIndex
    }
  }

  return null
}

function getParentColumnRef(ctx: PredicateContext): ColumnRefContext | null {
  const parent = ctx.parent

  if (parent instanceof PrimaryExprCompareContext) {
    const columnRef = getNestedColumnRef(parent.boolPri())
    return columnRef
  }

  if (parent instanceof PrimaryExprPredicateContext) {
    const columnRef = getNestedColumnRef(parent.predicate())
    return columnRef
  }

  return null
}

export class ParserListener implements MySQLParserListener {
  functionReferences: FunctionReference[]
  keywordReferences: KeywordReference[]
  columnReferences: ColumnReference[]
  tableReferences: TableReference[]
  aliasReferences: AliasReference[]
  valueReferences: ValueReference[]

  constructor() {
    this.functionReferences = []
    this.keywordReferences = []
    this.columnReferences = []
    this.tableReferences = []
    this.aliasReferences = []
    this.valueReferences = []
  }

  exitColumnRef(ctx: ColumnRefContext): void {
    const reference = getColumnReference(ctx)
    if (!reference) {
      return
    }
    this.columnReferences.push(reference)
  }

  exitTableRef(ctx: TableRefContext): void {
    const reference = getTableReference(ctx)
    if (!reference) {
      return
    }
    this.tableReferences.push(reference)
  }

  exitTableAlias(ctx: TableAliasContext): void {
    if (!ctx.parent) {
      return
    }

    const siblingCount = ctx.parent.childCount
    if (siblingCount < 1) {
      return
    }

    const tableChild = ctx.parent.tryGetChild(0, TableRefContext)
    if (!tableChild) {
      return
    }

    const tableReference: TableReference = {
      type: ReferenceType.TableRef,
      aliasReference: null,
      schemaReference: null,
      table: unquote(tableChild.text),
      start: tableChild.start.startIndex,
      stop: tableChild.start.stopIndex
    }

    const aliasChild = ctx.tryGetChild(0, IdentifierContext)
    if (!aliasChild) {
      return
    }

    const aliasReference: AliasReference = {
      type: ReferenceType.AliasRef,
      columnReference: null,
      tableReference,
      alias: unquote(aliasChild.text),
      start: aliasChild.start.startIndex,
      stop: aliasChild.start.stopIndex
    }

    this.aliasReferences.push(aliasReference)
  }

  exitSelectAlias(ctx: SelectAliasContext): void {
    if (!ctx.parent) {
      return
    }

    const predicate = ctx.parent
      .getChild(0)
      .getChild(0)
      .getChild(0) as PredicateContext

    if (!predicate) {
      return
    }

    const columnRef = getParentColumnRef(predicate)

    const aliasChild = ctx.tryGetChild(0, IdentifierContext)
    if (!aliasChild) {
      return
    }

    const aliasReference: AliasReference = {
      type: ReferenceType.AliasRef,
      columnReference: getColumnReference(columnRef),
      tableReference: null,
      alias: unquote(aliasChild.text),
      start: aliasChild.start.startIndex,
      stop: aliasChild.start.stopIndex
    }

    this.aliasReferences.push(aliasReference)
  }

  exitPredicate(ctx: PredicateContext): void {
    const dataType = getDataType(ctx)
    if (!dataType) {
      return
    }

    const columnRef = getParentColumnRef(ctx)

    const valueReference: ValueReference = {
      type: ReferenceType.ValueRef,
      context: getReferenceContext(ctx),
      columnReference: getColumnReference(columnRef),
      dataType,
      value: unquote(ctx.text),
      start: ctx.start.startIndex,
      stop: ctx.start.stopIndex
    }

    this.valueReferences.push(valueReference)
  }

  exitFunctionCall(ctx: FunctionCallContext): void {
    const context = ctx.pureIdentifier()
    if (!context) {
      return
    }

    this.functionReferences.push({
      type: ReferenceType.FunctionRef,
      function: unquote(context.text),
      start: context.start.startIndex,
      stop: context.start.stopIndex
    })
  }

  exitSubquery(): void {
    // ... TODO: figure out how to reset for subqueries
  }

  exitEveryRule(): void {
    // noop
  }
}
