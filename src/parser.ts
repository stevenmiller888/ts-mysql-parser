import {
  ANTLRInputStream,
  CommonTokenStream,
  Token,
  BailErrorStrategy,
  DefaultErrorStrategy,
  RuleContext
} from 'antlr4ts'
import { MySQLParserListener } from './grammar/MySQLParserListener'
import { MySQLParser } from './grammar/MySQLParser'
import { MySQLLexer } from './grammar/MySQLLexer'
import { ParserListener, Reference, ReferenceType } from './listeners/parser-listener'
import { ParserErrorListener } from './listeners/parser-error-listener'
import { LexerErrorListener } from './listeners/lexer-error-listener'
import { reservedKeywordsForVersion, keywordsForVersion, versionToNumber } from './lib/version'
import { skipLeadingWhitespace } from './lib/skip-leading-whitespace'
import { resolveReferences } from './lib/resolve-references'
import { LexerError, ParserError } from './listeners/errors'
import { MySQLQueryType } from './lib/parsers-common'
import { PredictionMode } from 'antlr4ts/atn/PredictionMode'
import { SqlMode } from './grammar/common'
import { RuleName } from './lib/rule-name'

/** Statement represents a single MySQL query */
export interface Statement {
  /** The text of the statement */
  text: string
  /** The zero-based offset of the starting position of the statement in the original text */
  start: number
  /** The zero-based offset of the stopping position of the statement in the original text */
  stop: number
}

/** ParseResult represents all relevant results of parsing a query */
export interface ParseResult {
  /** The listener during the parsing phase */
  parserListener: MySQLParserListener
  /** The error that occurred during the parsing phase */
  parserError?: ParserError
  /** The error that ocurrred during the lexing phase */
  lexerError?: LexerError
  /** The references found during parsing (e.g. tables, columns, etc.) */
  references: Reference[]
  /** The generated MySQL parser */
  parser: MySQLParser
  /** The generated MySQL lexer */
  lexer: MySQLLexer
  /** The parse tree */
  tree: RuleContext
}

/** ParserOptions represents the options passed into the parser */
export interface ParserOptions {
  /** Custom parser error listener */
  readonly parserErrorListener?: ParserErrorListener
  /** Custom lexer error listener */
  readonly lexerErrorListener?: LexerErrorListener
  /** Custom parser listener */
  readonly parserListener?: MySQLParserListener
  /* MySQL charsets e.g. [ "_utf8" ] */
  readonly charsets?: string[]
  /* MySQL version. e.g. "5.7.7"  */
  readonly version?: string
  /* MySQL mode e.g. SqlMode.AnsiQuotes */
  readonly mode?: SqlMode
}

export default class Parser {
  parserErrorListener?: ParserErrorListener
  lexerErrorListener?: LexerErrorListener
  parserListener?: MySQLParserListener
  charsets: string[]
  version: string
  mode: SqlMode

  public constructor(options: ParserOptions = {}) {
    this.parserErrorListener = options.parserErrorListener
    this.lexerErrorListener = options.lexerErrorListener
    this.parserListener = options.parserListener
    this.mode = options.mode || SqlMode.NoMode
    this.version = options.version || '5.7.7'
    this.charsets = options.charsets || []
  }

  /**
   * Parse the given MySQL query. Execution order:
   *
   *  1. Initialize streams and lexer/parser
   *  2. Remove error listeners
   *  3. Set MySQL version/mode/charsets in the parser and lexer
   *  4. Prepare listeners
   *  5. Parse query in two-stage process
   *  6. Resolve references found during parse
   *  7. Return relevant parsing results
   *
   * @param query - the query to parse
   * @param context - the optional rule context to invoke. defaults to `.query()`
   * @returns ParseResult
   */
  public parse(query: string, context: RuleName = RuleName.query): ParseResult {
    const inputStream = new ANTLRInputStream(query)
    const lexer = new MySQLLexer(inputStream)
    const tokenStream = new CommonTokenStream(lexer)
    const parser = new MySQLParser(tokenStream)

    // remove antlr default error listeners
    lexer.removeErrorListeners()
    parser.removeErrorListeners()

    // set MySQL version
    const version = versionToNumber(this.version)
    parser.serverVersion = version
    lexer.serverVersion = version

    // set MySQL mode
    parser.sqlMode = this.mode
    lexer.sqlMode = this.mode

    // set MySQL charsets
    lexer.charsets = this.charsets

    // prepare parser error listener
    const parserErrorListener = this.parserErrorListener || new ParserErrorListener()
    parser.addErrorListener(parserErrorListener)

    // prepare lexer error listener
    const lexerErrorListener = this.lexerErrorListener || new LexerErrorListener(lexer)
    lexer.addErrorListener(lexerErrorListener)

    // prepare parse listener
    const parserListener = this.parserListener || new ParserListener()
    parser.addParseListener(parserListener)

    // two-step parsing process
    //    step 1: attempt SLL that almost always works and is fast
    //    step 2: if step 1 fails, use full LL parse to ensure we have a real failure
    parser.interpreter.setPredictionMode(PredictionMode.SLL)
    parser.errorHandler = new BailErrorStrategy()
    let tree: RuleContext
    try {
      tree = parser[context]()
    } catch (e) {
      inputStream.reset()
      lexerErrorListener.error = undefined
      parserErrorListener.error = undefined
      parser.errorHandler = new DefaultErrorStrategy()
      parser.interpreter.setPredictionMode(PredictionMode.LL)
      tree = parser[context]()
    }

    let references: Reference[] = []
    if (parserListener instanceof ParserListener) {
      references = resolveReferences(parserListener)
    }

    return {
      parserError: parserErrorListener.error,
      lexerError: lexerErrorListener.error,
      parserListener,
      references,
      parser,
      lexer,
      tree
    }
  }

