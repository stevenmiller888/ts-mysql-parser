import MySQLParser from '../src'

const parser = new MySQLParser()

const statements = parser.splitStatements(`SELECT * FROM users; SELECT * FROM posts;`)

for (const statement of statements) {
  const result = parser.parse(statement.text)
  console.log(result)
}

const statement = parser.getStatementAtOffset(statements, 30)
console.log(statement)
