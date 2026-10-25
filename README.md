# Oven

A home for messy personal projects that runs entirely on your own computer.

- **Hub** (`/`): an infinite canvas with a card for each project, and the Pantry on the side.
- **Project space** (`/p/...`): one project's writing, tasks, and sources, laid out in a grid you arrange. Projects are either **Manual** (you do the work) or **Assisted** (the AI proposes steps).
- **Pantry** (`/inbox`): drop in anything (notes, links, images, documents). Local AI sorts each item into a category and gives it a short title.
- **Tasks** (`/tasks`): everything with a deadline, time, or priority, from the Pantry and every project.

Everything is stored in one file on your computer, and the AI runs locally with [Ollama](https://ollama.com). No account and no API key are needed, and nothing leaves your machine except reading the links you add. (Optional exceptions: if you set up Bright Data, the addresses of sites that block reading, and the search words of Scouts you run, are sent to it. If you set up Cartesia, what you record with the mic is sent to it. See [Settings](#settings-env).)

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
| Tray icon | The Pantry page |
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
- **Starting categories:** Recipes, Events, School, Home, and Other. The AI makes new ones when nothing fits. (An empty Wordle category from before is swapped for these.)
- **Hub:** drag the background or scroll with two fingers to move around. Pinch (or hold Ctrl and scroll) to zoom. The button at the top right shows or hides the side panel, which has two tabs: **Pantry** and **Tasks**.
- **Tasks** (the calendar icon in the sidebar, next to the Pantry icon; also a tab in the Hub's side panel): everything with a date, time, or priority, from the Pantry and from every project's tasks, grouped as Late, Today, Tomorrow, Later, and No date, with the last 10 you checked off in **Done** at the bottom (uncheck one to bring it back). Check one off there, or click its date to change the date, time, or priority. **Add a task** at the top puts a new item in the Pantry, due today unless you pick a date with the calendar icon next to it. Type the date in words or numbers ("today", "tomorrow", "fri", "next mon", "in 3 days", "10/27", "oct 27"); and the time the same way ("5pm", "9:30am", "17:30", "noon"; a bare 1 to 6 means PM). The line under each shows what it read, and both are saved when you press Enter or click away. Elsewhere, set a date, time, and priority with the calendar icon on a project task, on a Pantry row (next to the trash can when you hover), or in an item's tray. Tasks the AI writes with "Due: 2026-10-30" get that date.
- **New project:** click **+** at the bottom left of the Hub and describe it in one sentence ("replace the ceiling fan in my bedroom"). The AI suggests a name and **Manual** or **Assisted**, and you can change either. The kind is set here only. After **Create**, the new card appears on the Hub and you stay there; click it to open it.
  - **Manual** is a workspace you set up. You get the AI's suggested sections: change a section's type or name, drag the handle on its left to reorder, remove it with ×, or add more with **+ Writing**, **+ Tasks**, and **+ AI** (a line under them says what each one is). The **Project Dump** is always there, so it's shown apart (dashed) rather than as a section you edit. Every project gets one: its own links, files, and notes. With the AI off, the closest built-in template is used (Research Paper, Class, Event, Learning, or Utility Task).
  - **Assisted** lets the AI break the project into steps. Give it links, notes, or items **From inbox** to work from (all optional). Links you paste become sources.
- **Project cards:** the card is filled with the project's color. Drag it to move, click to open. The ⋯ menu renames it, changes its color, or deletes it. Drag the bottom-right corner to resize it. Drag a Pantry item onto a card to add it to that project.
- **Linking projects:** hover over a card and drag a circle on any side onto another card. Circles show on nearby cards as the line gets close. The line runs from the circle you pulled to the circle on the side of the other card nearest where you let go. Linked projects show each other's sources. Click a line to change its color or remove it.
- **Inside a project:**
  - **Writing** sections have formatting (bold, italic, headings, lists) in a small bar that shows while you type. ⌘B and ⌘I work too.
  - **Tasks:** check off, reword, and add.
  - **Assisted projects:** after you create one, the AI lays it out (this can take a minute): one **Overview** with a heading for each part (how it works, what to look for, what to do if something goes wrong), read-only, one **To do** list, and **Resources**. Delete any section you don't need with its trash icon, and add your own with **+ Section**.
  - **Resources** is a read-only list of pages, each with a short summary. Click anywhere on one to open it in a new tab. The refresh icon in its header adds more (a slightly different search each time, so each press is one Bright Data search; pages that don't mention the project's main words are left out). Hover over a page for **+**, which moves it to the Project Dump with its title and summary (so it isn't read again), and ×, which removes it. Neither comes back with More. The pages come from a web search when Bright Data's SERP API is set up, otherwise from well-known sites the AI suggests, with dead links removed.
  - **Project Dump:** this project's own items, grouped by category like the Pantry. Paste a link, write a note, speak one with the mic, or upload a file; these show in the Pantry too, marked with the project. Scout results you save (+) go here too. **From Pantry** adds something from the Pantry that isn't in a project yet; it stays in the Pantry. × takes an item out of the project (it stays in the Pantry).
  - **AI** sections answer requests (a long answer scrolls inside its box) about what's already in the project, on the local AI: "make tasks for this project", "make my Introduction sound formal", "how does this paragraph sound?", "make APA citations for my sources". It reads the project's writing, tasks, and Project Dump, plus any links you paste. Answers stay in the section, newest first. **Add as tasks** or **Add to project** turns one into a section.
  - **Arranging:** drag a section by the handle in its header onto another section's edge. Left or right puts them side by side, and top or bottom stacks them. ↔ switches a section between half and full width. A half-width section with nothing next to it fills its row, so there are no gaps.
  - **Scouts** (on the left) use the web, and run when you press **Run**. Click **+**, write what you need, and check the kind (it's guessed from your words):
    - **Find** finds real options and lines them up to compare, like fans with their price and size. **+** saves one to the Project Dump.
    - **Answer** searches the web, reads a few pages, and writes a short answer. Each point links to its page. Without Bright Data it answers from the local AI and says so.
    - **Add to project** puts the result in a new section. **Send to Scouts** (the magnifier on a task) starts a Scout from that task, and the task is checked off when the Scout finishes. Each run uses at most 3 searches (one that fails or times out is tried once more) and 6 page reads, and the same search isn't paid for twice within a week. (Scouts from before can be **Turn into**: that job is now the AI section's.)
- **Unsorted / In projects:** under the Pantry's search box, **All** shows everything, **Unsorted** shows what isn't in a project yet, and **In projects** shows what is. An item in a project shows the project's name under it; click it to open the project.
- **Search:** type in **Search** under the Pantry's capture box. It looks in titles, notes, links, file names, and summaries. Projects that match show above the items: by name, goal, writing, tasks, or anything in their Project Dump, with the words that matched. Click one to open it.
- **Speak a note:** press the mic in the capture box and talk. The words show up in the box as you speak. Press it again to stop. If the box was empty when you started, the note saves itself when you stop (handy on a phone or in the car); otherwise the words are added to what you wrote. Needs `CARTESIA_API_KEY`. The mic streams straight to Cartesia's live speech to text (Ink 2) with a short-lived token from the app, so your API key never reaches the browser. If the live connection can't open, it falls back to sending the recording in 3-second pieces (Ink-Whisper), where the words show up every few seconds and a word right at a break can come out split.
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
| `BRIGHTDATA_SERP_ZONE` | (none) | Optional. The name of your SERP API zone (for example `serp_api1`), used by Find and Answer Scouts and Resources to search Google. Only the search words are sent. The Terminal shows `[scout] searched … with Bright Data` each time. |
| `CARTESIA_API_KEY` | (none) | Optional. A [Cartesia](https://cartesia.ai) API key, for the mic (live speech to text with Ink 2, or Ink-Whisper as a fallback). Only your recording is sent, and only while the mic is on. The browser gets a 10-minute token that can only transcribe, never the key. |

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
| A Scout says "the answer wasn't JSON" | Bright Data sent something other than search results. The message shows the start of what it sent (often an error about the zone). Check that `BRIGHTDATA_SERP_ZONE` is the exact name of an active SERP API zone. The Terminal shows the full answer after `[scout] search gave back`. |
| The mic says it's blocked | Allow the microphone for localhost in the browser's site settings. |
| The words only show up every few seconds | The live connection to Cartesia didn't open, so the mic fell back to pieces. Check the Terminal for `[voice]` lines, and that your network allows `wss://api.cartesia.ai`. |
| AI answers are slow | The first answer after starting waits for Ollama to load the model; the app now loads it as soon as a page is open and keeps it loaded for 30 minutes. Check `ollama ps` shows the model at `100% GPU`. Closing other big apps helps. A smaller model is faster but sorts less well: `ollama pull gemma3:1b` and set `OLLAMA_MODEL="gemma3:1b"` in `.env`. |
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
| Web search for Scouts (optional) | [Bright Data SERP API](https://brightdata.com/products/serp-api) | Only when you run a Find or Answer Scout, make an Assisted project, or ask Resources for more. Returns Google results as JSON. |
| Speech to text (optional) | [Cartesia](https://cartesia.ai) Ink 2 (live, over a WebSocket) and Ink-Whisper (fallback) | Only while the mic is on. Turns your voice into text as you speak. |
| Blocked sites (optional) | [Bright Data Web Unlocker](https://brightdata.com/products/web-unlocker) | Only when a site refuses the app (HTTP 403) and a key is set. Fetches the page the way a browser would. |
| Research papers | [Crossref](https://www.crossref.org) | A free database of journal papers. Gives the real title, journal, year, and often the abstract when a publisher's site blocks reading. |
| Styling | Plain CSS (`app/globals.css`) | A few colors and shapes; light and dark mode follow your system |

**What happens when you add something:**

1. It's saved and shows up right away with a pulsing dot.
2. For a link, the app reads the page's title and article text. YouTube, Vimeo, and TikTok titles come from their oEmbed service, and research papers from Crossref.
3. For a document, its text is pulled out. For an image, a model that can see images describes it.
4. Wordle scores go straight to **Wordle** (made the first time one comes in). Everything else goes to the local AI, which picks a category (or makes a new one) and writes a short title and a summary. To pick, it sees each category with a few items already in it, plus the last 30 items you moved yourself.
5. If Ollama is off, simple keyword rules pick a category, and the AI redoes it later.

## Where things are

| Path | What |
|---|---|
| `app/page.tsx` | Hub page (`/`) |
| `app/inbox/page.tsx` | Pantry page (`/inbox`) |
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
| `lib/projects.ts` | Suggested kind and sections (AI, or a template), the Assisted project layout, Resources, project colors |
| `lib/scouts.ts`, `components/Scouts.tsx` | Scouts: web search (Bright Data SERP), reading pages, Find and Answer |
| `lib/assistant.ts` | AI sections: answers about what's in the project |
| `components/Mic.tsx`, `app/api/transcribe/` | The mic: streams to Cartesia and shows the words as you speak (`token/` makes the short-lived token; the route itself is the 3-second-piece fallback) |
| `app/api/search/` | Finds projects for the Pantry search |
| `components/Agenda.tsx`, `components/TasksPage.tsx`, `app/tasks/`, `components/Due.tsx`, `app/api/agenda/`, `lib/due.ts` | The Tasks page and tab, and setting a date, time, and priority |
| `app/api/projects/`, `app/api/sections/`, `app/api/tasks/`, `app/api/links/` | Make, change, reorder, and delete projects, sections, and tasks |
| `app/api/categories/` | Make, rename, recolor, and delete categories |
| `lib/colors.ts` | Category colors |
| `app/api/` | Server routes: `items` (list, add, change, delete), `files` (serve uploads), `status` |
| `prisma/schema.prisma` | The data model |
| `data/` | Your database and uploads (not in git) |
