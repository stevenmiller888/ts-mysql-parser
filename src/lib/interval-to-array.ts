import { Vocabulary } from 'antlr4ts'
import { IntervalSet } from 'antlr4ts/misc/IntervalSet'

export function intervalToArray(set: IntervalSet, vocabulary: Vocabulary): string[] {
  const symbols = set.toIntegerList()

  if (symbols.isEmpty) {
    return []
  }

  const tokens: string[] = []

  for (let i = 0; i < symbols.size; ++i) {
    const symbol = symbols.get(i)
    if (symbol < 0) {
      tokens.push('EOF')
    } else {
      let name = vocabulary.getDisplayName(symbol)
      if (name.includes('_SYMBOL')) {
        name = name.substr(0, name.length - 7)
      } else if (name.includes('_OPERATOR')) {
        name = name.substr(0, name.length - 9)
      } else if (name.includes('_NUMBER')) {
        name = name.substr(0, name.length - 7) + ' number'
      } else if (name.includes('BACK_TICK_QUOTED_ID')) {
        name = '`text`'
      } else if (name.includes('DOUBLE_QUOTED_TEXT')) {
        name = '"text"'
      } else if (name.includes('SINGLE_QUOTED_TEXT')) {
        name = "'text'"
      }
      tokens.push(name)
    }
  }

  return tokens
}
