import MySQLParser from '../src'

const parser = new MySQLParser()

// Lexer error
const result1 = parser.parse(`"`)
console.log(result1.lexerError)

// Parser error
const result2 = parser.parse(`SELCT id FROM users`)
console.log(result2.parserError)
