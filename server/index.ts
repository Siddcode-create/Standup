import 'dotenv/config'
import { createApp } from './createApp.js'

const port = Number(process.env.PORT ?? 3001)
const app = createApp()

app.listen(port, () => {
  console.log(`Standup API listening on http://localhost:${port}`)
})
