# Project Scaffold

A home for messy personal projects that runs entirely on your own computer.

- **Hub** (`/`): an infinite canvas with a card for each project, and the Brain Dump on the side.
- **Project space** (`/p/...`): one project's writing, tasks, and sources, laid out in a grid you arrange. Projects are either a **Space** (you do the work) or **Auto** (the AI proposes steps).
- **Brain Dump** (`/inbox`): drop in anything (notes, links, images, documents). Local AI sorts each item into a category and gives it a short title.

Everything is stored in one file on your computer, and the AI runs locally with [Ollama](https://ollama.com). No account and no API key are needed, and nothing leaves your machine except reading the links you add. (Optional exceptions: if you set up Bright Data, the addresses of sites that block reading, and the search words of Scouts you run, are sent to it. See [Settings](#settings-env).)

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

**Optional:** to read sites that block apps (like allrecipes), add a Bright Data key to `.env`. See [Settings](#settings-env). Everything else works without it.

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
| Tray icon | The Brain Dump page |
| Half-filled circle, sun, or moon | Theme. Click to switch: **match Mac** (follows your Mac's Light/Dark setting) → **light** → **dark**. Your choice is remembered. |
| **Green dot** | Local AI is running. Hover to see whether an image model is installed. |
| **Yellow dot** | Ollama isn't running. Items are sorted by simple rules for now and re-sorted by AI once Ollama is back. |
| Pulsing gray dot on an item | The AI is still sorting it |

- **Add a note:** type in the box and press **Enter**. **Shift + Enter** adds a new line.
- **Add a link, image, or document:** press **+** and pick one. You can also drag files onto the inbox or paste an image.
- **Open an item (a "tray"):** click it. The AI summary is on the left, the item itself (the note, image, PDF, or video) is in the middle, and your own notes are on the right. Everything is editable and saves as you type: click the title, note, summary, or notes to change them. The ↻ button next to Summary writes a fresh one. Links show the page's preview picture and description, and only open when you click them. Long items can take a minute or two to summarize. If the AI can't write a summary after 3 tries, the tray says so, and ↻ tries again. Press **Esc** or click outside to close.
- **Move an item to another category:** drag it onto a category on the left. Or click its colored dot or category name (in the list, or at the top of an open tray), then pick a category, or type a new name in **New** and press Enter.
- **Make a new category:** type a name in **New** under the categories on the left and press Enter. Then drag items onto it.
- **Rename, recolor, or delete a category:** hover over it on the left and click **⋯**. Type a new name and press Enter, or pick a color. Deleting a category doesn't delete its items: they're sorted again.
- **The AI learns from your moves:** when you move an item to another category, the AI sees that the next time it sorts something similar. It also sees every category (including ones you made) and a few items already in each, so it knows what each one is for. If an item names one of your categories ("banana bread" → **Banana Bread**), it goes there.
- **Delete an item:** hover over it and click the trash icon. This deletes it for good, including any uploaded file.
- **Hub:** drag the background or scroll with two fingers to move around. Pinch (or hold Ctrl and scroll) to zoom. The button at the top right shows or hides the inbox.
- **New project:** click **+** at the bottom left of the Hub and describe it in one sentence ("replace the ceiling fan in my bedroom"). The AI suggests a name and **Space** or **Auto**, and you can change either. The kind is set here only.
  - **Space** is a workspace you set up. You get the AI's suggested sections: change a section's type or name, drag the handle on its left to reorder, remove it with ×, or add more with **+ Writing** and **+ Tasks**. Every project gets one Sources section. With the AI off, the closest built-in template is used (Research Paper, Class, Event, Learning, or Utility Task).
  - **Auto** lets the AI break the project into steps. Give it links, notes, or items **From inbox** to work from (all optional). Links you paste become sources.
- **Project cards:** the card is filled with the project's color. Drag it to move, click to open. The ⋯ menu renames it, changes its color, or deletes it. Drag the bottom-right corner to resize it. Drag an inbox item onto a card to add it to that project's sources.
- **Linking projects:** hover over a card and drag a circle on any side onto another card. Circles show on nearby cards as the line gets close. Linked projects show each other's sources. Click a line to change its color or remove it.
- **Inside a project:**
  - **Writing** sections have formatting (bold, italic, headings, lists) in a small bar that shows while you type. ⌘B and ⌘I work too.
  - **Tasks:** check off, reword, and add.
  - **Auto projects:** after you create one, the AI lays it out in sections (this can take a minute): short explanations, key points, facts, and checklists, including what to do if something goes wrong. Delete any section you don't need with its trash icon, and add your own with **+ Section**.
  - **Sources:** paste a link, write a note, or upload a file. It's added to the inbox too. **From inbox** searches the inbox, filters by category, and groups results by category. × takes a source out of the project (it stays in the inbox).
  - **Arranging:** drag a section by the handle in its header onto another section's edge. Left or right puts them side by side, and top or bottom stacks them. ↔ switches a section between half and full width.
  - **Scouts** (on the left) do one job when you press **Run**. Click **+**, write what you need, and check the kind (it's guessed from your words):
    - **Find** searches the web and gives options to compare, like fans with their price and size. **+** saves one to Sources.
    - **Answer** searches the web, reads a few pages, and writes a short answer. Each point links to its page. Without Bright Data it answers from the local AI and says so.
    - **Turn into** reads your Sources (and any links in the brief) and turns them into tasks, citations, a table, or an outline.
    - **Add to project** puts the result in a new section. **Send to Scouts** (the magnifier on a task) starts a Scout from that task. Each run uses at most 3 searches and 6 page reads, and the same search isn't paid for twice within a week.
- **From a tray:** the chip next to the category says which project the item is in. Click it to pick another project or **No project**.

---

## Getting updates

When there are new changes on GitHub:

```bash
git checkout main # if you were trying out a pull request's branch
git pull
npm install       # only needed if new libraries were added; safe to run anyway
npm run dev       # also updates the database to match
```

- If the page still looks old, hard refresh the browser with **⌘ + Shift + R**.
- New settings show up in `.env.example`. Your `.env` isn't changed by `git pull`, so copy over any new lines you want. For example, `OLLAMA_MODEL` is now `"gemma3:4b"`.
- If you were using an older model, run `ollama pull gemma3:4b` (see step 2).

### Trying a pull request before merging it

Each pull request has its own branch (shown on the PR page, e.g. `tags-and-side-trays`). To run it without merging:

```bash
git fetch origin BRANCH-NAME
git checkout BRANCH-NAME
npm install
npm run dev
```

When you're done, stop the server (Ctrl+C) and go back with `git checkout main`. If it works, approve and merge the PR on GitHub, then `git pull` on `main`.

---

## Settings (`.env`)

| Setting | Default | What it does |
|---|---|---|
| `DATABASE_URL` | `file:../data/app.db` | Where your data is stored |
| `OLLAMA_URL` | `http://localhost:11434` | Where Ollama is running |
| `OLLAMA_MODEL` | `gemma3:4b` | Model used to sort, title, and summarize items |
| `OLLAMA_VISION_MODEL` | same as `OLLAMA_MODEL` | Model used to read images. If it isn't installed, the smallest other model that can see images is used. |
| `BRIGHTDATA_API_KEY` | (none) | Optional. A [Bright Data](https://brightdata.com) API key, used as a backup to read sites that block the app (HTTP 403), like allrecipes. Only the addresses of those pages are sent to Bright Data. It's a last resort: it runs only after a normal read fails, a page that was read is saved and never fetched again, and each page gets at most 2 Bright Data tries. The Terminal shows `[link] read … with Bright Data` each time it's used. |
| `BRIGHTDATA_ZONE` | `web_unlocker1` | The name of your Web Unlocker zone in Bright Data |
| `BRIGHTDATA_SERP_ZONE` | (none) | Optional. The name of your SERP API zone (for example `serp_api1`), used by Find and Answer Scouts to search Google. Only the search words are sent. The Terminal shows `[scout] searched … with Bright Data` each time. |

**Setting up Bright Data (optional):** in the Bright Data dashboard, add a **Web Unlocker** zone (the default name is `web_unlocker1`), then copy your API key from **Account settings → API keys**. Put both in `.env` and restart the app. Links that failed before are read again on restart. For Scouts, also add a **SERP API** zone (Light JSON is fine) and put its name in `BRIGHTDATA_SERP_ZONE`.

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
| A link shows its address instead of a title | Its page couldn't be read (the site blocked it, was slow, or you were offline). The Terminal shows `[link] couldn't read …` with the reason. For `HTTP 403`, the site blocks apps: set up the optional Bright Data key (see Settings). It's tried again in an hour, and right away when you restart `npm run dev`. |
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
| Web search for Scouts (optional) | [Bright Data SERP API](https://brightdata.com/products/serp-api) | Only when you run a Find or Answer Scout. Returns Google results as JSON. |
| Blocked sites (optional) | [Bright Data Web Unlocker](https://brightdata.com/products/web-unlocker) | Only when a site refuses the app (HTTP 403) and a key is set. Fetches the page the way a browser would. |
| Research papers | [Crossref](https://www.crossref.org) | A free database of journal papers. Gives the real title, journal, year, and often the abstract when a publisher's site blocks reading. |
| Styling | Plain CSS (`app/globals.css`) | A few colors and shapes; light and dark mode follow your system |

**What happens when you add something:**

1. It's saved and shows up right away with a pulsing dot.
2. For a link, the app reads the page's title and article text. YouTube, Vimeo, and TikTok titles come from their oEmbed service, and research papers from Crossref.
3. For a document, its text is pulled out. For an image, a model that can see images describes it.
4. Wordle scores go straight to **Wordle**. Everything else goes to the local AI, which picks a category (or makes a new one) and writes a short title and a summary. To pick, it sees each category with a few items already in it, plus the last 30 items you moved yourself.
5. If Ollama is off, simple keyword rules pick a category, and the AI redoes it later.

## Where things are

| Path | What |
|---|---|
| `app/page.tsx` | Hub page (`/`) |
| `app/inbox/page.tsx` | Brain Dump page (`/inbox`) |
| `components/Hub.tsx` | Canvas (pan and zoom) and the inbox side panel |
| `components/Inbox.tsx` | Category list (with New and drag and drop), add box and + menu, item rows, category menu |
| `components/Nav.tsx` | Page icons and the status dot |
| `lib/useInbox.ts` | Inbox data shared by both pages |
| `lib/sort.ts` | Sorting and titles: Wordle rule, AI, fallback rules, background re-sort |
| `lib/ollama.ts` | Talks to Ollama |
| `lib/link.ts` | Reads a link's title and description (cached) |
| `lib/files.ts` | Saves uploads and pulls text out of documents |
| `components/ItemView.tsx` | The tray view: summary, content, and notes, all editable, plus the category and project chips |
| `app/p/[id]/page.tsx`, `components/ProjectSpace.tsx` | The project space: the section grid, tasks, sources |
| `components/Writing.tsx` | Writing sections ([TipTap](https://tiptap.dev) editor) |
| `components/Projects.tsx`, `lib/useProjects.ts` | Project cards, lines between projects, and the New project box on the Hub |
| `lib/projects.ts` | Suggested kind and sections (AI, or a template), proposed steps for Auto projects, project colors |
| `app/api/projects/`, `app/api/sections/`, `app/api/tasks/`, `app/api/links/` | Make, change, reorder, and delete projects, sections, and tasks |
| `app/api/categories/` | Make, rename, recolor, and delete categories |
| `lib/colors.ts` | Category colors |
| `app/api/` | Server routes: `items` (list, add, change, delete), `files` (serve uploads), `status` |
| `prisma/schema.prisma` | The data model |
| `data/` | Your database and uploads (not in git) |
