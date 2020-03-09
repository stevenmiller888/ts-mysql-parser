import MySQLParser from '../src'

const parser = new MySQLParser()

const result = parser.parse(`SELECT id FROM users`)

const tableRef = parser.getNodeAtOffset(result, 18)
console.log(tableRef) // table "users"

const columnRef = parser.getNodeAtOffset(result, 7)
console.log(columnRef) // column "id"
