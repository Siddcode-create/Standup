import 'dotenv/config'

const key = process.env.GEMINI_API_KEY?.trim()
if (!key) {
  console.error('No GEMINI_API_KEY')
  process.exit(1)
}

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
)
const data = await res.json()

if (!res.ok) {
  console.error('List failed:', JSON.stringify(data, null, 2).slice(0, 500))
  process.exit(1)
}

const generateModels = (data.models ?? [])
  .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
  .map((m) => m.name?.replace('models/', ''))

console.log('Available generateContent models:')
for (const name of generateModels.slice(0, 25)) {
  console.log(' -', name)
}
console.log(`... ${generateModels.length} total`)
