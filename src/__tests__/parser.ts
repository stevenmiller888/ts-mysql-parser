import Parser, { Statement } from '../parser'
import { LexerError } from '../listeners/errors'
import { RuleName } from '../lib/rule-name'
import { SqlMode } from '../'
import path from 'path'
import fs from 'fs'

const charsets = [
  '_utf8',
  '_utf8mb3',
  '_utf8mb4',
  '_ucs2',
  '_big5',
  '_latin2',
  '_ujis',
  '_binary',
  '_cp1250',
  '_latin1'
]
const file = path.join(__dirname, 'statements.txt')
const text = fs.readFileSync(file, 'utf8')
const queries = text

interface VersionMatch {
  isMatch: boolean
  statement: Statement
}

/**
 * Determines if the version info in the statement matches the given version (if there's version info at all).
 * The version info is removed from the statement, if any.
 */
function versionMatches(statement: Statement, serverVersion: number): VersionMatch {
  const versionPattern = /^\[(<|<=|>|>=|=)(\d{5})\]/
  const relationMap: { [relation: string]: number } = {
    '<': 0,
    '<=': 1,
    '=': 2,
    '>=': 3,
    '>': 4
  }

  const matches = versionPattern.exec(statement.text)
  if (matches) {
    const relation = matches[1]
    const targetVersion = Number(matches[2])

    switch (relationMap[relation]) {
      case 0:
        if (serverVersion >= targetVersion) {
          return {
            isMatch: false,
            statement
          }
        }
        break
      case 1:
        if (serverVersion > targetVersion) {
          return {
            isMatch: false,
            statement
          }
        }
        break
      case 2:
        if (serverVersion != targetVersion) {
          return {
            isMatch: false,
            statement
          }
        }
        break
      case 3:
        if (serverVersion < targetVersion) {
          return {
            isMatch: false,
            statement
          }
        }
        break
      case 4:
        if (serverVersion <= targetVersion) {
          return {
            isMatch: false,
            statement
          }
        }
        break
    }

    statement.text = statement.text.replace(versionPattern, '')
  }

  return {
    isMatch: true,
    statement: {
      start: statement.start,
      stop: statement.stop,
      text: statement.text.replace(versionPattern, '')
    }
  }
}

