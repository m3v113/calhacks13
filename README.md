# Oven

Toss in anything: links, notes, your voice, files. Oven sorts your ingredients, then cooks them into project spaces to organize, research, plan, and work, all on your own machine.

## Setup

You need **Node.js** (v20 or newer), **Ollama**, and this code. On a Mac this takes about 10 minutes, mostly downloads.

1. **Node.js:** run `node -v` in Terminal. If it's missing or older than v20, install the LTS version from [nodejs.org](https://nodejs.org), then reopen Terminal.
2. **Ollama:** install it from [ollama.com/download](https://ollama.com/download) and open the app. Then download the model (about 3 GB):

   ```bash
   ollama pull gemma3:4b
   ```

3. **Get the code and set it up:**

   ```bash
   git clone git@github.com:m3v113/calhacks13.git
   cd calhacks13
   cp .env.example .env    # your settings file
   npm install
   npm run setup           # creates the local database in data/app.db
   ```

4. **Start it:**

   ```bash
   npm run dev
   ```

   When Terminal shows `Ready`, open **http://localhost:3000**. Press **Ctrl + C** in Terminal to stop it.

Web search, blocked sites, and the mic are optional and need keys in `.env` (see [Settings](#settings)). Everything else works without them.

**Updating:** `git checkout main && git pull && npm install && npm run dev`. If the page still looks old, hard refresh with **⌘ + Shift + R**. New settings show up in `.env.example`; copy any new lines into your `.env`.

### Settings

Set these in `.env`, then restart the app.

| Setting | Default | What it does |
|---|---|---|
| `OLLAMA_MODEL` | `gemma3:4b` | The local model for everything |
| `OLLAMA_VISION_MODEL` | same as `OLLAMA_MODEL` | The model that reads images |
| `OLLAMA_URL` | `http://localhost:11434` | Where Ollama is running |
| `BRIGHTDATA_API_KEY` | (none) | [Bright Data](https://brightdata.com) key, for web search and for reading sites that block the app |
| `BRIGHTDATA_SERP_ZONE` | (none) | Your SERP API zone (for example `serp_api1`), used by Scouts and Resources |
| `BRIGHTDATA_ZONE` | `web_unlocker1` | Your Web Unlocker zone, used only when a direct read fails |
| `CARTESIA_API_KEY` | (none) | [Cartesia](https://cartesia.ai) key, for the mic |

What leaves your machine: the pages of links you add are read from the web. With Bright Data set up, the search words and the addresses of blocked pages go to it. With Cartesia set up, what you record with the mic goes to it, only while the mic is on.

### Troubleshooting

| Problem | Fix |
|---|---|
| The dot by the icons is yellow | Ollama isn't running. Open the Ollama app and check that `ollama list` shows `gemma3:4b`. |
| A link shows its address instead of a title | Its page couldn't be read. The Terminal shows `[link] couldn't read …`. For `HTTP 403`, set up Bright Data. |
| The mic is blocked | Allow the microphone for localhost in the browser's site settings. |
| AI answers are slow | The first one loads the model. Check that `ollama ps` shows `100% GPU`, and close other big apps. `gemma3:1b` is faster but sorts less well. |
| `Module not found` or something breaks after an update | Run `npm install`, then `npm run dev`. |
| `Environment variable not found: DATABASE_URL` | Run `cp .env.example .env`. |
| Start over with an empty Pantry | `npm run db:reset` deletes all items and categories. |

## Inspiration

Our notes, screenshots, saved links, and to-dos often end up cluttered, scattered across a dozen apps. Most of our ideas never turn into something solid. We wanted one place to toss all our ingredients, have them sorted and easy to reach, and turn them into research and working spaces or tasks, all on our own machine.

## What it does

Oven is a local-first AI organizer. You toss anything into the Pantry: links, notes, files, PDFs, images, or your voice. Oven sorts these ingredients into categories automatically. When you're ready, you cook them into projects, which are spaces on an infinite canvas to organize information, research, plan, and work.

- In the **Pantry**, your thoughts are summarized, categorized, editable, and annotatable.
- Thoughts from your Pantry can turn into tasks or projects.
- **Tasks** are prioritized and have deadlines, and are neatly formatted for your viewing pleasure.
- Every project space is shaped by your goals, and each comes with its own customizable layout.
  - **Manual** projects are yours to shape, with curated places to do your work, write, and think.
  - **Assisted** projects are hubs to research and collect information, with an overview, a to-do list, and researched resources.
- Each project links to sources from your Pantry, so everything is connected. Projects can also have helpers, called **Scouts**, which search the web to find things or answer questions. Each project also comes with an AI fed that project's context and sources, so it stays up to date on your questions and desires.

## How we built it

Oven is a Next.js and TypeScript app that runs on your own computer. Everything is stored in a local SQLite database through Prisma, and writing sections use the TipTap editor.

**Local AI.** Google's Gemma 3 runs on-device through Ollama. One small model sorts the Pantry, summarizes links and files, builds Assisted projects, creates tasks, powers the AI section and Scouts, and understands images. unpdf reads PDFs.

**Reading links.** Oven fetches each page directly, Mozilla Readability pulls out the main text, and Gemma summarizes it. Videos use oEmbed and research papers use Crossref.

**Online only when it helps.**
- Bright Data (SERP API and Web Unlocker) powers web search for Scouts and Resources.
- Cartesia Ink 2 streams live speech-to-text, so your words appear as you talk.

**Simple on top.** The Hub is an infinite canvas of project cards you can move, resize, color, and connect, with the Pantry and Tasks in the sidebar.

## Challenges we ran into

- Getting a small local model to return reliable structured output.
- Keeping it fast on a laptop by keeping the model loaded, using shorter prompts, and showing results as they arrive.
- Live speech-to-text streaming, and typed dates like "next fri".
- Working out what a "project" is, and keeping customizability and freedom without a cluttered, AI-heavy UI.

## Accomplishments that we're proud of

- It works offline, and your data never leaves your machine unless you ask a Scout to search.
- It understands loose requests. Asking it to "turn my sources into citations" just worked.
- It's a clean, simple interface for a lot of power underneath.

## What we learned

Making things simple and clean is hard! It's difficult to balance lots of capability with easy use.

## What's next for Oven

- Faster: quicker sorting and project building with smarter use of the local model.
- Mobile companion app: toss things into the Pantry from your phone wherever you are.
- Sync across devices: keep your Pantry, projects, and tasks in step between your laptop and phone, privately.
- Better and more Scout uses.

## Where things are

| Path | What |
|---|---|
| `components/Hub.tsx`, `components/Projects.tsx` | The Hub canvas, project cards, and the New project box |
| `components/Inbox.tsx`, `components/ItemView.tsx` | The Pantry list and an item's tray |
| `components/ProjectSpace.tsx`, `components/Writing.tsx` | A project's sections, tasks, Project Dump, and writing |
| `components/Agenda.tsx`, `components/Due.tsx`, `lib/due.ts` | Tasks, and dates, times, and priority |
| `components/Mic.tsx`, `app/api/transcribe/` | The mic (Cartesia) |
| `lib/ollama.ts` | Talks to Ollama |
| `lib/sort.ts`, `lib/link.ts`, `lib/files.ts` | Sorting, reading links, reading files |
| `lib/projects.ts`, `lib/assistant.ts`, `lib/scouts.ts` | Project layouts, the AI section, Scouts |
| `lib/names.ts` | Display names (Oven, Pantry, Manual, Assisted…) |
| `app/api/` | Server routes |
| `prisma/schema.prisma` | The data model |
| `data/` | Your database and uploads (not in git) |
