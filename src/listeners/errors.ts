import { Token } from 'antlr4ts'

class ListenerError extends Error {
  name: string
  code: number

  constructor() {
    super()

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ListenerError)
    }

    this.name = 'ListenerError'
    this.code = 1000
  }
}

export interface LexerErrorData {
  offset?: number
  position: {
    character: number
    line: number
  }
}

export class LexerError extends ListenerError {
  data: LexerErrorData

  constructor(message: string, data: LexerErrorData) {
    super()
    this.name = 'LexerError'
    this.message = message
    this.data = data
    this.code = 1001
  }
}

export interface ParserErrorData {
  expectedTokens: string[]
  offendingToken: Token | null
  character: number
  line: number
}

export class ParserError extends ListenerError {
  data: ParserErrorData

  constructor(message: string, data: ParserErrorData) {
    super()
    this.name = 'ParserError'
    this.message = message
    this.data = data
    this.code = 1002
  }
}