describe('Parser', () => {
  it('is a constructor', () => {
    const parser = new Parser()
    expect(parser).toBeInstanceOf(Parser)
  })

  it('accepts version as an option', () => {
    const parser = new Parser({
      version: '8.0.0'
    })
    expect(parser.version).toBe('8.0.0')
  })

  it('defaults version to 5.7.7', () => {
    const parser = new Parser()
    expect(parser.version).toBe('5.7.7')
  })

  describe('parser.splitStatements()', () => {
    it('splits 2 MySQL statements', () => {
      const parser = new Parser()
      const statements = parser.splitStatements('SELECT * FROM users; SELECT * FROM posts;')
      expect(statements).toMatchObject([
        {
          text: 'SELECT * FROM users',
          start: 0,
          stop: 19
        },
        {
          text: 'SELECT * FROM posts',
          start: 21,
          stop: 40
        }
      ])
    })

    it('works with 1 MySQL statement', () => {
      const parser = new Parser()
      const statements = parser.splitStatements('SELECT * FROM users;')
      expect(statements).toMatchObject([
        {
          text: 'SELECT * FROM users',
          start: 0,
          stop: 19
        }
      ])
    })
  })

  describe('parser.getStatementAtOffset', () => {
    it('gets a MySQL statement at given offset', () => {
      const parser = new Parser()
      const statements = parser.splitStatements('SELECT * FROM users; SELECT * FROM posts;')
      const statement = parser.getStatementAtOffset(statements, 33)
      expect(statement).toMatchObject({
        text: 'SELECT * FROM posts',
        start: 21,
        stop: 40
      })
    })

    it('works with 1 MySQL statement', () => {
      const parser = new Parser()
      const statements = parser.splitStatements('SELECT * FROM users;')
      const statement = parser.getStatementAtOffset(statements, 4)
      expect(statement).toMatchObject({
        text: 'SELECT * FROM users',
        start: 0,
        stop: 19
      })
    })
  })

  describe('parser.isKeyword()', () => {
    it('returns true if given text is a MySQL keyword', () => {
      const parser = new Parser()
      const isKeyword = parser.isKeyword('FROM')
      expect(isKeyword).toBeTruthy()
    })

    it('returns false if given text is not a MySQL keyword', () => {
      const parser = new Parser()
      const isKeyword = parser.isKeyword('FOO')
      expect(isKeyword).toBeFalsy()
    })
  })

  describe('parser.isReservedKeyword()', () => {
    it('returns true if given text is a MySQL reserved keyword', () => {
      const parser = new Parser()
      const isReservedKeyword = parser.isReservedKeyword('DISTINCT')
      expect(isReservedKeyword).toBeTruthy()
    })

    it('returns false if given text is not a MySQL reserved keyword', () => {
      const parser = new Parser()
      const isReservedKeyword = parser.isReservedKeyword('FOO')
      expect(isReservedKeyword).toBeFalsy()
    })

    it('returns false for MySQL keywords that are not reserved', () => {
      const parser = new Parser()
      const isReservedKeyword = parser.isReservedKeyword('ANY')
      expect(isReservedKeyword).toBeFalsy()
    })
  })

  describe('parser.getKeywords()', () => {
    it('returns a list of all keywords', () => {
      const parser = new Parser()
      const keywords = parser.getKeywords()
      expect(keywords).toMatchInlineSnapshot(`
        Array [
          "ACCESSIBLE",
          "ACCOUNT",
          "ACTION",
          "ADD",
          "AFTER",
          "AGAINST",
          "AGGREGATE",
          "ALGORITHM",
          "ALL",
          "ALTER",
          "ALWAYS",
          "ANALYSE",
          "ANALYZE",
          "AND",
          "ANY",
          "AS",
          "ASC",
          "ASCII",
          "ASENSITIVE",
          "AT",
          "AUTOEXTEND_SIZE",
          "AUTO_INCREMENT",
          "AVG",
          "AVG_ROW_LENGTH",
          "BACKUP",
          "BEFORE",
          "BEGIN",
          "BETWEEN",
          "BIGINT",
          "BINARY",
          "BINLOG",
          "BIT",
          "BLOB",
          "BLOCK",
          "BOOL",
          "BOOLEAN",
          "BOTH",
          "BTREE",
          "BY",
          "BYTE",
          "CACHE",
          "CALL",
          "CASCADE",
          "CASCADED",
          "CASE",
          "CATALOG_NAME",
          "CHAIN",
          "CHANGE",
          "CHANGED",
          "CHANNEL",
          "CHAR",
          "CHARACTER",
          "CHARSET",
          "CHECK",
          "CHECKSUM",
          "CIPHER",
          "CLASS_ORIGIN",
          "CLIENT",
          "CLOSE",
          "COALESCE",
          "CODE",
          "COLLATE",
          "COLLATION",
          "COLUMN",
          "COLUMNS",
          "COLUMN_FORMAT",
          "COLUMN_NAME",
          "COMMENT",
          "COMMIT",
          "COMMITTED",
          "COMPACT",
          "COMPLETION",
          "COMPRESSED",
          "COMPRESSION",
          "CONCURRENT",
          "CONDITION",
          "CONNECTION",
          "CONSISTENT",
          "CONSTRAINT",
          "CONSTRAINT_CATALOG",
          "CONSTRAINT_NAME",
          "CONSTRAINT_SCHEMA",
          "CONTAINS",
          "CONTEXT",
          "CONTINUE",
          "CONVERT",
          "CPU",
          "CREATE",
          "CROSS",
          "CUBE",
          "CURRENT",
          "CURRENT_DATE",
          "CURRENT_TIME",
          "CURRENT_TIMESTAMP",
          "CURRENT_USER",
          "CURSOR",
          "CURSOR_NAME",
          "DATA",
          "DATABASE",
          "DATABASES",
          "DATAFILE",
          "DATE",
          "DATETIME",
          "DAY",
          "DAY_HOUR",
          "DAY_MICROSECOND",
          "DAY_MINUTE",
          "DAY_SECOND",
          "DEALLOCATE",
          "DEC",
          "DECIMAL",
          "DECLARE",
          "DEFAULT",
          "DEFAULT_AUTH",
          "DEFINER",
          "DELAYED",
          "DELAY_KEY_WRITE",
          "DELETE",
          "DESC",
          "DESCRIBE",
          "DES_KEY_FILE",
          "DETERMINISTIC",
          "DIAGNOSTICS",
          "DIRECTORY",
          "DISABLE",
          "DISCARD",
          "DISK",
          "DISTINCT",
          "DISTINCTROW",
          "DIV",
          "DO",
          "DOUBLE",
          "DROP",
          "DUAL",
          "DUMPFILE",
          "DUPLICATE",
          "DYNAMIC",
          "EACH",
          "ELSE",
          "ELSEIF",
          "ENABLE",
          "ENCLOSED",
          "ENCRYPTION",
          "END",
          "ENDS",
          "ENGINE",
          "ENGINES",
          "ENUM",
          "ERROR",
          "ERRORS",
          "ESCAPE",
          "ESCAPED",
          "EVENT",
          "EVENTS",
          "EVERY",
          "EXCHANGE",
          "EXECUTE",
          "EXISTS",
          "EXIT",
          "EXPANSION",
          "EXPIRE",
          "EXPLAIN",
          "EXPORT",
          "EXTENDED",
          "EXTENT_SIZE",
          "FALSE",
          "FAST",
          "FAULTS",
          "FETCH",
          "FIELDS",
          "FILE",
          "FILE_BLOCK_SIZE",
          "FILTER",
          "FIRST",
          "FIXED",
          "FLOAT",
          "FLOAT4",
          "FLOAT8",
          "FLUSH",
          "FOLLOWS",
          "FOR",
          "FORCE",
          "FOREIGN",
          "FORMAT",
          "FOUND",
          "FROM",
          "FULL",
          "FULLTEXT",
          "FUNCTION",
          "GENERAL",
          "GENERATED",
          "GEOMETRY",
          "GEOMETRYCOLLECTION",
          "GET",
          "GET_FORMAT",
          "GLOBAL",
          "GRANT",
          "GRANTS",
          "GROUP",
          "GROUP_REPLICATION",
          "HANDLER",
          "HASH",
          "HAVING",
          "HELP",
          "HIGH_PRIORITY",
          "HOST",
          "HOSTS",
          "HOUR",
          "HOUR_MICROSECOND",
          "HOUR_MINUTE",
          "HOUR_SECOND",
          "IDENTIFIED",
          "IF",
          "IGNORE",
          "IGNORE_SERVER_IDS",
          "IMPORT",
          "IN",
          "INDEX",
          "INDEXES",
          "INFILE",
          "INITIAL_SIZE",
          "INNER",
          "INOUT",
          "INSENSITIVE",
          "INSERT",
          "INSERT_METHOD",
          "INSTALL",
          "INSTANCE",
          "INT",
          "INT1",
          "INT2",
          "INT3",
          "INT4",
          "INT8",
          "INTEGER",
          "INTERVAL",
          "INTO",
          "INVOKER",
          "IO",
          "IO_AFTER_GTIDS",
          "IO_BEFORE_GTIDS",
          "IO_THREAD",
          "IPC",
          "IS",
          "ISOLATION",
          "ISSUER",
          "ITERATE",
          "JOIN",
          "JSON",
          "KEY",
          "KEYS",
          "KEY_BLOCK_SIZE",
          "KILL",
          "LANGUAGE",
          "LAST",
          "LEADING",
          "LEAVE",
          "LEAVES",
          "LEFT",
          "LESS",
          "LEVEL",
          "LIKE",
          "LIMIT",
          "LINEAR",
          "LINES",
          "LINESTRING",
          "LIST",
          "LOAD",
          "LOCAL",
          "LOCALTIME",
          "LOCALTIMESTAMP",
          "LOCK",
          "LOCKS",
          "LOGFILE",
          "LOGS",
          "LONG",
          "LONGBLOB",
          "LONGTEXT",
          "LOOP",
          "LOW_PRIORITY",
          "MASTER",
          "MASTER_AUTO_POSITION",
          "MASTER_BIND",
          "MASTER_CONNECT_RETRY",
          "MASTER_DELAY",
          "MASTER_HEARTBEAT_PERIOD",
          "MASTER_HOST",
          "MASTER_LOG_FILE",
          "MASTER_LOG_POS",
          "MASTER_PASSWORD",
          "MASTER_PORT",
          "MASTER_RETRY_COUNT",
          "MASTER_SERVER_ID",
          "MASTER_SSL",
          "MASTER_SSL_CA",
          "MASTER_SSL_CAPATH",
          "MASTER_SSL_CERT",
          "MASTER_SSL_CIPHER",
          "MASTER_SSL_CRL",
          "MASTER_SSL_CRLPATH",
          "MASTER_SSL_KEY",
          "MASTER_SSL_VERIFY_SERVER_CERT",
          "MASTER_TLS_VERSION",
          "MASTER_USER",
          "MATCH",
          "MAXVALUE",
          "MAX_CONNECTIONS_PER_HOUR",
          "MAX_QUERIES_PER_HOUR",
          "MAX_ROWS",
          "MAX_SIZE",
          "MAX_STATEMENT_TIME",
          "MAX_UPDATES_PER_HOUR",
          "MAX_USER_CONNECTIONS",
          "MEDIUM",
          "MEDIUMBLOB",
          "MEDIUMINT",
          "MEDIUMTEXT",
          "MEMORY",
          "MERGE",
          "MESSAGE_TEXT",
          "MICROSECOND",
          "MIDDLEINT",
          "MIGRATE",
          "MINUTE",
          "MINUTE_MICROSECOND",
          "MINUTE_SECOND",
          "MIN_ROWS",
          "MOD",
          "MODE",
          "MODIFIES",
          "MODIFY",
          "MONTH",
          "MULTILINESTRING",
          "MULTIPOINT",
          "MULTIPOLYGON",
          "MUTEX",
          "MYSQL_ERRNO",
          "NAME",
          "NAMES",
          "NATIONAL",
          "NATURAL",
          "NCHAR",
          "NDB",
          "NDBCLUSTER",
          "NEVER",
          "NEW",
          "NEXT",
          "NO",
          "NODEGROUP",
          "NONBLOCKING",
          "NONE",
          "NOT",
          "NO_WAIT",
          "NO_WRITE_TO_BINLOG",
          "NULL",
          "NUMBER",
          "NUMERIC",
          "NVARCHAR",
          "OFFSET",
          "OLD_PASSWORD",
          "ON",
          "ONE",
          "ONLY",
          "OPEN",
          "OPTIMIZE",
          "OPTIMIZER_COSTS",
          "OPTION",
          "OPTIONALLY",
          "OPTIONS",
          "OR",
          "ORDER",
          "OUT",
          "OUTER",
          "OUTFILE",
          "OWNER",
          "PACK_KEYS",
          "PAGE",
          "PARSER",
          "PARSE_GCOL_EXPR",
          "PARTIAL",
          "PARTITION",
          "PARTITIONING",
          "PARTITIONS",
          "PASSWORD",
          "PHASE",
          "PLUGIN",
          "PLUGINS",
          "PLUGIN_DIR",
          "POINT",
          "POLYGON",
          "PORT",
          "PRECEDES",
          "PRECISION",
          "PREPARE",
          "PRESERVE",
          "PREV",
          "PRIMARY",
          "PRIVILEGES",
          "PROCEDURE",
          "PROCESSLIST",
          "PROFILE",
          "PROFILES",
          "PROXY",
          "PURGE",
          "QUARTER",
          "QUERY",
          "QUICK",
          "RANGE",
          "READ",
          "READS",
          "READ_ONLY",
          "READ_WRITE",
          "REAL",
          "REBUILD",
          "RECOVER",
          "REDOFILE",
          "REDO_BUFFER_SIZE",
          "REDUNDANT",
          "REFERENCES",
          "REGEXP",
          "RELAY",
          "RELAYLOG",
          "RELAY_LOG_FILE",
          "RELAY_LOG_POS",
          "RELAY_THREAD",
          "RELEASE",
          "RELOAD",
          "REMOVE",
          "RENAME",
          "REORGANIZE",
          "REPAIR",
          "REPEAT",
          "REPEATABLE",
          "REPLACE",
          "REPLICATE_DO_DB",
          "REPLICATE_DO_TABLE",
          "REPLICATE_IGNORE_DB",
          "REPLICATE_IGNORE_TABLE",
          "REPLICATE_REWRITE_DB",
          "REPLICATE_WILD_DO_TABLE",
          "REPLICATE_WILD_IGNORE_TABLE",
          "REPLICATION",
          "REQUIRE",
          "RESET",
          "RESIGNAL",
          "RESTORE",
          "RESTRICT",
          "RESUME",
          "RETURN",
          "RETURNED_SQLSTATE",
          "RETURNS",
          "REVERSE",
          "REVOKE",
          "RIGHT",
          "RLIKE",
          "ROLLBACK",
          "ROLLUP",
          "ROTATE",
          "ROUTINE",
          "ROW",
          "ROWS",
          "ROW_COUNT",
          "ROW_FORMAT",
          "RTREE",
          "SAVEPOINT",
          "SCHEDULE",
          "SCHEMA",
          "SCHEMAS",
          "SCHEMA_NAME",
          "SECOND",
          "SECOND_MICROSECOND",
          "SECURITY",
          "SELECT",
          "SENSITIVE",
          "SEPARATOR",
          "SERIAL",
          "SERIALIZABLE",
          "SERVER",
          "SESSION",
          "SET",
          "SHARE",
          "SHOW",
          "SHUTDOWN",
          "SIGNAL",
          "SIGNED",
          "SIMPLE",
          "SLAVE",
          "SLOW",
          "SMALLINT",
          "SNAPSHOT",
          "SOCKET",
          "SOME",
          "SONAME",
          "SOUNDS",
          "SOURCE",
          "SPATIAL",
          "SPECIFIC",
          "SQL",
          "SQLEXCEPTION",
          "SQLSTATE",
          "SQLWARNING",
          "SQL_AFTER_GTIDS",
          "SQL_AFTER_MTS_GAPS",
          "SQL_BEFORE_GTIDS",
          "SQL_BIG_RESULT",
          "SQL_BUFFER_RESULT",
          "SQL_CACHE",
          "SQL_CALC_FOUND_ROWS",
          "SQL_NO_CACHE",
          "SQL_SMALL_RESULT",
          "SQL_THREAD",
          "SQL_TSI_DAY",
          "SQL_TSI_HOUR",
          "SQL_TSI_MINUTE",
          "SQL_TSI_MONTH",
          "SQL_TSI_QUARTER",
          "SQL_TSI_SECOND",
          "SQL_TSI_WEEK",
          "SQL_TSI_YEAR",
          "SSL",
          "STACKED",
          "START",
          "STARTING",
          "STARTS",
          "STATS_AUTO_RECALC",
          "STATS_PERSISTENT",
          "STATS_SAMPLE_PAGES",
          "STATUS",
          "STOP",
          "STORAGE",
          "STORED",
          "STRAIGHT_JOIN",
          "STRING",
          "SUBCLASS_ORIGIN",
          "SUBJECT",
          "SUBPARTITION",
          "SUBPARTITIONS",
          "SUPER",
          "SUSPEND",
          "SWAPS",
          "SWITCHES",
          "TABLE",
          "TABLES",
          "TABLESPACE",
          "TABLE_CHECKSUM",
          "TABLE_NAME",
          "TEMPORARY",
          "TEMPTABLE",
          "TERMINATED",
          "TEXT",
          "THAN",
          "THEN",
          "TIME",
          "TIMESTAMP",
          "TIMESTAMPADD",
          "TIMESTAMPDIFF",
          "TINYBLOB",
          "TINYINT",
          "TINYTEXT",
          "TO",
          "TRAILING",
          "TRANSACTION",
          "TRIGGER",
          "TRIGGERS",
          "TRUE",
          "TRUNCATE",
          "TYPE",
          "TYPES",
          "UNCOMMITTED",
          "UNDEFINED",
          "UNDO",
          "UNDOFILE",
          "UNDO_BUFFER_SIZE",
          "UNICODE",
          "UNINSTALL",
          "UNION",
          "UNIQUE",
          "UNKNOWN",
          "UNLOCK",
          "UNSIGNED",
          "UNTIL",
          "UPDATE",
          "UPGRADE",
          "USAGE",
          "USE",
          "USER",
          "USER_RESOURCES",
          "USE_FRM",
          "USING",
          "UTC_DATE",
          "UTC_TIME",
          "UTC_TIMESTAMP",
          "VALIDATION",
          "VALUE",
          "VALUES",
          "VARBINARY",
          "VARCHAR",
          "VARCHARACTER",
          "VARIABLES",
          "VARYING",
          "VIEW",
          "VIRTUAL",
          "WAIT",
          "WARNINGS",
          "WEEK",
          "WEIGHT_STRING",
          "WHEN",
          "WHERE",
          "WHILE",
          "WITH",
          "WITHOUT",
          "WORK",
          "WRAPPER",
          "WRITE",
          "X509",
          "XA",
          "XID",
          "XML",
          "XOR",
          "YEAR",
          "YEAR_MONTH",
          "ZEROFILL",
        ]
      `)
    })
  })

  describe('parser.getReservedKeywords()', () => {
    it('returns a list of all reserved keywords', () => {
      const parser = new Parser()
      const reservedKeywords = parser.getReservedKeywords()
      expect(reservedKeywords).toMatchInlineSnapshot(`
        Array [
          "ACCESSIBLE",
          "ADD",
          "ALL",
          "ALTER",
          "ANALYZE",
          "AND",
          "AS",
          "ASC",
          "ASENSITIVE",
          "BEFORE",
          "BETWEEN",
          "BIGINT",
          "BINARY",
          "BLOB",
          "BOTH",
          "BY",
          "CALL",
          "CASCADE",
          "CASE",
          "CHANGE",
          "CHAR",
          "CHARACTER",
          "CHECK",
          "COLLATE",
          "COLUMN",
          "CONDITION",
          "CONSTRAINT",
          "CONTINUE",
          "CONVERT",
          "CREATE",
          "CROSS",
          "CURRENT_DATE",
          "CURRENT_TIME",
          "CURRENT_TIMESTAMP",
          "CURRENT_USER",
          "CURSOR",
          "DATABASE",
          "DATABASES",
          "DAY_HOUR",
          "DAY_MICROSECOND",
          "DAY_MINUTE",
          "DAY_SECOND",
          "DEC",
          "DECIMAL",
          "DECLARE",
          "DEFAULT",
          "DELAYED",
          "DELETE",
          "DESC",
          "DESCRIBE",
          "DETERMINISTIC",
          "DISTINCT",
          "DISTINCTROW",
          "DIV",
          "DOUBLE",
          "DROP",
          "DUAL",
          "EACH",
          "ELSE",
          "ELSEIF",
          "ENCLOSED",
          "ESCAPED",
          "EXISTS",
          "EXIT",
          "EXPLAIN",
          "FALSE",
          "FETCH",
          "FLOAT",
          "FLOAT4",
          "FLOAT8",
          "FOR",
          "FORCE",
          "FOREIGN",
          "FROM",
          "FULLTEXT",
          "GENERATED",
          "GET",
          "GRANT",
          "GROUP",
          "HAVING",
          "HIGH_PRIORITY",
          "HOUR_MICROSECOND",
          "HOUR_MINUTE",
          "HOUR_SECOND",
          "IF",
          "IGNORE",
          "IN",
          "INDEX",
          "INFILE",
          "INNER",
          "INOUT",
          "INSENSITIVE",
          "INSERT",
          "INT",
          "INT1",
          "INT2",
          "INT3",
          "INT4",
          "INT8",
          "INTEGER",
          "INTERVAL",
          "INTO",
          "IO_AFTER_GTIDS",
          "IO_BEFORE_GTIDS",
          "IS",
          "ITERATE",
          "JOIN",
          "KEY",
          "KEYS",
          "KILL",
          "LEADING",
          "LEAVE",
          "LEFT",
          "LIKE",
          "LIMIT",
          "LINEAR",
          "LINES",
          "LOAD",
          "LOCALTIME",
          "LOCALTIMESTAMP",
          "LOCK",
          "LONG",
          "LONGBLOB",
          "LONGTEXT",
          "LOOP",
          "LOW_PRIORITY",
          "MASTER_BIND",
          "MASTER_SSL_VERIFY_SERVER_CERT",
          "MATCH",
          "MAXVALUE",
          "MEDIUMBLOB",
          "MEDIUMINT",
          "MEDIUMTEXT",
          "MIDDLEINT",
          "MINUTE_MICROSECOND",
          "MINUTE_SECOND",
          "MOD",
          "MODIFIES",
          "NATURAL",
          "NOT",
          "NO_WRITE_TO_BINLOG",
          "NULL",
          "NUMERIC",
          "ON",
          "OPTIMIZE",
          "OPTIMIZER_COSTS",
          "OPTION",
          "OPTIONALLY",
          "OR",
          "ORDER",
          "OUT",
          "OUTER",
          "OUTFILE",
          "PARTITION",
          "PRECISION",
          "PRIMARY",
          "PROCEDURE",
          "PURGE",
          "RANGE",
          "READ",
          "READS",
          "READ_WRITE",
          "REAL",
          "REFERENCES",
          "REGEXP",
          "RELEASE",
          "RENAME",
          "REPEAT",
          "REPLACE",
          "REQUIRE",
          "RESIGNAL",
          "RESTRICT",
          "RETURN",
          "REVOKE",
          "RIGHT",
          "RLIKE",
          "SCHEMA",
          "SCHEMAS",
          "SECOND_MICROSECOND",
          "SELECT",
          "SENSITIVE",
          "SEPARATOR",
          "SET",
          "SHOW",
          "SIGNAL",
          "SMALLINT",
          "SPATIAL",
          "SPECIFIC",
          "SQL",
          "SQLEXCEPTION",
          "SQLSTATE",
          "SQLWARNING",
          "SQL_BIG_RESULT",
          "SQL_CALC_FOUND_ROWS",
          "SQL_SMALL_RESULT",
          "SSL",
          "STARTING",
          "STORED",
          "STRAIGHT_JOIN",
          "TABLE",
          "TERMINATED",
          "THEN",
          "TINYBLOB",
          "TINYINT",
          "TINYTEXT",
          "TO",
          "TRAILING",
          "TRIGGER",
          "TRUE",
          "UNDO",
          "UNION",
          "UNIQUE",
          "UNLOCK",
          "UNSIGNED",
          "UPDATE",
          "USAGE",
          "USE",
          "USING",
          "UTC_DATE",
          "UTC_TIME",
          "UTC_TIMESTAMP",
          "VALUES",
          "VARBINARY",
          "VARCHAR",
          "VARCHARACTER",
          "VARYING",
          "VIRTUAL",
          "WHEN",
          "WHERE",
          "WHILE",
          "WITH",
          "WRITE",
          "XOR",
          "YEAR_MONTH",
          "ZEROFILL",
        ]
      `)
    })
  })

  describe('parser.parse()', () => {
    it('parses valid MySQL queries without a lexer error', () => {
      const parser = new Parser()
      const result = parser.parse('SELECT * FROM users;')
      expect(result.lexerError).toBeUndefined()
    })

    it('parses valid MySQL queries without a parser error', () => {
      const parser = new Parser()
      const result = parser.parse('SELECT * FROM users;')
      expect(result.parserError).toBeUndefined()
    })

    it('parses unfinished double quotes with a lexer error', () => {
      const parser = new Parser()
      const result = parser.parse(`"`)
      expect(result.lexerError).toBeInstanceOf(LexerError)
      expect(result.lexerError?.message).toBe('Unfinished double quoted string literal')
      expect(result.lexerError?.data).toMatchObject({
        offset: 1,
        position: {
          character: 0,
          line: 1
        }
      })
    })

    it('parses unfinished single quotes with a lexer error', () => {
      const parser = new Parser()
      const result = parser.parse(`'`)
      expect(result.lexerError).toBeInstanceOf(LexerError)
      expect(result.lexerError?.message).toBe('Unfinished single quoted string literal')
      expect(result.lexerError?.data).toMatchObject({
        offset: 1,
        position: {
          character: 0,
          line: 1
        }
      })
    })

    it('parses unfinished back tick quotes with a lexer error', () => {
      const parser = new Parser()
      const result = parser.parse('`')
      expect(result.lexerError).toBeInstanceOf(LexerError)
      expect(result.lexerError?.message).toBe('Unfinished back tick quoted string literal')
      expect(result.lexerError?.data).toMatchObject({
        offset: 1,
        position: {
          character: 0,
          line: 1
        }
      })
    })

    it('supports specifying parse context', () => {
      const parser = new Parser()
      const result = parser.parse('FROM users', RuleName.fromClause)
      expect(result.lexerError).toBeUndefined()
      expect(result.parserError).toBeUndefined()
    })

    const parser = new Parser({ mode: SqlMode.AnsiQuotes, charsets })
    const statements = parser.splitStatements(queries, '\n', '$$')

    statements.forEach(statement => {
      it(`"${statement.text}" parses successfully`, () => {
        const { isMatch: isMatch1, statement: statement1 } = versionMatches(statement, 50620)
        if (isMatch1) {
          parser.version = '5.6.20'
          const result = parser.parse(statement1.text)
          expect(result.lexerError).toBeUndefined()
          expect(result.parserError).toBeUndefined()
          expect(result.references).toMatchSnapshot()
          return
        }

        const { isMatch: isMatch2, statement: statement2 } = versionMatches(statement, 50720)
        if (isMatch2) {
          parser.version = '5.7.20'
          const result = parser.parse(statement2.text)
          expect(result.lexerError).toBeUndefined()
          expect(result.parserError).toBeUndefined()
          expect(result.references).toMatchSnapshot()
          return
        }

        const { isMatch: isMatch3, statement: statement3 } = versionMatches(statement, 80018)
        if (isMatch3) {
          parser.version = '8.0.18'
          const result = parser.parse(statement3.text)
          expect(result.lexerError).toBeUndefined()
          expect(result.parserError).toBeUndefined()
          expect(result.references).toMatchSnapshot()
          return
        }
      })
    })
  })
})
