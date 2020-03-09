import MySQLParser, { SqlMode } from '../src'

new MySQLParser({
  mode: SqlMode.AnsiQuotes
})
