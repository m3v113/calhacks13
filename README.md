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
3. In Terminal, download the model the inbox uses (about 2 GB):

   ```bash
   ollama pull llama3.2:3b
   ```

4. **Optional:** to have images read and sorted by what's in them (not just their file name), also download the vision model (about 8 GB):

   ```bash
   ollama pull llama3.2-vision
   ```

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

| You see | It means |
|---|---|
| Four dots icon | The Hub (home) |
| Tray icon | The Smart Inbox page |
| **Green dot** next to the icons | Local AI is running |
| **Yellow dot** | Ollama isn't running. Items are sorted by simple rules for now and re-sorted by AI once Ollama is back. |
| Pulsing gray dot on an item | The AI is still sorting it |

- **Add a note:** type in the box and press **Enter**. **Shift + Enter** adds a new line.
- **Add a link, image, or document:** press **+** and pick one. You can also drag files onto the inbox or paste an image.
- **Move an item to another category:** click its colored dot or category name, then pick a category, or type a new name in **New** and press Enter.
- **Archive an item:** hover over it and click the circle on the right.
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
| `OLLAMA_MODEL` | `llama3.2:3b` | Model used to sort and title items |
| `OLLAMA_VISION_MODEL` | `llama3.2-vision` | Model used to read images, if installed |

Restart the app (Ctrl + C, then `npm run dev`) after changing a setting.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `command not found: node` or `npm` | Node.js isn't installed, or Terminal was open during the install. Install it (step 1) and reopen Terminal. |
| `command not found: ollama` | Open the Ollama app once; it adds the command. Then reopen Terminal. |
| The dot stays yellow | Open the Ollama app, and check that `ollama list` shows `llama3.2:3b`. |
| Everything lands in "Other" | Usually Ollama isn't running. Start it and the inbox re-sorts within a minute. |
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
| Reading documents | [unpdf](https://github.com/unjs/unpdf) | Pulls text out of PDFs so the AI can sort them |
| Styling | Plain CSS (`app/globals.css`) | A few colors and shapes; light and dark mode follow your system |

**What happens when you add something:**

1. It's saved and shows up right away with a pulsing dot.
2. For a link, the app reads the page's title. YouTube and Vimeo titles come from their oEmbed service.
3. For a document, its text is pulled out. For an image, the vision model looks at it, if installed.
4. Wordle scores go straight to **Wordle**. Everything else goes to the local AI, which picks a category (or makes a new one) and writes a short title.
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
| `app/api/` | Server routes: `items` (list, add, change, archive), `files` (serve uploads), `status` |
| `prisma/schema.prisma` | The data model |
| `data/` | Your database and uploads (not in git) |
