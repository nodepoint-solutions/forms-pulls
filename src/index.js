import { createServer } from './server.js'
import { startScheduler, startSlackScheduler } from './services/scheduler.js'
import { sendSlackSummary, sendSecuritySlackSummary } from './services/slack.js'
import { config } from './config.js'

function isMondayUK() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'long' }).format(new Date()) === 'Monday'
}

// Start server immediately — routes return a loading screen while caches warm
const server = await createServer()
await server.start()

server.logger.info(`Server running at ${server.info.uri}`)

// Scheduler handles the initial warm and all subsequent refreshes,
// with exponential backoff on failure in both cases
startScheduler()

// Daily PR Slack summary at 9am UK time; security alert summary follows on Mondays
if (config.slackBotToken && config.slackChannelId) {
  startSlackScheduler(async () => {
    await sendSlackSummary()
    if (isMondayUK()) {
      await sendSecuritySlackSummary()
    }
  })
  server.logger.info('Slack daily summary scheduled at 09:00 Europe/London (security alerts: Mondays only)')
}
