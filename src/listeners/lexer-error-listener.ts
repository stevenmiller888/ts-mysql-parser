import { ANTLRErrorListener } from 'antlr4ts'
import { LexerError } from './errors'
import { MySQLLexer } from '../grammar/MySQLLexer'
import { Interval } from 'antlr4ts/misc/Interval'

export class LexerErrorListener implements ANTLRErrorListener<null> {
  error?: LexerError
  lexer: MySQLLexer

  constructor(lexer: MySQLLexer) {
    this.lexer = lexer
  }

  syntaxError<T>(
    // eslint-disable-next-line
    // @ts-ignore
    _,
    offendingToken: T | undefined,
    line: number,
    character: number,
    message: string
  ): void {
    // offendingToken is only defined for parser error listeners, so its safe to return here
    if (offendingToken) {
      return
    }

    const input = this.lexer.inputStream
    const interval = new Interval(this.lexer._tokenStartCharIndex, input.index)
    const text = this.lexer.getErrorDisplay(input.getText(interval)) || ' '

    switch (text[0]) {
      case '/':
        message = 'Unfinished multiline comment'
        break
      case '"':
        message = 'Unfinished double quoted string literal'
        break
      case "'":
        message = 'Unfinished single quoted string literal'
        break
      case '`':
        message = 'Unfinished back tick quoted string literal'
        break
      default:
        // Hex or bin string?
        if (text.length > 1 && text[1] === "'" && (text.startsWith('x') || text.startsWith('b'))) {
          message = 'Unfinished ' + (text.startsWith('x') ? 'hex' : 'binary') + ' string literal'
        } else {
          // Something else the lexer couldn't make sense of (likely there is no rule that accepts this input).
          message = '"' + text + '" is no valid input at all'
        }
    }

    const data = {
      offset: input.index,
      position: {
        character,
        line
      }
    }

    this.error = new LexerError(message, data)
  }
}
