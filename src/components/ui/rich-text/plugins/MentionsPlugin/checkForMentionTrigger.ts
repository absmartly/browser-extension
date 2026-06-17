import type { MenuTextMatch } from "@lexical/react/LexicalTypeaheadMenuPlugin"

const PUNCTUATION =
  "\\.,\\+\\*\\?\\$\\@\\|#{}\\(\\)\\^\\-\\[\\]\\\\/!%'\"~=<>_:;"

const VALID_JOINS = "(?:" + "\\.[ |$]|" + " |" + "[" + PUNCTUATION + "]|" + ")"

const LENGTH_LIMIT = 75
const ALIAS_LENGTH_LIMIT = 50

export function checkForMentionTrigger(
  text: string,
  minMatchLength: number,
  triggers: string[]
): MenuTextMatch | null {
  const TRIGGERS = triggers.join("")
  const VALID_CHARS = "[^" + TRIGGERS + PUNCTUATION + "\\s]"

  const TriggerMentionsRegex = new RegExp(
    "(^|\\s|\\()(" +
      "[" +
      TRIGGERS +
      "]" +
      "((?:" +
      VALID_CHARS +
      VALID_JOINS +
      "){0," +
      LENGTH_LIMIT +
      "})" +
      ")$"
  )

  const TriggerMentionsRegexAliasRegex = new RegExp(
    "(^|\\s|\\()(" +
      "[" +
      TRIGGERS +
      "]" +
      "((?:" +
      VALID_CHARS +
      "){0," +
      ALIAS_LENGTH_LIMIT +
      "})" +
      ")$"
  )

  let match = TriggerMentionsRegex.exec(text)
  if (match === null) {
    match = TriggerMentionsRegexAliasRegex.exec(text)
  }
  if (match !== null) {
    const maybeLeadingWhitespace = match[1]
    const matchingString = match[3]
    if (matchingString.length >= minMatchLength) {
      return {
        leadOffset: match.index + maybeLeadingWhitespace.length,
        matchingString,
        replaceableString: match[2]
      }
    }
  }
  return null
}
