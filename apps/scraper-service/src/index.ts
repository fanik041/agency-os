import express from 'express'

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// /scrape endpoint — implemented in Phase 2

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Scraper service running on port ${PORT}`))
