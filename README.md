# Project Scaffold app

Runs entirely on your Mac. Two pages:

- `/` Smart Inbox
- `/hub` Hub (infinite canvas with the inbox on the side)

## First run

```bash
cd app
npm install
npm run setup          # creates data/app.db
ollama pull llama3.2:3b
npm run dev            # open http://localhost:3000
```

Ollama must be running (the menu bar app, or `ollama serve`). Without it, items are sorted by simple rules and re-sorted by AI once it's back. The dot next to the page icons is green when local AI is on and yellow when it's off.

## Handy

- Reset all data: `npm run db:reset`
- Change model: edit `OLLAMA_MODEL` in `.env`, then restart
- Rename things: `lib/names.ts`

## Where things are

| Path | What |
|---|---|
| `app/page.tsx`, `app/hub/page.tsx` | The two pages |
| `components/Inbox.tsx` | Category list, capture box, item rows, category menu |
| `components/Hub.tsx` | Canvas (pan, zoom) and the inbox panel |
| `lib/useInbox.ts` | Inbox state shared by both pages |
| `lib/sort.ts` | Sorting: Wordle rule, AI, fallback rules, re-sort sweep |
| `lib/ollama.ts` | Ollama client (JSON schema output, retry once) |
| `lib/link.ts` | Reads a link's title and description, cached |
| `app/api/items` | List, add, change category, archive |
| `prisma/schema.prisma` | Data model |
