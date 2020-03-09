import MySQLParser from '../src'

// "CREATE ROLE" was added in MySQL 8.0.0
const query = 'CREATE ROLE app_developer'

const parser1 = new MySQLParser({
  version: '5.7.0'
})

const result1 = parser1.parse(query)
console.log(result1.parserError) // parser error for 5.7.0

const parser2 = new MySQLParser({
  version: '8.0.0'
})

const result2 = parser2.parse(query)
console.log(result2.parserError) // no error for 8.0.0
