import 'dotenv/config'

const key = process.env.OPENAI_API_KEY?.trim()
if (!key) {
  console.error('OPENAI_API_KEY missing')
  process.exit(1)
}

const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'
console.log(`Testing OpenAI model: ${model}`)

const res = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model,
    messages: [
      { role: 'system', content: 'Respond in json format only.' },
      { role: 'user', content: 'Return json: {"ok":true}' },
    ],
    response_format: { type: 'json_object' },
  }),
})

const text = await res.text()
if (!res.ok) {
  console.error(`FAIL (${res.status}):`, text.slice(0, 400))
  process.exit(1)
}

console.log('OK:', text.slice(0, 120))
