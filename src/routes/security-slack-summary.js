import { config } from '../config.js'
import { sendSecuritySlackSummary, wasSecurityAlreadySentThisHour } from '../services/slack.js'

export default {
  method: 'POST',
  path: '/security-slack-summary',
  async handler(request, h) {
    if (!config.slackBotToken || !config.slackChannelId) {
      return h.redirect('/security?slack=not-configured')
    }
    if (wasSecurityAlreadySentThisHour()) {
      return h.redirect('/security?slack=cooldown')
    }
    sendSecuritySlackSummary().catch((err) => console.error('Manual security Slack summary failed:', err.message))
    return h.redirect('/security?slack=sent')
  },
}
