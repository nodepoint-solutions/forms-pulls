import { createServer } from './server.js'
import { startScheduler } from './services/scheduler.js'

const server = await createServer()
await server.start()

server.logger.info(`Server running at ${server.info.uri}`)

startScheduler()