  /**
   * Get the node at the given offset in the source text.
   *
   * @param parseResult
   * @param offset
   * @returns Reference | null
   */
  public getNodeAtOffset(parseResult: ParseResult, offset: number): Reference | null {
    const reference = this.getReferenceAtOffset(parseResult, offset)
    if (reference) {
      return reference
    }

    // note: it may be better to do this in the parse listener
    const token = this.getTokenAtOffset(parseResult, offset)
    // TODO: check the token type
    if (token && token.text) {
      if (this.isReservedKeyword(token.text)) {
        return {
          type: ReferenceType.KeywordRef,
          keyword: token.text,
          start: token.startIndex,
          stop: token.stopIndex
        }
      }
    }

    return null
  }

  public getTokenAtOffset(parseResult: ParseResult, offset: number): Token | null {
    parseResult.lexer.reset()

    const tokens = parseResult.lexer.getAllTokens()

    let found: Token | null = null

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (offset >= token.startIndex && offset <= token.stopIndex) {
        found = token
        break
      }
    }

    return found
  }

  public getReferenceAtOffset(parseResult: ParseResult, offset: number): Reference | null {
    let found: Reference | null = null

    for (const reference of parseResult.references) {
      if (offset >= reference.start && offset <= reference.stop) {
        found = reference
        break
      }
    }

    return found
  }

  /**
   * Split a text of MySQL queries into multiple statements, optionally specifying the line break and delimiter.
   *
   * @param text
   * @param lineBreak
   * @param delimiter
   * @returns Statement[]
   */
  public splitStatements(text: string, lineBreak?: string, delimiter?: string): Statement[] {
    lineBreak = lineBreak || '\n'
    delimiter = delimiter || ';'

    const statements: Statement[] = []
    let delimiterHead = delimiter[0]
    const keywordPos = 0
    const start = 0
    let head = start
    let tail = head
    const end = head + text.length

    // Set when anything else but comments were found for the current statement.
    let haveContent = false

    while (tail < end) {
      switch (text[tail]) {
        // Possible multi line comment or hidden (conditional) command.
        case '/': {
          if (text[tail + 1] === '*') {
            tail += 2
            const isHiddenCommand = text[tail] === '!'

            // eslint-disable-next-line no-constant-condition
            while (true) {
              while (tail < end && text[tail] !== '*') {
                tail++
              }

              // Unfinished comment.
              if (tail === end) {
                break
              } else {
                if (text[++tail] === '/') {
                  // Skip the slash too.
                  tail++
                  break
                }
              }
            }

            if (isHiddenCommand) {
              haveContent = true
            }

            if (!haveContent) {
              // Skip over the comment.
              head = tail
            }
          } else {
            tail++
          }

          break
        }
        // Possible single line comment.
        case '-': {
          const endChar = tail + 2
          if (
            text[tail + 1] === '-' &&
            (text[endChar] === ' ' || text[endChar] === '\t' || text[endChar] === lineBreak)
          ) {
            // Skip everything until the end of the line.
            tail += 2

            while (tail < end && text[tail] !== lineBreak) {
              tail++
            }

            if (!haveContent) {
              head = tail
            }
          } else {
            tail++
          }

          break
        }
        // MySQL single line comment.
        case '#': {
          while (tail < end && text[tail] !== lineBreak) {
            tail++
          }

          if (!haveContent) {
            head = tail
          }

          break
        }
        case '"':
        case "'":
        case '`': {
          haveContent = true
          const quote = text[tail++]

          while (tail < end && text[tail] !== quote) {
            // Skip any escaped character too.
            if (text[tail] === '\\') {
              tail++
            }
            tail++
          }

          // Skip trailing quote char if one was there.
          if (text[tail] === quote) {
            tail++
          }

          break
        }
        case 'd':
        case 'D': {
          haveContent = true

          // Possible start of the keyword DELIMITER. Must be at the start of the text or a character,
          // which is not part of a regular MySQL identifier (0-9, A-Z, a-z, _, $, \u0080-\uffff).
          const previous = tail > start ? tail - 1 : 0
          const isIdentifierChar =
            previous >= 0x80 ||
            (text[previous] >= '0' && text[previous] <= '9') ||
            (text[previous | 0x20] >= 'a' && text[previous | 0x20] <= 'z') ||
            text[previous] === '$' ||
            text[previous] === '_'

          if (tail === start || !isIdentifierChar) {
            let run = tail + 1
            let kw = keywordPos + 1
            let count = 9

            while (count-- > 1 && (run++ | 0x20) === kw++);

            if (count === 0 && text[run] === ' ') {
              // Delimiter keyword found. Get the new delimiter (everything until the end of the line).
              tail = run++
              while (run < end && text[run] !== lineBreak) {
                ++run
              }

              delimiter = text.substring(tail, run - tail).trim()
              delimiterHead = delimiter

              // Skip over the delimiter statement and any following line breaks.
              while (text[run] === lineBreak) {
                ++run
              }
              tail = run
              head = tail
            } else {
              ++tail
            }
          } else {
            ++tail
          }

          break
        }
        default: {
          if (text[tail] > ' ') {
            haveContent = true
          }

          tail++
          break
        }
      }

      if (text[tail] === delimiterHead) {
        // Found possible start of the delimiter. Check if it really is.
        let count = delimiter.length

        if (count === 1) {
          // Most common case. Trim the statement and check if it is not empty before adding the range.
          head = skipLeadingWhitespace(text, head, tail)
          if (head < tail) {
            statements.push({
              text: text.substring(head, tail),
              start: head,
              stop: tail
            })
          }
          head = ++tail
          haveContent = false
        } else {
          let run = tail + 1
          let del = delimiterHead.length + 1

          while (count-- > 1 && text[run++] === text[del++]);

          if (count === 0) {
            // Multi char delimiter is complete. Tail still points to the start of the delimiter.
            // Run points to the first character after the delimiter.
            head = skipLeadingWhitespace(text, head, tail)

            if (head < tail) {
              statements.push({
                text: text.substring(head, tail),
                start: head,
                stop: tail
              })
            }

            tail = run
            head = run
            haveContent = false
          }
        }
      }
    }

    // Add remaining text to the range list.
    head = skipLeadingWhitespace(text, head, tail)

    if (head < tail) {
      statements.push({
        text: text.substring(head, tail),
        start: head,
        stop: tail
      })
    }

    return statements
  }

  /**
   * Get the statement given by the offset.
   *
   * @param statements
   * @param offset
   * @returns Statement | null
   */
  public getStatementAtOffset(statements: Statement[], offset: number): Statement | null {
    for (const statement of statements) {
      if (offset >= statement.start && offset <= statement.stop) {
        return statement
      }
    }

    return null
  }

  /**
   * Check if the provided text is a MySQL keyword.
   *
   * @param text
   * @returns boolean
   */
  public isKeyword(text: string): boolean {
    const keywords = this.getKeywords()
    return keywords.includes(text.toUpperCase())
  }

  /**
   * Check if the provided text is a MySQL reserved keyword.
   *
   * @param text
   * @returns boolean
   */
  public isReservedKeyword(text: string): boolean {
    const reservedKeywords = this.getReservedKeywords()
    return reservedKeywords.includes(text.toUpperCase())
  }

  /**
   * Get all MySQL keywords.
   *
   * @returns string[]
   */
  public getKeywords(): string[] {
    const version = versionToNumber(this.version)
    return keywordsForVersion(version)
  }

  /**
   * Get all MySQL reserved keywords.
   *
   * @returns string[]
   */
  public getReservedKeywords(): string[] {
    const version = versionToNumber(this.version)
    return reservedKeywordsForVersion(version)
  }

  /**
   * Check if the given parse result represents a DDL statement.
   *
   * @param {parseResult}
   * @returns boolean
   */
  public isDDL(parseResult: ParseResult): boolean {
    const queryType = this.getQueryType(parseResult)

    switch (queryType) {
      case MySQLQueryType.QtAlterDatabase:
      case MySQLQueryType.QtAlterLogFileGroup:
      case MySQLQueryType.QtAlterFunction:
      case MySQLQueryType.QtAlterProcedure:
      case MySQLQueryType.QtAlterServer:
      case MySQLQueryType.QtAlterTable:
      case MySQLQueryType.QtAlterTableSpace:
      case MySQLQueryType.QtAlterEvent:
      case MySQLQueryType.QtAlterView:
      case MySQLQueryType.QtCreateTable:
      case MySQLQueryType.QtCreateIndex:
      case MySQLQueryType.QtCreateDatabase:
      case MySQLQueryType.QtCreateEvent:
      case MySQLQueryType.QtCreateView:
      case MySQLQueryType.QtCreateRoutine:
      case MySQLQueryType.QtCreateProcedure:
      case MySQLQueryType.QtCreateFunction:
      case MySQLQueryType.QtCreateUdf:
      case MySQLQueryType.QtCreateTrigger:
      case MySQLQueryType.QtCreateLogFileGroup:
      case MySQLQueryType.QtCreateServer:
      case MySQLQueryType.QtCreateTableSpace:
      case MySQLQueryType.QtDropDatabase:
      case MySQLQueryType.QtDropEvent:
      case MySQLQueryType.QtDropFunction:
      case MySQLQueryType.QtDropProcedure:
      case MySQLQueryType.QtDropIndex:
      case MySQLQueryType.QtDropLogfileGroup:
      case MySQLQueryType.QtDropServer:
      case MySQLQueryType.QtDropTable:
      case MySQLQueryType.QtDropTablespace:
      case MySQLQueryType.QtDropTrigger:
      case MySQLQueryType.QtDropView:
      case MySQLQueryType.QtRenameTable:
      case MySQLQueryType.QtTruncateTable:
        return true
    }
    return false
  }

  /**
   * Get the type of query given by the parse result.
   *
   * @param {parseResult}
   * @returns MySQLQueryType
   */
  getQueryType(parseResult: ParseResult): MySQLQueryType {
    const { lexer } = parseResult
    lexer.reset()

    let token = lexer.nextDefaultChannelToken()
    if (token.type === Token.EOF) {
      return MySQLQueryType.QtUnknown
    }

    switch (token.type) {
      case MySQLLexer.ALTER_SYMBOL:
        token = lexer.nextDefaultChannelToken()

        if (token.type === Token.EOF) {
          return MySQLQueryType.QtAmbiguous
        }

        switch (token.type) {
          case MySQLLexer.DATABASE_SYMBOL:
            return MySQLQueryType.QtAlterDatabase

          case MySQLLexer.LOGFILE_SYMBOL:
            return MySQLQueryType.QtAlterLogFileGroup

          case MySQLLexer.FUNCTION_SYMBOL:
            return MySQLQueryType.QtAlterFunction

          case MySQLLexer.PROCEDURE_SYMBOL:
            return MySQLQueryType.QtAlterProcedure

          case MySQLLexer.SERVER_SYMBOL:
            return MySQLQueryType.QtAlterServer

          case MySQLLexer.TABLE_SYMBOL:
          case MySQLLexer.ONLINE_SYMBOL: // Optional part of ALTER TABLE.
          case MySQLLexer.OFFLINE_SYMBOL: // ditto
          case MySQLLexer.IGNORE_SYMBOL:
            return MySQLQueryType.QtAlterTable

          case MySQLLexer.TABLESPACE_SYMBOL:
            return MySQLQueryType.QtAlterTableSpace

          case MySQLLexer.EVENT_SYMBOL:
            return MySQLQueryType.QtAlterEvent

          case MySQLLexer.VIEW_SYMBOL:
            return MySQLQueryType.QtAlterView

          case MySQLLexer.DEFINER_SYMBOL: // TODO
            return MySQLQueryType.QtAmbiguous

          case MySQLLexer.ALGORITHM_SYMBOL: // Optional part of CREATE VIEW.
            return MySQLQueryType.QtAlterView

          case MySQLLexer.USER_SYMBOL:
            return MySQLQueryType.QtAlterUser
        }
        break

      case MySQLLexer.CREATE_SYMBOL: {
        token = lexer.nextDefaultChannelToken()

        if (token.type === Token.EOF) {
          return MySQLQueryType.QtAmbiguous
        }

        switch (token.type) {
          case MySQLLexer.TEMPORARY_SYMBOL: // Optional part of CREATE TABLE.
          case MySQLLexer.TABLE_SYMBOL:
            return MySQLQueryType.QtCreateTable

          case MySQLLexer.ONLINE_SYMBOL:
          case MySQLLexer.OFFLINE_SYMBOL:
          case MySQLLexer.INDEX_SYMBOL:
          case MySQLLexer.UNIQUE_SYMBOL:
          case MySQLLexer.FULLTEXT_SYMBOL:
          case MySQLLexer.SPATIAL_SYMBOL:
            return MySQLQueryType.QtCreateIndex

          case MySQLLexer.DATABASE_SYMBOL:
            return MySQLQueryType.QtCreateDatabase

          case MySQLLexer.TRIGGER_SYMBOL:
            return MySQLQueryType.QtCreateTrigger

          case MySQLLexer.DEFINER_SYMBOL: // TODO
            return MySQLQueryType.QtAmbiguous

          case MySQLLexer.VIEW_SYMBOL:
          case MySQLLexer.OR_SYMBOL: // CREATE OR REPLACE ... VIEW
          case MySQLLexer.ALGORITHM_SYMBOL: // CREATE ALGORITHM ... VIEW
            return MySQLQueryType.QtCreateView

          case MySQLLexer.EVENT_SYMBOL:
            return MySQLQueryType.QtCreateEvent

          case MySQLLexer.FUNCTION_SYMBOL:
            return MySQLQueryType.QtCreateFunction

          case MySQLLexer.AGGREGATE_SYMBOL:
            return MySQLQueryType.QtCreateUdf

          case MySQLLexer.PROCEDURE_SYMBOL:
            return MySQLQueryType.QtCreateProcedure

          case MySQLLexer.LOGFILE_SYMBOL:
            return MySQLQueryType.QtCreateLogFileGroup

          case MySQLLexer.SERVER_SYMBOL:
            return MySQLQueryType.QtCreateServer

          case MySQLLexer.TABLESPACE_SYMBOL:
            return MySQLQueryType.QtCreateTableSpace

          case MySQLLexer.USER_SYMBOL:
            return MySQLQueryType.QtCreateUser
        }
        break
      }

      case MySQLLexer.DROP_SYMBOL: {
        token = lexer.nextDefaultChannelToken()

        if (token.type === Token.EOF) {
          return MySQLQueryType.QtAmbiguous
        }

        switch (token.type) {
          case MySQLLexer.DATABASE_SYMBOL:
            return MySQLQueryType.QtDropDatabase

          case MySQLLexer.EVENT_SYMBOL:
            return MySQLQueryType.QtDropEvent

          case MySQLLexer.PROCEDURE_SYMBOL:
            return MySQLQueryType.QtDropProcedure

          case MySQLLexer.FUNCTION_SYMBOL:
            return MySQLQueryType.QtDropFunction

          case MySQLLexer.ONLINE_SYMBOL:
          case MySQLLexer.OFFLINE_SYMBOL:
          case MySQLLexer.INDEX_SYMBOL:
            return MySQLQueryType.QtDropIndex

          case MySQLLexer.LOGFILE_SYMBOL:
            return MySQLQueryType.QtDropLogfileGroup

          case MySQLLexer.SERVER_SYMBOL:
            return MySQLQueryType.QtDropServer

          case MySQLLexer.TEMPORARY_SYMBOL:
          case MySQLLexer.TABLE_SYMBOL:
          case MySQLLexer.TABLES_SYMBOL:
            return MySQLQueryType.QtDropTable

          case MySQLLexer.TABLESPACE_SYMBOL:
            return MySQLQueryType.QtDropTablespace

          case MySQLLexer.TRIGGER_SYMBOL:
            return MySQLQueryType.QtDropTrigger

          case MySQLLexer.VIEW_SYMBOL:
            return MySQLQueryType.QtDropView

          case MySQLLexer.PREPARE_SYMBOL:
            return MySQLQueryType.QtDeallocate

          case MySQLLexer.USER_SYMBOL:
            return MySQLQueryType.QtDropUser
        }
        break
      }

      case MySQLLexer.TRUNCATE_SYMBOL:
        return MySQLQueryType.QtTruncateTable

      case MySQLLexer.CALL_SYMBOL:
        return MySQLQueryType.QtCall

      case MySQLLexer.DELETE_SYMBOL:
        return MySQLQueryType.QtDelete

      case MySQLLexer.DO_SYMBOL:
        return MySQLQueryType.QtDo

      case MySQLLexer.HANDLER_SYMBOL:
        return MySQLQueryType.QtHandler

      case MySQLLexer.INSERT_SYMBOL:
        return MySQLQueryType.QtInsert

      case MySQLLexer.LOAD_SYMBOL: {
        token = lexer.nextDefaultChannelToken()

        if (token.type === Token.EOF) {
          return MySQLQueryType.QtAmbiguous
        }

        switch (token.type) {
          case MySQLLexer.DATA_SYMBOL: {
            token = lexer.nextDefaultChannelToken()

            if (token.type === Token.EOF) {
              return MySQLQueryType.QtAmbiguous
            }

            if (token.type === MySQLLexer.FROM_SYMBOL) {
              return MySQLQueryType.QtLoadDataMaster
            }

            return MySQLQueryType.QtLoadData
          }
          case MySQLLexer.XML_SYMBOL:
            return MySQLQueryType.QtLoadXML

          case MySQLLexer.TABLE_SYMBOL:
            return MySQLQueryType.QtLoadTableMaster

          case MySQLLexer.INDEX_SYMBOL:
            return MySQLQueryType.QtLoadIndex
        }
        break
      }

      case MySQLLexer.REPLACE_SYMBOL:
        return MySQLQueryType.QtReplace

      case MySQLLexer.SELECT_SYMBOL:
        return MySQLQueryType.QtSelect

      case MySQLLexer.UPDATE_SYMBOL:
        return MySQLQueryType.QtUpdate

      case MySQLLexer.OPEN_PAR_SYMBOL: {
        // Either (((select ..))) or (partition...)
        while (token.type === MySQLLexer.OPEN_PAR_SYMBOL) {
          token = lexer.nextDefaultChannelToken()

          if (token.type === Token.EOF) {
            return MySQLQueryType.QtAmbiguous
          }
        }

        if (token.type === MySQLLexer.SELECT_SYMBOL) {
          return MySQLQueryType.QtSelect
        }

        return MySQLQueryType.QtPartition
      }

      case MySQLLexer.PARTITION_SYMBOL:
      case MySQLLexer.PARTITIONS_SYMBOL:
        return MySQLQueryType.QtPartition

      case MySQLLexer.START_SYMBOL: {
        token = lexer.nextDefaultChannelToken()

        if (token.type === Token.EOF) {
          return MySQLQueryType.QtAmbiguous
        }

        if (token.type === MySQLLexer.TRANSACTION_SYMBOL) {
          return MySQLQueryType.QtStartTransaction
        }

        return MySQLQueryType.QtStartSlave
      }

      case MySQLLexer.BEGIN_SYMBOL: // Begin directly at the start of the query must be a transaction start.
        return MySQLQueryType.QtBeginWork

      case MySQLLexer.COMMIT_SYMBOL:
        return MySQLQueryType.QtCommit

      case MySQLLexer.ROLLBACK_SYMBOL: {
        // We assume a transaction statement here unless we exactly know it's about a savepoint.
        token = lexer.nextDefaultChannelToken()
        if (token.type === Token.EOF) {
          return MySQLQueryType.QtRollbackWork
        }

        if (token.type === MySQLLexer.WORK_SYMBOL) {
          token = lexer.nextDefaultChannelToken()
          if (token.type === Token.EOF) {
            return MySQLQueryType.QtRollbackWork
          }
        }

        if (token.type === MySQLLexer.TO_SYMBOL) {
          return MySQLQueryType.QtRollbackSavepoint
        }

        return MySQLQueryType.QtRollbackWork
      }

      case MySQLLexer.SET_SYMBOL: {
        token = lexer.nextDefaultChannelToken()
        if (token.type === Token.EOF) {
          return MySQLQueryType.QtSet
        }

        switch (token.type) {
          case MySQLLexer.PASSWORD_SYMBOL:
            return MySQLQueryType.QtSetPassword

          case MySQLLexer.GLOBAL_SYMBOL:
          case MySQLLexer.LOCAL_SYMBOL:
          case MySQLLexer.SESSION_SYMBOL:
            token = lexer.nextDefaultChannelToken()
            if (token.type === Token.EOF) {
              return MySQLQueryType.QtSet
            }
            break

          case MySQLLexer.IDENTIFIER: {
            if (token.text?.toLowerCase() === 'autocommit') {
              return MySQLQueryType.QtSetAutoCommit
            }
            break
          }
        }

        if (token.type === MySQLLexer.TRANSACTION_SYMBOL) {
          return MySQLQueryType.QtSetTransaction
        }

        return MySQLQueryType.QtSet
      }

      case MySQLLexer.SAVEPOINT_SYMBOL:
        return MySQLQueryType.QtSavepoint

      case MySQLLexer.RELEASE_SYMBOL: // Release at the start of the query, obviously.
        return MySQLQueryType.QtReleaseSavepoint

      case MySQLLexer.LOCK_SYMBOL:
        return MySQLQueryType.QtLock

      case MySQLLexer.UNLOCK_SYMBOL:
        return MySQLQueryType.QtUnlock

      case MySQLLexer.XA_SYMBOL:
        return MySQLQueryType.QtXA

      case MySQLLexer.PURGE_SYMBOL:
        return MySQLQueryType.QtPurge

      case MySQLLexer.CHANGE_SYMBOL:
        return MySQLQueryType.QtChangeMaster

      case MySQLLexer.RESET_SYMBOL: {
        token = lexer.nextDefaultChannelToken()

        if (token.type === Token.EOF) {
          return MySQLQueryType.QtReset
        }

        switch (token.type) {
          case MySQLLexer.SERVER_SYMBOL:
            return MySQLQueryType.QtResetMaster
          case MySQLLexer.SLAVE_SYMBOL:
            return MySQLQueryType.QtResetSlave
          default:
            return MySQLQueryType.QtReset
        }
      }

      case MySQLLexer.STOP_SYMBOL:
        return MySQLQueryType.QtStopSlave

      case MySQLLexer.PREPARE_SYMBOL:
        return MySQLQueryType.QtPrepare

      case MySQLLexer.EXECUTE_SYMBOL:
        return MySQLQueryType.QtExecute

      case MySQLLexer.DEALLOCATE_SYMBOL:
        return MySQLQueryType.QtDeallocate

      case MySQLLexer.GRANT_SYMBOL: {
        token = lexer.nextDefaultChannelToken()

        if (token.type === Token.EOF) {
          return MySQLQueryType.QtAmbiguous
        }

        if (token.type === MySQLLexer.PROXY_SYMBOL) {
          return MySQLQueryType.QtGrantProxy
        }

        return MySQLQueryType.QtGrant
      }

      case MySQLLexer.RENAME_SYMBOL: {
        token = lexer.nextDefaultChannelToken()

        if (token.type === Token.EOF) {
          return MySQLQueryType.QtAmbiguous
        }

        if (token.type === MySQLLexer.USER_SYMBOL) {
          return MySQLQueryType.QtRenameUser
        }

        return MySQLQueryType.QtRenameTable
      }

      case MySQLLexer.REVOKE_SYMBOL: {
        token = lexer.nextDefaultChannelToken()

        if (token.type === Token.EOF) {
          return MySQLQueryType.QtAmbiguous
        }

        if (token.type === MySQLLexer.PROXY_SYMBOL) {
          return MySQLQueryType.QtRevokeProxy
        }

        return MySQLQueryType.QtRevoke
      }

      case MySQLLexer.ANALYZE_SYMBOL:
        return MySQLQueryType.QtAnalyzeTable

      case MySQLLexer.CHECK_SYMBOL:
        return MySQLQueryType.QtCheckTable

      case MySQLLexer.CHECKSUM_SYMBOL:
        return MySQLQueryType.QtChecksumTable

      case MySQLLexer.OPTIMIZE_SYMBOL:
        return MySQLQueryType.QtOptimizeTable

      case MySQLLexer.REPAIR_SYMBOL:
        return MySQLQueryType.QtRepairTable

      case MySQLLexer.BACKUP_SYMBOL:
        return MySQLQueryType.QtBackUpTable

      case MySQLLexer.RESTORE_SYMBOL:
        return MySQLQueryType.QtRestoreTable

      case MySQLLexer.INSTALL_SYMBOL:
        return MySQLQueryType.QtInstallPlugin

      case MySQLLexer.UNINSTALL_SYMBOL:
        return MySQLQueryType.QtUninstallPlugin

      case MySQLLexer.SHOW_SYMBOL: {
        token = lexer.nextDefaultChannelToken()

        if (token.type === Token.EOF) {
          return MySQLQueryType.QtShow
        }

        if (token.type === MySQLLexer.FULL_SYMBOL) {
          // Not all SHOW cases allow an optional FULL keyword, but this is not about checking for
          // a valid query but to find the most likely type.
          token = lexer.nextDefaultChannelToken()

          if (token.type === Token.EOF) {
            return MySQLQueryType.QtShow
          }
        }

        switch (token.type) {
          case MySQLLexer.GLOBAL_SYMBOL:
          case MySQLLexer.LOCK_SYMBOL:
          case MySQLLexer.SESSION_SYMBOL: {
            token = lexer.nextDefaultChannelToken()

            if (token.type === Token.EOF) {
              return MySQLQueryType.QtShow
            }

            if (token.type === MySQLLexer.STATUS_SYMBOL) {
              return MySQLQueryType.QtShowStatus
            }

            return MySQLQueryType.QtShowVariables
          }

          case MySQLLexer.AUTHORS_SYMBOL:
            return MySQLQueryType.QtShowAuthors

          case MySQLLexer.BINARY_SYMBOL:
            return MySQLQueryType.QtShowBinaryLogs

          case MySQLLexer.BINLOG_SYMBOL:
            return MySQLQueryType.QtShowBinlogEvents

          case MySQLLexer.RELAYLOG_SYMBOL:
            return MySQLQueryType.QtShowRelaylogEvents

          case MySQLLexer.CHAR_SYMBOL:
            return MySQLQueryType.QtShowCharset

          case MySQLLexer.COLLATION_SYMBOL:
            return MySQLQueryType.QtShowCollation

          case MySQLLexer.COLUMNS_SYMBOL:
            return MySQLQueryType.QtShowColumns

          case MySQLLexer.CONTRIBUTORS_SYMBOL:
            return MySQLQueryType.QtShowContributors

          case MySQLLexer.COUNT_SYMBOL: {
            token = lexer.nextDefaultChannelToken()
            if (token.type != MySQLLexer.OPEN_PAR_SYMBOL) {
              return MySQLQueryType.QtShow
            }

            token = lexer.nextDefaultChannelToken()
            if (token.type != MySQLLexer.MULT_OPERATOR) {
              return MySQLQueryType.QtShow
            }

            token = lexer.nextDefaultChannelToken()
            if (token.type != MySQLLexer.CLOSE_PAR_SYMBOL) {
              return MySQLQueryType.QtShow
            }

            token = lexer.nextDefaultChannelToken()
            if (token.type === Token.EOF) {
              return MySQLQueryType.QtShow
            }

            switch (token.type) {
              case MySQLLexer.WARNINGS_SYMBOL:
                return MySQLQueryType.QtShowWarnings

              case MySQLLexer.ERRORS_SYMBOL:
                return MySQLQueryType.QtShowErrors
            }

            return MySQLQueryType.QtShow
          }

          case MySQLLexer.CREATE_SYMBOL: {
            token = lexer.nextDefaultChannelToken()
            if (token.type === Token.EOF) {
              return MySQLQueryType.QtShow
            }

            switch (token.type) {
              case MySQLLexer.DATABASE_SYMBOL:
                return MySQLQueryType.QtShowCreateDatabase

              case MySQLLexer.EVENT_SYMBOL:
                return MySQLQueryType.QtShowCreateEvent

              case MySQLLexer.FUNCTION_SYMBOL:
                return MySQLQueryType.QtShowCreateFunction

              case MySQLLexer.PROCEDURE_SYMBOL:
                return MySQLQueryType.QtShowCreateProcedure

              case MySQLLexer.TABLE_SYMBOL:
                return MySQLQueryType.QtShowCreateTable

              case MySQLLexer.TRIGGER_SYMBOL:
                return MySQLQueryType.QtShowCreateTrigger

              case MySQLLexer.VIEW_SYMBOL:
                return MySQLQueryType.QtShowCreateView
            }

            return MySQLQueryType.QtShow
          }

          case MySQLLexer.DATABASES_SYMBOL:
            return MySQLQueryType.QtShowDatabases

          case MySQLLexer.ENGINE_SYMBOL:
            return MySQLQueryType.QtShowEngineStatus

          case MySQLLexer.STORAGE_SYMBOL:
          case MySQLLexer.ENGINES_SYMBOL:
            return MySQLQueryType.QtShowStorageEngines

          case MySQLLexer.ERRORS_SYMBOL:
            return MySQLQueryType.QtShowErrors

          case MySQLLexer.EVENTS_SYMBOL:
            return MySQLQueryType.QtShowEvents

          case MySQLLexer.FUNCTION_SYMBOL: {
            token = lexer.nextDefaultChannelToken()

            if (token.type === Token.EOF) {
              return MySQLQueryType.QtAmbiguous
            }

            if (token.type === MySQLLexer.CODE_SYMBOL) {
              return MySQLQueryType.QtShowFunctionCode
            }

            return MySQLQueryType.QtShowFunctionStatus
          }

          case MySQLLexer.GRANT_SYMBOL:
            return MySQLQueryType.QtShowGrants

          case MySQLLexer.INDEX_SYMBOL:
          case MySQLLexer.INDEXES_SYMBOL:
          case MySQLLexer.KEY_SYMBOL:
            return MySQLQueryType.QtShowIndexes

          case MySQLLexer.INNODB_SYMBOL:
            return MySQLQueryType.QtShowInnoDBStatus

          case MySQLLexer.MASTER_SYMBOL:
            return MySQLQueryType.QtShowMasterStatus

          case MySQLLexer.OPEN_SYMBOL:
            return MySQLQueryType.QtShowOpenTables

          case MySQLLexer.PLUGIN_SYMBOL:
          case MySQLLexer.PLUGINS_SYMBOL:
            return MySQLQueryType.QtShowPlugins

          case MySQLLexer.PROCEDURE_SYMBOL: {
            token = lexer.nextDefaultChannelToken()

            if (token.type === Token.EOF) {
              return MySQLQueryType.QtShow
            }

            if (token.type === MySQLLexer.STATUS_SYMBOL) {
              return MySQLQueryType.QtShowProcedureStatus
            }

            return MySQLQueryType.QtShowProcedureCode
          }

          case MySQLLexer.PRIVILEGES_SYMBOL:
            return MySQLQueryType.QtShowPrivileges

          case MySQLLexer.PROCESSLIST_SYMBOL:
            return MySQLQueryType.QtShowProcessList

          case MySQLLexer.PROFILE_SYMBOL:
            return MySQLQueryType.QtShowProfile

          case MySQLLexer.PROFILES_SYMBOL:
            return MySQLQueryType.QtShowProfiles

          case MySQLLexer.SLAVE_SYMBOL: {
            token = lexer.nextDefaultChannelToken()

            if (token.type === Token.EOF) {
              return MySQLQueryType.QtAmbiguous
            }

            if (token.type === MySQLLexer.HOSTS_SYMBOL) {
              return MySQLQueryType.QtShowSlaveHosts
            }

            return MySQLQueryType.QtShowSlaveStatus
          }

          case MySQLLexer.STATUS_SYMBOL:
            return MySQLQueryType.QtShowStatus

          case MySQLLexer.VARIABLES_SYMBOL:
            return MySQLQueryType.QtShowVariables

          case MySQLLexer.TABLE_SYMBOL:
            return MySQLQueryType.QtShowTableStatus

          case MySQLLexer.TABLES_SYMBOL:
            return MySQLQueryType.QtShowTables

          case MySQLLexer.TRIGGERS_SYMBOL:
            return MySQLQueryType.QtShowTriggers

          case MySQLLexer.WARNINGS_SYMBOL:
            return MySQLQueryType.QtShowWarnings
        }

        return MySQLQueryType.QtShow
      }

      case MySQLLexer.CACHE_SYMBOL:
        return MySQLQueryType.QtCacheIndex

      case MySQLLexer.FLUSH_SYMBOL:
        return MySQLQueryType.QtFlush

      case MySQLLexer.KILL_SYMBOL:
        return MySQLQueryType.QtKill

      case MySQLLexer.DESCRIBE_SYMBOL: // EXPLAIN is converted to DESCRIBE in the lexer.
      case MySQLLexer.DESC_SYMBOL: {
        token = lexer.nextDefaultChannelToken()

        if (token.type === Token.EOF) {
          return MySQLQueryType.QtAmbiguous
        }

        if (this.isIdentifier(parseResult, token.type) || token.type === MySQLLexer.DOT_SYMBOL) {
          return MySQLQueryType.QtExplainTable
        }

        // EXTENDED is a bit special as it can be both, a table identifier or the keyword.
        if (token.type === MySQLLexer.EXTENDED_SYMBOL) {
          token = lexer.nextDefaultChannelToken()

          if (token.type === Token.EOF) {
            return MySQLQueryType.QtExplainTable
          }

          switch (token.type) {
            case MySQLLexer.DELETE_SYMBOL:
            case MySQLLexer.INSERT_SYMBOL:
            case MySQLLexer.REPLACE_SYMBOL:
            case MySQLLexer.UPDATE_SYMBOL:
              return MySQLQueryType.QtExplainStatement
            default:
              return MySQLQueryType.QtExplainTable
          }
        }

        return MySQLQueryType.QtExplainStatement
      }

      case MySQLLexer.HELP_SYMBOL:
        return MySQLQueryType.QtHelp

      case MySQLLexer.USE_SYMBOL:
        return MySQLQueryType.QtUse
    }

    return MySQLQueryType.QtUnknown
  }

  /**
   * Check if the given `type` represents an identifier.
   *
   * @param {parseResult}
   * @param {type}
   * @returns boolean
   */
  public isIdentifier(parseResult: ParseResult, type: number): boolean {
    if (type === MySQLLexer.IDENTIFIER || type === MySQLLexer.BACK_TICK_QUOTED_ID) {
      return true
    }

    const symbol = parseResult.lexer.vocabulary.getSymbolicName(type)
    if (symbol && !this.isReservedKeyword(symbol)) {
      return true
    }

    return false
  }
}
