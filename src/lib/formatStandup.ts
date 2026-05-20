import type { StructuredStandup } from '../types/standup'

export function formatStandupDisplay(standup: StructuredStandup): string {
  const summary = standup.summary?.trim()
  const summaryBlock = summary
    ? `Summary:\n${summary}\n\n`
    : ''
  return `${summaryBlock}Yesterday:\n${standup.yesterday}\n\nToday:\n${standup.today}\n\nBlockers:\n${standup.blockers}`
}
