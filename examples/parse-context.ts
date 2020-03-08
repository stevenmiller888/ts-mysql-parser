import MySQLParser, { RuleName } from '../src'

const parser = new MySQLParser()
const result = parser.parse(`FROM users`, RuleName.fromClause)
console.log(result)
