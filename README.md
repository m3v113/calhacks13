# Project Scaffold

A home for messy personal projects that runs entirely on your own computer.

- **Hub** (`/`): an infinite canvas that will hold your projects, with the Smart Inbox on the side.
- **Smart Inbox** (`/inbox`): drop in anything (notes, links, images, documents). Local AI sorts each item into a category and gives it a short title.

Everything is stored in one file on your computer, and the AI runs locally with [Ollama](https://ollama.com). No account, no API key, and nothing leaves your machine except reading the links you add.

> Names are working names and may change. They all live in `lib/names.ts`.

---

## Setup (first time)

You need three things: **Node.js**, **Ollama**, and this code. The steps below are for a Mac and take about 10 minutes, mostly downloads.

### 1. Install Node.js

Node.js runs the app. Check whether you already have it by opening **Terminal** (press ⌘ + Space, type "Terminal", press Enter) and running:

```bash
node -v
```

If it prints `v20` or higher (for example `v22.11.0`), you're set. Otherwise, download the **LTS** version from [nodejs.org](https://nodejs.org) and run the installer. Then close Terminal, open it again, and check `node -v` once more.

### 2. Install Ollama and download the AI model

Ollama runs AI models on your computer.

1. Download it from [ollama.com/download](https://ollama.com/download), open the file, and drag Ollama into Applications.
2. Open the Ollama app. A small llama icon appears in the menu bar at the top of the screen, which means it's running.
3. In Terminal, download the model the app uses (about 3 GB). It sorts and titles items, writes summaries, and reads images, so it's the only one you need:

   ```bash
   ollama pull gemma3:4b
   ```

   > Don't use `llama3.2-vision`. Ollama dropped support for it in version 0.30 ("unknown model architecture: 'mllama'"), and updating doesn't bring it back. If you have it, `ollama rm llama3.2-vision` frees 8 GB. `llama3.2:3b` isn't needed anymore either.

### 3. Get the code

If you don't have it yet, download it with git:

```bash
cd ~/Desktop
git clone git@github.com:m3v113/calhacks13.git
cd calhacks13
```

If you already have the folder, go into it with `cd` followed by its path, for example `cd ~/Desktop/project_manager/app`.

### 4. Install and set up

Run these one at a time from inside the project folder:

```bash
cp .env.example .env    # creates your settings file
npm install             # downloads the app's libraries (a minute or two)
npm run setup           # creates the local database in data/app.db
```

### 5. Start the app

```bash
npm run dev
```

When Terminal shows `Ready`, open **http://localhost:3000** in your browser.

To stop the app, click in Terminal and press **Ctrl + C**. To start it again later, open Terminal, `cd` into the folder, and run `npm run dev`.

---

## Using it

Hover over any icon to see what it does.

| You see | It means |
|---|---|
| Four dots icon | The Hub (home page) |
| Tray icon | The Smart Inbox page |
| Half-filled circle, sun, or moon | Theme. Click to switch: **match Mac** (follows your Mac's Light/Dark setting) → **light** → **dark**. Your choice is remembered. |
| **Green dot** | Local AI is running. Hover to see whether an image model is installed. |
| **Yellow dot** | Ollama isn't running. Items are sorted by simple rules for now and re-sorted by AI once Ollama is back. |
| Pulsing gray dot on an item | The AI is still sorting it |

- **Add a note:** type in the box and press **Enter**. **Shift + Enter** adds a new line.
- **Add a link, image, or document:** press **+** and pick one. You can also drag files onto the inbox or paste an image.
- **Open an item (a "tray"):** click it. On the left are the content (the note, image, PDF, or video) and an AI summary. On the right is space for your own notes. Everything is editable and saves as you type: click the title, note, summary, or notes to change them. The ↻ button next to Summary writes a fresh one. Links only open when you click the link inside the tray. Press **Esc** or click outside to close.
- **Move an item to another category:** click its colored dot or category name, then pick a category, or type a new name in **New** and press Enter.
- **Delete an item:** hover over it and click the trash icon. This deletes it for good, including any uploaded file.
- **Hub:** drag the background or scroll with two fingers to move around. Pinch (or hold Ctrl and scroll) to zoom. The button at the top right shows or hides the inbox.

---

## Getting updates

When there are new changes on GitHub:

```bash
git pull
npm install       # only needed if new libraries were added; safe to run anyway
npm run dev       # also updates the database to match
```

---

## Settings (`.env`)

| Setting | Default | What it does |
|---|---|---|
| `DATABASE_URL` | `file:../data/app.db` | Where your data is stored |
| `OLLAMA_URL` | `http://localhost:11434` | Where Ollama is running |
| `OLLAMA_MODEL` | `gemma3:4b` | Model used to sort, title, and summarize items |
| `OLLAMA_VISION_MODEL` | same as `OLLAMA_MODEL` | Model used to read images. If it isn't installed, the smallest other model that can see images is used. |

Restart the app (Ctrl + C, then `npm run dev`) after changing a setting.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `command not found: node` or `npm` | Node.js isn't installed, or Terminal was open during the install. Install it (step 1) and reopen Terminal. |
| `command not found: ollama` | Open the Ollama app once; it adds the command. Then reopen Terminal. |
| The dot stays yellow | Open the Ollama app, and check that `ollama list` shows `gemma3:4b`. If your `.env` is from before the switch, change `OLLAMA_MODEL` in it to `"gemma3:4b"`. |
| Everything lands in "Other" | Usually Ollama isn't running. Start it and the inbox re-sorts within a minute. |
| An image only shows its file name | No working image model. Run `ollama pull gemma3:4b`, then wait a couple of minutes. The Terminal shows `[sort] image model … failed` with the reason if one is installed but broken. |
| A summary never appears | Check the Terminal for `[sort] AI failed`. Summaries need Ollama running. A link whose page can't be read gets no summary, but you can write one. |
| `Module not found: Can't resolve '…'` | A new library was added in an update. Run `npm install`. |
| A page says 404 | The Hub is at http://localhost:3000 and the inbox at http://localhost:3000/inbox. |
| `Environment variable not found: DATABASE_URL` | You skipped `cp .env.example .env`. Run it, then try again. |
| `Port 3000 is in use` | The app is already running in another Terminal window. Use that one, or stop it with Ctrl + C. |
| Something looks broken after `git pull` | Run `npm install`, then `npm run dev` again. |
| Start over with an empty inbox | `npm run db:reset` deletes all items and categories. Uploaded files stay in `data/uploads/`. |

---

## How it's built

| Part | Tool | Why |
|---|---|---|
| App (pages and server) | [Next.js](https://nextjs.org) 15 + React + TypeScript | One project for both the screens and the server code |
| Database | SQLite via [Prisma](https://www.prisma.io) 6 | Your data is one file, `data/app.db`, with no database server to run |
| Local AI | [Ollama](https://ollama.com) | Runs models on your Mac. The app asks for JSON in a fixed shape, checks it, and retries once. |
| Reading documents | [unpdf](https://github.com/unjs/unpdf) | Pulls text out of PDFs so the AI can sort and summarize them |
| Reading web pages | [Readability](https://github.com/mozilla/readability) + [linkedom](https://github.com/WebReflection/linkedom) | Pulls the article text out of a page, without menus and ads, on your Mac. This is what Firefox's Reader View uses. |
| Research papers | [Crossref](https://www.crossref.org) | A free database of journal papers. Gives the real title, journal, year, and often the abstract when a publisher's site blocks reading. |
| Styling | Plain CSS (`app/globals.css`) | A few colors and shapes; light and dark mode follow your system |

**What happens when you add something:**

1. It's saved and shows up right away with a pulsing dot.
2. For a link, the app reads the page's title and article text. YouTube and Vimeo titles come from their oEmbed service, and research papers from Crossref.
3. For a document, its text is pulled out. For an image, a model that can see images describes it.
4. Wordle scores go straight to **Wordle**. Everything else goes to the local AI, which picks a category (or makes a new one) and writes a short title and a summary.
5. If Ollama is off, simple keyword rules pick a category, and the AI redoes it later.

## Where things are

| Path | What |
|---|---|
| `app/page.tsx` | Hub page (`/`) |
| `app/inbox/page.tsx` | Smart Inbox page (`/inbox`) |
| `components/Hub.tsx` | Canvas (pan and zoom) and the inbox side panel |
| `components/Inbox.tsx` | Category list, add box and + menu, item rows, category menu |
| `components/Nav.tsx` | Page icons and the status dot |
| `lib/useInbox.ts` | Inbox data shared by both pages |
| `lib/sort.ts` | Sorting and titles: Wordle rule, AI, fallback rules, background re-sort |
| `lib/ollama.ts` | Talks to Ollama |
| `lib/link.ts` | Reads a link's title and description (cached) |
| `lib/files.ts` | Saves uploads and pulls text out of documents |
| `components/ItemView.tsx` | The tray view: content, summary, and notes, all editable |
| `app/api/` | Server routes: `items` (list, add, change, delete), `files` (serve uploads), `status` |
| `prisma/schema.prisma` | The data model |
| `data/` | Your database and uploads (not in git) |
