/**
 * This script generates the rule name enum from the parser's list of rule names.
 */
import { MySQLParser } from '../src'
import path from 'path'
import fs from 'fs'

const file = path.join(__dirname, '../src/lib/rule-name.ts')
const text = `/* eslint-disable @typescript-eslint/camelcase */

export enum RuleName {
${MySQLParser.ruleNames.map(r => `  ${r} = '${r}',`).join('\n')}
}
`

fs.writeFileSync(file, text)
