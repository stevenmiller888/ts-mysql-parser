import MySQLParser from '../src'

const parser = new MySQLParser()

const isFromReserved = parser.isReservedKeyword('FROM')
console.log(isFromReserved) // true

const isFooReserved = parser.isReservedKeyword('FOO')
console.log(isFooReserved) // false
