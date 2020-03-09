import MySQLParser, { MySQLQueryType } from '../src'

const parser = new MySQLParser()

const result = parser.parse(`SELECT id FROM users`)

const queryType = parser.getQueryType(result)
console.log(queryType === MySQLQueryType.QtSelect) // true
