import { keywords56, keywords57, keywords80 } from '../grammar/keywords'

export enum MySQLVersion {
  Unknown,
  MySQL56,
  MySQL57,
  MySQL80
}

export function versionToNumber(version: string): number {
  const [major, minor, patch] = version.split('.')

  const majorMinor = `${major}0${minor}`

  if (String(patch).length === 2) {
    return Number(`${majorMinor}${patch}`)
  }

  return Number(`${majorMinor}0${patch}`)
}

export function numberToVersion(version: number): MySQLVersion {
  const major = Math.floor(version / 10000)
  const minor = Math.floor((version / 100) % 100)

  if (major < 5 || major > 8) {
    return MySQLVersion.Unknown
  }

  if (major === 8) {
    return MySQLVersion.MySQL80
  }

  if (major != 5) {
    return MySQLVersion.Unknown
  }

  switch (minor) {
    case 6:
      return MySQLVersion.MySQL56
    case 7:
      return MySQLVersion.MySQL57
    default:
      return MySQLVersion.Unknown
  }
}

export function keywordsForVersion(version: number): string[] {
  const mySQLVersion = numberToVersion(version)

  switch (mySQLVersion) {
    case MySQLVersion.MySQL56:
      return keywords56.map(keyword => keyword.word)
    case MySQLVersion.MySQL57:
      return keywords57.map(keyword => keyword.word)
    case MySQLVersion.MySQL80:
      return keywords80.map(keyword => keyword.word)
    default:
      return []
  }
}

export function reservedKeywordsForVersion(version: number): string[] {
  const mySQLVersion = numberToVersion(version)

  switch (mySQLVersion) {
    case MySQLVersion.MySQL56: {
      const reserved = keywords56.filter(({ isReserved }) => isReserved)
      return reserved.map(keyword => keyword.word)
    }
    case MySQLVersion.MySQL57: {
      const reserved = keywords57.filter(({ isReserved }) => isReserved)
      return reserved.map(keyword => keyword.word)
    }
    case MySQLVersion.MySQL80: {
      const reserved = keywords80.filter(({ isReserved }) => isReserved)
      return reserved.map(keyword => keyword.word)
    }
    default:
      return []
  }
}
