import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai'

const key = process.env.GEMINI_API_KEY?.trim()
if (!key) {
  console.error('GEMINI_API_KEY is missing in .env')
  process.exit(1)
}

console.log(`GEMINI_API_KEY loaded (${key.length} chars)`)

const genAI = new GoogleGenerativeAI(key)
const models = [
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
]

for (const model of models) {
  try {
    const m = genAI.getGenerativeModel({ model })
    const r = await m.generateContent('Reply with exactly: {"ok":true}')
    console.log(`OK  ${model}:`, r.response.text().trim().slice(0, 60))
    process.exit(0)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`FAIL ${model}:`, msg.slice(0, 200))
  }
}

process.exit(1)
