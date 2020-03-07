import {
  ANTLRErrorListener,
  FailedPredicateException,
  InputMismatchException,
  NoViableAltException,
  RecognitionException,
  Token,
  Recognizer
} from 'antlr4ts'
import { ParserError } from './errors'
import { ATNSimulator } from 'antlr4ts/atn/ATNSimulator'
import { intervalToArray } from '../lib/interval-to-array'

function getErrorMessage(
  error: RecognitionException | undefined,
  message: string,
  expectedTokens: string[],
  offendingToken: Token
): string {
  let wrongText = offendingToken.text || ''
  if (!wrongText.startsWith('"') && !wrongText.startsWith("'") && !wrongText.startsWith('`')) {
    wrongText = '"' + wrongText + '"'
  }

  // only show 6 tokens in error message
  const expectedText = expectedTokens.slice(0, 5).join(', ')
  const isEof = offendingToken.type === Token.EOF

  if (!error) {
    if (message.includes('missing') && expectedTokens.length === 1) {
      return `Missing ${expectedText}`
    } else {
      return `Extraneous input ${wrongText} found, expecting ${expectedText}`
    }
  } else {
    if (error instanceof InputMismatchException || error instanceof NoViableAltException) {
      if (isEof) {
        return 'Statement is incomplete'
      } else {
        return `${wrongText} is not valid at this position`
      }
    }

    if (error instanceof FailedPredicateException) {
      // TODO
    }
  }

  return message
}

export class ParserErrorListener implements ANTLRErrorListener<Token> {
  error: ParserError | undefined

  syntaxError<T extends Token>(
    recognizer: Recognizer<T, ATNSimulator>,
    offendingToken: T | undefined,
    line: number,
    character: number,
    message: string,
    error: RecognitionException | undefined
  ): void {
    // offendingToken is only undefined for lexer error listeners, so its safe to return here
    if (!offendingToken) {
      return
    }

    const expected = recognizer.atn.getExpectedTokens(recognizer.state, error?.context)
    const expectedTokens = intervalToArray(expected, recognizer.vocabulary)
    const errorMessage = getErrorMessage(error, message, expectedTokens, offendingToken)

    this.error = new ParserError(errorMessage, {
      offendingToken: offendingToken ?? null,
      expectedTokens,
      character,
      line
    })
  }
}
