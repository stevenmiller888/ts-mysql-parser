# ts-mysql-parser

![Alt Text](https://github.com/stevenmiller888/ts-mysql-parser/workflows/CI/badge.svg)

> A standalone, grammar-complete MySQL parser.

![Alt Text](https://github.com/stevenmiller888/ts-mysql-parser/raw/master/.github/code.png)

## Features

- Covers 100% of the MySQL grammar
- Supports all versions of MySQL
- Supports multiple statements
- Supports MySQL mode and character sets
- Custom lexer and parser listeners

## Installation

```shell
yarn add ts-mysql-parser
# or
npm install ts-mysql-parser
```

## Usage

```typescript
import MySQLParser, { SqlMode, MySQLQueryType } from 'ts-mysql-parser'

const parser = new MySQLParser({
  version: '5.7.7',
  mode: SqlMode.AnsiQuotes
})

const result = parser.parse('SELECT id FROM users')

const queryType = parser.getQueryType(result)
console.log(queryType === MySQLQueryType.QtSelect) // true

const tableRef = parser.getNodeAtOffset(result, 18)
console.log(tableRef) // table 'users'

const columnRef = parser.getNodeAtOffset(result, 7)
console.log(columnRef) // column 'id'
```

## API

### new MySQLParser(options)

Create a new instance of MySQLParser.

The available options are:

- `version`: the MySQL server version (e.g. `'5.7.7'`)
- `mode`: the MySQL server [mode](https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html) to run in (e.g. `SqlMode.AnsiQuotes`)
- `charsets`: the MySQL server [character sets](https://dev.mysql.com/doc/refman/8.0/en/charset-configuration.html) to support (e.g. `[ '_utf8' ]`)

#### .parse()

Parse a query.

```typescript
parser.parse('SELECT id FROM users')
```

#### .getQueryType()

Get the query type of the statement.

```typescript
const result = parser.parse('SELECT id FROM users')
const queryType = parser.getQueryType(parseResult)
console.log(queryType === MySQLQueryType.QtSelect) // true
```

#### .getNodeAtOffset()

Get a node in the parse tree at the given offset.

```typescript
const result = parser.parse('SELECT id FROM users')
const node = parser.getNodeAtOffset(parseResult, 18)
console.log(node) // "users" table
```

#### .splitStatements()

Split the text into multiple statements, optionally specifying the line break and delimiter.

```typescript
parser.splitStatements(`SELECT * from users; SELECT * FROM posts`, '\n', ';')
```

#### .getStatementAtOffset()

Get the MySQL statement at the given offset.

```typescript
const statements = parser.splitStatements(`SELECT * from users; SELECT * FROM posts`, '\n', ';')
const statement = parser.getStatementAtOffset(statements, 30)
console.log(statement) // SELECT * FROM posts
```

#### .isKeyword()

Check if the given text is a MySQL keyword.

```typescript
parser.isKeyword('TIME') // true
```

#### .isReservedKeyword()

Check if the given text is a MySQL reserved keyword.

```typescript
parser.isReservedKeyword('TIME') // false
```

## Using Custom Listeners

You can use your own custom listeners to hook into the parse tree. See `examples/custom-parser-listener.ts` for an example of how to do this.

## Development

When the MySQL grammar changes, we merge in updates to the grammar files, and re-build the lexer and parser by running:

```shell
$ yarn build-parser
```

Afterwards, we need to add the following to the top of `src/grammar/MySQLLexer.ts`, `src/grammar/MySQLParser.ts`, and `src/grammar/MySQLParserListener.ts`:

```typescript
/* eslint-disable */
// @ts-nocheck
```

## Architecture

This project is built on [Antlr4](https://github.com/antlr/antlr4) with the MySQL grammar extracted from MySQL workbench. The grammar itself was kept mostly unchanged, aside from Typescript-specific rule predicates. This allows for easy updating as new versions of MySQL are released.

The `MySQLBaseLexer` class represents a superclass to the lexer class and customizes lexer functionality, such as emitting multiple tokens per rule. Similarly, the `MySQLBaseParser` class represents a superclass to the parser class and customizes parser functionality. These superclasses allow us to change the MySQL version, mode, and character sets at runtime.

## Related

- [ts-antlr4-scanner](https://github.com/stevenmiller888/ts-antlr4-scanner) - A scanner for antlr4-based lexers
- [ts-mysql-analyzer](https://github.com/stevenmiller888/ts-mysql-analyzer) - A MySQL query analyzer
- [ts-mysql-schema](https://github.com/stevenmiller888/ts-mysql-schema) - A schema extractor for MySQL
- [ts-mysql-uri](https://github.com/stevenmiller888/ts-mysql-uri) - Parse a MySQL connection URI

## License

[MIT](https://tldrlegal.com/license/mit-license)

---

> [stevenmiller888.github.io](https://stevenmiller888.github.io) &nbsp;&middot;&nbsp;
> GitHub [@stevenmiller888](https://github.com/stevenmiller888) &nbsp;&middot;&nbsp;
> Twitter [@stevenmiller888](https://twitter.com/stevenmiller888)
