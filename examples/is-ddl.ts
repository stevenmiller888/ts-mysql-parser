import MySQLParser from '../src'

const parser = new MySQLParser()

const result = parser.parse(`SELECT id FROM users`)

const isDDL = parser.isDDL(result)
console.log(isDDL) // false
