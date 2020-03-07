import MySQLParser from '../src'

const parser = new MySQLParser()
const result = parser.parse(`SELECT id FROM users`)
console.log(result)
