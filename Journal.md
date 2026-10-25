# Journal

The running log for Oven: what's done, what's next, and why. Newest entries go at the top of **Log**. The plan (`Project_Scaffold_Plan.md`) says what we're building; this file says what actually happened.

> **Read-only for contributors.** Read this for context on how the app works and why. Please don't edit it in your PRs: Mehvish's Claude updates it when each PR is merged. (The plan itself isn't in the repo.)

---

## Now

**Working on:** Project Dump items staying in the Pantry, with an Unsorted / In projects filter, and the project kinds renamed Manual and Assisted (PR #13). Next: a voice feature for the Cartesia track, once Mehvish picks one (`plans/cartesia-voice.md`).
**Done:** F1 Smart Inbox, now called Pantry (PR #5, renamed Brain Dump in PR #7, Pantry in round 8), F3 + F4 first version (PR #6, merged).

## Setup and running (current)

Full steps are in the app's README. In short:

- **Needs:** Node.js 20+, Ollama with one model (`ollama pull gemma3:4b`), and the repo, cloned into `project_manager/app`.
- **First time:** `cp .env.example .env`, then `npm install`, then `npm run setup`.
- **Run:** `npm run dev`, then open http://localhost:3000. This also updates the database.
- **Update:** `git checkout main`, then `git pull`, then `npm install`, then `npm run dev`. Hard refresh with ⌘ + Shift + R if the page looks old.
- **Try a PR first:** `git fetch origin BRANCH`, then `git checkout BRANCH`, then `npm run dev`. When you're done, `git checkout main`.
- **`.env` settings:**
  - `OLLAMA_MODEL="gemma3:4b"`.
  - Optional: `BRIGHTDATA_API_KEY` and `BRIGHTDATA_ZONE="web_unlocker1"`, for sites that block reading.
  - `git pull` never changes `.env`, so copy new lines over from `.env.example`.
- **Don't use:** `llama3.2-vision`, which doesn't run on Ollama 0.30+. `llama3.2:3b` is no longer needed.

## To do

Ordered. Feature numbers match the plan.

- [ ] Try 20 real items with Ollama; note which ones the AI gets wrong (F1)
- [ ] Tune the sorting prompt with those misses (F1)
- [ ] Undo after deleting an item (F1)
- [ ] Check Bright Data on the Mac: paste the allrecipes link, look for `[link] read … with Bright Data` (F1)
- [ ] Service Scout with Bright Data SERP API + Web Unlocker (F5, Bright Data prize)
- [ ] Try PR #8 on the Mac with gemma3:4b: make a Space and an Auto project and check the sections and proposed steps
- [ ] Try a Find Scout again with PR #10. If it still fails, copy the `[scout] search gave back` line from the Terminal
- [ ] Add `CARTESIA_API_KEY` to `.env` and try the mic
- [ ] Decide on Factory Droid SDK or Fetch.ai for the Scouts (F5)
- [ ] Status dot shows offline too, not just AI on or off (F6)
- [ ] Seed script for the demo
- [ ] Notability: keep process notes and sketches there for the Notability track

## Done

- [x] Plans reworked for 24 hours, solo, minimal UI (2026-10-24)
- [x] App skeleton: Next.js 15, Prisma 6 + SQLite, Ollama client (2026-10-24)
- [x] Smart Inbox page: capture, auto-sort, change category, new category, archive (2026-10-24)
- [x] Hub page: pan and zoom canvas, inbox panel that can be hidden (2026-10-24)
- [x] GitHub repo for the app only: m3v113/calhacks13, first commit pushed (2026-10-24)
- [x] First run on the Mac: installed, pushed, and tested by Mehvish (2026-10-24)
- [x] Feedback round 1: Hub at root, + menu, uploads, AI titles, README (2026-10-24, PR #1)
- [x] Feedback round 2: full view, delete, theme switch, image re-sorting, hover labels, real link titles (2026-10-24, PR #2, merged)
- [x] Trays: summaries, notes, editing, working images (2026-10-24, PR #3, merged)
- [x] Side trays, New category and drag-to-tag in the sidebar (2026-10-24, PR #4, merged)
- [x] Edit and delete categories, change category in a tray, AI learns from moves, Bright Data backup for blocked links, inbox final pass (2026-10-24, PR #5, merged)
- [x] F3 + F4: project cards on the Hub, new project from one sentence, project space with tasks, notes, linked items, and summary, plus a project chip in the tray (2026-10-24, PR #6, merged)
- [x] Projects round 2a: Auto vs Space, Writing/Tasks/Sources sections in a grid, formatting, Sources that add to the inbox, bigger cards, links between projects (2026-10-24, PR #8, merged)
- [x] Scouts (Find, Answer, Turn into) with Bright Data SERP, Resources in Auto projects (2026-10-24, PR #9, merged)

---

## Log

### 2026-10-25 · Project Dump items stay in the Pantry (PR #13)

- **Change of plans:** adding something to a Project Dump no longer takes it out of the Pantry. The Pantry now lists everything, and an item in a project shows the project's name under it (click it to open the project).
- **Filter:** All, Unsorted, and In projects under the Pantry's search box. Unsorted is what isn't in a project yet.
- An item is still in one project at a time (`Item.projectId`). **From Pantry** in a project and in the New project box only offers Unsorted items, so picking one never pulls it out of another project. × in a Project Dump takes it out of the project only; deleting a project leaves its items in the Pantry as Unsorted.
- Category counts in the sidebar now count project items too.
- **Space and Auto are now Manual and Assisted** (Mehvish's pick). Only the names changed: `lib/names.ts` has them, and the stored kind is still `space` or `auto`.

### 2026-10-25 · Done group in Tasks, no lock icon (PR #12)

- Checked-off tasks used to just disappear from Tasks. Now the last 10 (Pantry items and project tasks that had a date, time, or priority) show in a **Done** group at the bottom, newest first, struck through. Unchecking one puts it back in its group.
- New field `doneAt` on `Item` and `Task`, set when something is checked off and cleared when it's unchecked. Things checked off before this change have no `doneAt`, so they don't show in Done. `npm run dev` adds the field with `prisma db push`, so restart it once.
- **No lock icon** next to Project Dump in the New project box; the dashed row already sets it apart.

### 2026-10-25 · Typed dates and times, new projects stay on the Hub (PR #11)

- **The date is typed now**, because the browser's date field kept losing what Mehvish picked. `parseDate` in `lib/due.ts` reads "today", "tomorrow", weekdays ("fri", "next mon"), "in 3 days", "2w", "10/27", "10/27/2026", "oct 27", "27 oct", and "2026-10-27". A date without a year is the next one to come. The line under the box shows the day it read, or a hint when it can't read it. It's saved when the menu closes (Enter, a click outside, or Escape), so the row doesn't jump to another group while you type.
- **Time is typed too** (`parseTime`): "5pm", "5:30 pm", "9a", "17:30", "1730", "noon", "midnight". A bare hour from 1 to 6 means afternoon, 7 to 11 morning. It's saved with the date when the menu closes. (A half-hour list came first; Mehvish preferred typing.)
- **New projects stay on the Hub:** Create adds the card and closes the box, instead of opening the project.
- **Tasks list:** the groups are now headings inside one list, so a row keeps its open menu when it moves to another group.

### 2026-10-25 · Round 8: the app is Oven, the Brain Dump is the Pantry (PR #10)

- Mehvish renamed the app to **Oven** and the Brain Dump to **Pantry**. Both names live in `lib/names.ts`, so the UI, page titles, and tooltips follow. The package is `oven`, and the README, `CLAUDE.md`, `.env.example`, and code comments use the new names. Entries below this one keep the names used at the time.
- A project's own section stays **Project Dump**. Old project sections still titled "Brain Dump" or "Sources" are renamed to Project Dump on load.
- The GitHub repo (`m3v113/calhacks13`) and the Mac folder (`project_manager`) keep their names.

### 2026-10-25 · Round 7: date fixes, project search, read-only Overview (PR #10)

- **Dates said "No date" after picking one:** each change in the date menu was saved on its own, and the list reloaded after each save. A reload that came back late could replace newer choices, so the menu showed a date that the list didn't have. Now the menu keeps its own copy while it's open, every change sends date, time, and priority together, and only the newest reload counts (in the Tasks list and the Brain Dump). Typed dates and times are also read again when you leave the field. Safari-style date fields (Mehvish's browser) couldn't be tested here, only Chromium.
- **Calendar button** on Brain Dump rows is now to the left of the trash can, shown on hover. The date itself stays under the title.
- **AI answers** scroll inside their box (at most 420 px tall), so a long answer doesn't take over the page.
- **Overview is read-only:** a new `overview` section type, shown as formatted text without the editor. Existing Auto-project Overviews are converted on load. The AI section still reads it.
- **Search finds projects:** `GET /api/search?q=` looks at each project's name, goal, context, section titles, writing, tasks, and Project Dump items, and returns up to 8 with the words that matched. They show above the Brain Dump results.

### 2026-10-25 · Round 6: live mic, Project Dump, Tasks page, speed (PR #10)

Mehvish tried round 5 on her Mac. Added to the same PR.

- **Words didn't appear while speaking:** the mic now streams to Cartesia's live speech to text (`wss://api.cartesia.ai/stt/turns/websocket`, model `ink-2`, raw 16-bit audio at 16 kHz). Cartesia sends each turn's words as they're heard (`turn.update`) and the final text when you pause (`turn.end`). The browser gets a 10-minute token that can only transcribe (`POST /api/transcribe/token`, which calls Cartesia's `/access-token`), so the key stays on the server. If the live connection can't open, the old 3-second pieces are the fallback. Tested with a mocked WebSocket, not yet against Cartesia itself.
- **The Brain Dump side panel on project pages is gone.** Each project's own section is now the **Project Dump** (old "Brain Dump" and "Sources" titles are renamed on load). **From Brain Dump** moves items in from the Brain Dump, × sends one back. Scouts, Resources, and the AI section all say Project Dump.
- **Tasks has its own page** (`/tasks`), behind a calendar icon in the sidebar next to the Brain Dump icon, which is where Mehvish looked for it. It has an **Add a task** box (a Brain Dump item due today unless you pick a date) and each date can be changed in place. The Hub panel's Tasks tab stays. Brain Dump rows get a calendar button on hover, so you don't have to open the tray.
- **Faster:** Ollama now keeps the model loaded for 30 minutes (`keep_alive`), and the app loads it as soon as a page is open, so the first answer doesn't wait for it to load. Plans ask for 3 or 4 parts with a token cap, the wait for a project's links to be read is 8 seconds at most (was 30), and with web search the Resources section shows right away while the AI writes the rest. A smaller model (`gemma3:1b`) is faster still but sorts less well; left as a choice in the README.

### 2026-10-25 · Round 5: project Brain Dumps, Tasks tab, fixes (PR #10)

Mehvish tried round 4 on her Mac. Added to the same PR.

- **Add as tasks made an empty section:** gemma wrote the list inside the reply ("1. … 2. …") and left items empty. The server now splits such a reply into items, and the page does the same for answers saved before. "Due: 2026-10-30" at the end of a task becomes its date.
- **Starting categories:** Recipes, Events, School, Home, Other (Wordle was too niche). An empty Wordle starter is swapped on the next load, and a Wordle share still makes its own. The sorting prompt now says to pick an existing category only when the item really is that kind of thing (homework had gone to Recipes). There's a School keyword rule for when the AI is off.
- **Gaps in the layout:** halves between full-width sections now go into two columns that stack on their own, alternating, instead of rows. A short half no longer leaves a hole under it.
- **Each project's Brain Dump is its own:** the main Brain Dump (`GET /api/items`) lists only items with no project, so it's the place for things still to be sorted. Adding to a project, dragging onto a card, saving from a Scout, or moving from Resources all put the item only in the project. × or dragging back to the panel moves it back.
- **Resources:** each page has + (move to the project's Brain Dump, with its title and summary, so the page isn't read or summarized again; only the category is picked) and ×. Removed pages are remembered, so More doesn't bring them back. More now runs a slightly different search each time ("… tutorial", "… tips", …) before later pages. The second page of the same search had drifted to unrelated "SOLVE" sites for a Rubik's Cube project. Pages that don't mention two of the project's main words are left out.
- **Find tags:** "Price: Price: Under $10" loses the repeated label, and "N/A" values and options named "N/A" are dropped.
- **New project box:** the Brain Dump row is dashed with a lock and a line on what it is. A line under + Writing, + Tasks, and + AI says what each one is. + AI is new there.
- **Mic shows text while you speak:** it records in 3-second pieces, each its own recording, and each is transcribed with the same Cartesia call as it comes in. The total audio sent is the same. A word at a break can be split. Cartesia's streaming WebSocket would avoid that, but it needs a key or token in the browser, so it was left for later.
- **Lines from the circle you drew from:** `ProjectLink.fromSide` and `toSide` are new fields. The other end is the side of the target card nearest where you let go. Old lines use the sides that face each other.
- **Tasks tab (new):** Brain Dump items and project tasks can have a date, time, and priority (`dueDate` "YYYY-MM-DD", `dueTime` "HH:MM", `priority` 1–3, plus `Item.done`). `GET /api/agenda` lists everything that has one and isn't done, soonest first. On the Hub, the side panel has Brain Dump and Tasks tabs. The calendar icon on a task, or in an item's tray, sets them.
- **New fields:** `Item.dueDate/dueTime/priority/done`, `Task.dueDate/dueTime/priority`, `ProjectLink.fromSide/toSide`. `prisma db push` adds them without touching data.

### 2026-10-25 · Round 4: Resources, AI section, project Brain Dump, mic (PR #10)

Mehvish's round 4 feedback, after trying PR #9 with real search.

- **"The answer wasn't JSON" (Find failed after a long wait):** the cause on her Mac is still unknown, so the search now handles every shape Bright Data can send. Google's page (HTML) is read for its result links. Anything else, like a plain-text error or an empty answer, gets one more try asking for Bright Data's wrapped JSON (`format: "json"`, results in `body`). If that fails too, the message shows the start of what Bright Data sent.
- **Resources is read-only:** a new section type, `resources`. It's stored as JSON (the search words, how far into the results it is, and the pages), and shown like Scout results. The whole row is the link. The refresh icon fetches the next page of the same search (`&start=10`, one paid search per press), or more AI-suggested sites without search. It can't be deleted. Old Resources Writing sections are converted on the first page load.
- **Auto projects are one Overview:** one full-width Writing section with a heading per part, one To do from the checklists, and Resources, instead of 4–6 sections. Mehvish found it too much text. Tasks stay a separate section so they can be checked off and sent to Scouts.
- **AI section (`assistant`):** added with + Section → AI. It answers requests about what's in the project, on the local AI: make tasks, rewrite formally, feedback, citations. It reads the writing, tasks, Brain Dump (with page text), and links pasted in the request. Answers are kept in the section (last 10). Add as tasks / Add to project make sections.
- **Turn into moved to the AI section** (Mehvish's choice on a decision card). Scouts are just Find and Answer, the ones that use the web. Old Turn into Scouts still show and can be re-run.
- **Task checked off:** a Scout sent from a task stores `taskId` and checks the task when it finishes. The page reloads when Scouts stop running.
- **Citations:** one per paragraph with a hanging indent, *italic* where the AI marks it, and links. Same in Writing when added.
- **Scout explanations:** two sentences each, with examples.
- **Layout without gaps:** sections are laid out in rows of two halves or one full width. A half with no half next to it fills its row. Dropping one beside another keeps them in the same row (the half before them goes full width if it would pair instead).
- **Project Brain Dump:** grouped by category like the main one. A panel icon on the project page shows the main Brain Dump on the right. Drag from it into the project's Brain Dump to add, and drag back out to remove.
- **Brain Dump search:** under the capture box, in titles, notes, links, file names, and summaries.
- **Mic (Cartesia Ink-Whisper):** records in the browser, `/api/transcribe` sends it to Cartesia's `/stt` with `CARTESIA_API_KEY`. With an empty box, the note is saved right away (for phone or driving).
- **New field:** `Scout.taskId`. `prisma db push` adds it without touching data.

### 2026-10-24 · Scouts (PR #9)

Scouts are built, following plan section 3. They run only when you press Run.

- **One engine, three kinds:** Find (options to compare), Answer (short points, each citing its pages), Turn into (sources → tasks, citations, a table, or an outline). The kind is guessed from the brief's words (`lib/scoutKind.ts`) and can be changed.
- **A run:** the local AI writes 1–3 searches → Bright Data SERP API (`data_format: "parsed_light"`, set per call, so the zone's own format setting doesn't matter) → the top 6 pages read with `readLink` (direct first, Web Unlocker only if blocked, cached) → the local AI pulls out the result. Progress is saved at each step and shown live.
- **Round 3 feedback** (Mehvish tried Scouts with real search: Find worked):
  - **Resources in every Auto project:** with the SERP API, one search per new Auto project (`<goal> guide`) gives the Resources section and extra context for the planner. Without it, the AI suggests sites. Links the AI writes (Markdown or bare) become real links, and ones whose page doesn't load become plain text.
  - **Links open on press** in Writing sections. Clicking didn't work: focusing the editor shows the toolbar, which moves the text before the click lands.
  - **Sources is now Brain Dump**, the same name as the inbox (`names.inbox`). Old "Sources" sections are renamed on the first page load.
  - **Auto lag fixed:** in `next dev` each route can load its own copy of `lib/projects.ts`, so the "planning" set the create route filled wasn't the one the project page read. The sets live on `globalThis` now, and the page also checks back while a new Auto project only has its Brain Dump.
  - **Find tags:** values must look like values (short, and with a number for price, size, rating...). Fields no option has are dropped.
  - **Slow searches:** 60s limit, and one more try after a timeout or a 5xx.
  - **Scout kinds** each have a one-line explanation under the switch.
- **Auto sections are just there:** no more "The AI suggested… Keep all" or ✓/× on each one. Mehvish found having to keep sections confusing. You delete the ones you don't want. Old proposed sections and tasks are marked kept on the first page load.
- **Costs:** at most 3 searches and 6 page reads per run. Searches are cached for 7 days (`SearchCache`), so a re-run with the same searches costs nothing.
- **Guards:** results that point at pages that weren't read are dropped. Without `BRIGHTDATA_SERP_ZONE`, Find says web search isn't set up, and Answer uses the local AI only and says so.
- **Keeping results:** + on a Find option saves it to Sources (and the inbox). Add to project makes a section: Turn-into tasks become a Tasks section, everything else Writing with links.
- **Send to Scouts:** a magnifier on each task opens a new Scout with the task's text.
- **New tables:** `Scout` and `SearchCache`. `prisma db push` adds them without touching data.

### 2026-10-24 · Auto layout and creation fixes (PR #8)

- **Auto sections:** the AI now picks each section's shape: a short explanation, key points, facts ("Size: 52 in"), or a checklist (at most 2). Only checklists are Tasks; the rest are Writing. Sections are half width, so they sit side by side. Mehvish found the step-and-subtask layout overwhelming.
- **Tasks** wrap onto more lines, and AI tasks are no longer cut at 60 characters.
- **New project box:** a lock on Sources (it can't be removed), and From inbox opens inside the box and scrolls (the Hub was catching the scroll).
- **Link circles** are smaller (10px), with a bigger invisible area to grab.

### 2026-10-24 · TikTok reading and the Brain Dump name (PR #7, by Danielle, merged)

- **TikTok links:** TikTok's oEmbed sometimes gives only an iframe, so the app reads the caption, creator, and cover from the public page's data. `/photo/` links work too. Old cached TikTok reads with the generic "TikTok - Make Your Day" title are read again.
- **Instagram:** a logged-out error page counts as a failed read, so Bright Data can try it (still at most 2 tries per page).
- **Titles:** long captions are treated as page text, so the local AI writes a short title instead of copying the caption.
- **Renamed:** Smart Inbox is now **Brain Dump** (`lib/names.ts`). Mehvish chose to keep the new name.

### 2026-10-24 · Projects round 2a redesign (PR #8)

Mehvish tried round 2a and didn't like the cards or the new-project box. Changes:

- **Cards:** filled with the project color (text turns white or dark to stay readable). The Space/Auto word is gone. A ⋯ menu renames, recolors, or deletes. Link circles sit on all four sides and show on nearby cards as a line approaches.
- **New project:** each kind has a one-line description. The kind is chosen only here; the switch inside a project is gone.
  - Space: sections can be reordered with a handle, and **+ Writing** / **+ Tasks** buttons add more inline.
  - Auto: no sections at creation. Instead you give links, notes, or inbox items. Pasted links become sources.
- **Auto projects:** after creation the AI plans 4–7 step sections, each with an explanation and subtasks, always including Troubleshooting. They show as proposed (keep or drop). The planner gets a 240s timeout, because the 60s default likely cut off gemma3:4b before. You add other sections yourself inside.
- **Sections:** a visible grab handle on each header.
- **New section type `step`** (explanation + subtasks). Kind can no longer be changed through the API.
- **Bright Data SERP zone:** Mehvish made `serp_api1` (Standard, pay as you go). Data format: Light JSON, since Scouts only need title, link, and description. The Scout code will also set the format per call.

### 2026-10-24 · Projects round 2a (PR #8)

Mehvish's feedback on PR #6 led to a new plan, `plans/Projects_v2_Plan.md` (not in the repo). This PR builds round 2a of it.

- **Auto vs Space:** the AI guesses the kind and you switch it, both when you create a project and inside it.
  - Space is a workspace you configure.
  - In Auto, the local AI proposes 4–8 steps, each with a how-to line. You keep or drop each one (a dimmed step with ✓ and ×, or Keep all).
  - Researched steps come with Scouts in 2c.
- **Sections are Writing, Tasks, and Sources:**
  - Old databases are upgraded on the first page load: notes → writing, items → sources, and help nearby is removed.
  - Every project has exactly one Sources section.
  - The AI suggests several Writing sections named for the project (Outline, Introduction, Literature Review...).
  - The new-project box lets you change each section's type and name, remove sections, and add as many as you like.
- **Writing sections** use TipTap (bold, italic, H1, H2, lists), with a toolbar that shows while you type. Old plain-text notes become paragraphs.
- **Grid layout:** sections sit in two columns and can be half or full width.
  - Drag a header onto another section's edge. Left or right puts them side by side, and top or bottom stacks them.
  - Dragging now uses pointer events, because the old HTML drag-and-drop handle didn't work on Mehvish's browser.
- **Sources:**
  - Add a link, note, or file right there. It's also added to the inbox and sorted.
  - The From inbox picker has category filter chips and groups results by category.
  - Linked projects' sources show under their name.
- **Summary removed** and replaced by an empty Scouts panel. The `overview` columns stay in the database so `prisma db push` doesn't need to drop data.
- **Hub:**
  - Cards are bigger (260×120) and can be resized from their corner. You can edit the title on the card and change the color from its square.
  - The number on the card is gone. It counted linked items.
  - Drag the circle on a card's right edge to another card to link the two projects. Lines can be recolored or removed.
  - The palette grows to 20 colors, for categories too.
- **Scouts design** (plan section 3, simplified after Mehvish asked): three general Scouts on one engine.
  - **Find** gives options to compare.
  - **Answer** gives a write-up with citations.
  - **Turn into** reshapes pages or sources into tasks, citations, or tables.
  - They use the Bright Data SERP API plus Web Unlocker (only for blocked pages), with a cap per run, a cache, and they run only when you press Run.
- **Workflow:** `Journal.md` and `CLAUDE.md` are now in the repo (PR #6). Contributors read the journal but don't edit it, and Mehvish's Claude updates it with each merged PR.

### 2026-10-24 · Projects on the Hub and project spaces (PR #6)

- **Hub cards:** each project is a card on the canvas. Drag a card to move it, and the spot is saved. Click a card to open its project. Drop an inbox item from the side panel onto a card to link that item to the project, and the card shows how many items it has.
- **New project:** the + at the bottom left takes one sentence. gemma3:4b suggests a name and 2–5 sections from four types: tasks, notes, items, and help nearby.
  - If the AI's answer doesn't fit (duplicate types, or fewer than 2 sections), or the AI is off, the closest template is used.
  - You review the suggestion before anything is made, and can rename it or remove sections.
- **Project space (`/p/[id]`):**
  - Editable title, a color picker, and delete. Deleting a project keeps its items in the inbox.
  - Sections can be reordered by dragging and added with + Section.
  - Tasks can be checked off. Notes save as you type.
  - The Items section lists linked inbox items and opens them in the usual tray. Add from inbox has search.
  - Help nearby is a placeholder until F5.
  - The summary is written by the AI when the project is made and again on ↻. Writing your own stops the AI from replacing it.
- **Tray:** a project chip next to the category chip, to move an item to another project or out of one.
- **Tested** with a stand-in AI and a browser: every flow works and stays after a reload. Dark mode and phone width checked. Still needs a real-model try on the Mac.

### 2026-10-24 · Inbox final pass, project spaces plan, cleanup (PR #5)

- **Fixed:**
  - **Journal.md titled "Banana Banana Bread":** the AI copied the title from the example items shown to help it pick a category. The prompt now marks those clearly as other items, and documents that start with a heading are titled by it ("Journal").
  - **Slow and stuck summaries:** long pages and documents are cut to about 7,000 characters, so a small model answers faster. After 3 runs without a summary, retries stop. The tray says so, and ↻ tries again. After 45 s of waiting, the tray says it's still working.
  - **Banana bread note sorted to Other:** if the AI picks Other (or invents a category) while the item names an existing category ("banana bread" → Banana Bread), the named one wins.
- **Added:**
  - **Link previews in the tray:** the page's preview picture (og:image or a video thumbnail) and its description. Older links get their picture the first time they're opened.
  - **Rows:** the trash is at the top right, with the category under it in a fixed column so the names line up. Category dots are centered.
- **Checked:** the inbox page and the Hub panel (tray, chips, drag to chip, phone width) with Playwright and a stub model.
- **Plan:** F3 (projects on the Hub) and F4 (project space) are finalized in the plan, with a 6-step build order.
- **Cleanup (Mehvish asked):** deleted `plans/pre/` (old plans and mockups), `smart_inbox.html`, and the old `schema.prisma`. Kept `prizes.jpeg`, now in `plans/`.

### 2026-10-24 · Blocked links and Bright Data (PR #5)

- **What:**
  - Links are now read with browser-like headers and a 12 s timeout.
  - When a site still refuses (allrecipes returned HTTP 403), Bright Data's Web Unlocker reads it, if `BRIGHTDATA_API_KEY` is set.
  - While a link is unread, the row shows a readable name taken from its address.
- **Cost rules (Bright Data is paid):**
  - It's only used after a normal read fails.
  - A page that was read is saved in `PageCache` and never fetched again, so refreshing the page costs nothing.
  - Each page gets at most 2 Bright Data tries ever (`unlockTries`).
  - Two sorts of the same link share one read.
- **Why Bright Data over context.dev:** Web Unlocker is built for getting past blocks, and there's a Bright Data prize track. That prize wants live web data to be essential, so the plan's Service Scout (F5) now uses the Bright Data SERP API and Web Unlocker instead of Google Places. The demo script has Bright Data talking points.
- **Tested:** with mocked fetches. A page read through Bright Data costs 1 request, and later reads come from the cache. A page Bright Data can't read stops after 2 tries. Not yet tested against the real service.

### 2026-10-24 · Category editing and learning from moves (PR #5)

- **What:**
  - Hover a sidebar category and click ⋯ to rename it, pick a color, or delete it. Deleting re-sorts its items instead of losing them.
  - The category chip at the top of an open tray is a menu for moving the item.
  - The AI sees every category with up to 4 items already in it, plus the last 30 items Mehvish moved by hand.
  - Fixed the cut-off "Write a new summary" hover label.
- **Why:** Mehvish asked for more ways to change a tray's category, for moves to be noticed next time, for the AI to notice user-made categories, and for editing category names and colors.
- **How the learning works:** there's no training. Each sort just shows the AI recent examples (few-shot prompting), so it adapts right away and stays local.
- **Notes:**
  - Old branches on GitHub still need deleting by Mehvish. This session's GitHub access can't delete branches.
  - Turning on "Automatically delete head branches" in the repo settings makes this automatic.

### 2026-10-24 · Side trays and sidebar categories (PR #4)

- **What:**
  - The tray now has three columns: the summary in a side tray on the left, the item in the middle, notes in a side tray on the right.
  - Editable fields show a background and border on hover.
  - A **New** field under the sidebar categories makes a category, and items can be dragged onto a category to move them.
- **Why:**
  - At first Mehvish didn't see the summary and notes (the page hadn't refreshed after the update), or that fields were editable. The side trays also keep the summary visible next to a video or PDF instead of below it.
  - Mehvish asked for the category menu's "change and make new" actions on the left side too.
- **Notes:** the sidebar now lists empty categories too, so a new one has a place to drop things.

### 2026-10-24 · Trays: summaries, notes, editing, and images (PR #3)

**Summary:** Items are now called **trays**. Opening one shows the content and an AI summary on the left and your notes on the right, all editable. Images finally work. Changes are in https://github.com/m3v113/calhacks13/pull/3.

**What changed**
- **Tray view:**
  - Click a tray to open it. Title, note text, summary, and notes save as you type.
  - ↻ writes a new summary.
  - Links don't open from the list; you open them from inside the tray.
- **Summaries:** the AI writes one with the category and title, from the real content:
  - the note's text
  - a page's article text, pulled out locally with Readability (the code behind Firefox Reader View)
  - a paper's abstract from Crossref
  - a document's text
  - an image's description
- **Edits stick:** a title or summary you edit is never replaced by the AI. The category is only chosen once.
- **Images:**
  - The cause was that `llama3.2-vision` doesn't load on Ollama 0.40.9 ("unknown model architecture: 'mllama'").
  - The app now asks Ollama which installed models can see images, prefers `gemma3:4b`, and skips any that fail to load.
  - Updating Ollama doesn't help: Ollama dropped `llama3.2-vision` in version 0.30. Mehvish chose `gemma3:4b` (3.3 GB, one `ollama pull`) as the image model for the team, then as the only model: it also sorts, titles, and summarizes, so setup is one `ollama pull gemma3:4b`. `llama3.2:3b` is no longer needed.
  - The image is described first, then sorted and summarized from the description.
- **Error messages:** Ollama's real error text now shows in the Terminal.

**Why**
- **Readability before context.dev:** summaries need page text. Readability is free, needs no key, has no monthly limit, and runs on the Mac. context.dev stays a possible fallback for pages that block reading.
- **Describe images, then sort:** small vision models are better at describing a picture than at following a strict JSON format. The text model already handles the format well.
- **Pick image models by capability, not by name:** model names change often, and Ollama can say which models can see images.

**Notes**
- `ollama rm llama3.2-vision` frees 7.8 GB on Mehvish's Mac, since it can't run there.
- Mehvish's other models: `gemma4:12b` and `rafw007/gemma4-e4b-claude-coder`.


### 2026-10-24 · Feedback round 2 (PR #2)

**Summary:** A second pass on the running inbox. Changes are in https://github.com/m3v113/calhacks13/pull/2.

**What changed**
- **Full view:** click any item to open it: the whole note, the image, the PDF, a text document, or a YouTube video playing in place. Esc or a click outside closes it.
- **Delete instead of archive:** a trash icon on hover deletes the item and its file for good. The archive code stays in the API but has no button.
- **Theme switch:** a button cycles between matching the Mac, light, and dark. The choice is remembered.
- **Hover labels:** every nav icon shows a label on hover. The dot says "Local AI is on", "Local AI is on · no image model", or "Local AI is off".
- **Images:** the screenshot showed only "Screenshot" because no vision model was installed, so the AI saw just the file name. Those images now wait and are re-sorted and re-titled once `llama3.2-vision` is installed.
- **README:** covers all of the above, with new troubleshooting rows.

**Why**
- **The dot stays, with a label:** it's the one signal that local AI is working, which matters for the offline story. A hover label explains it without adding text to the screen.
- **Delete over archive:** Mehvish asked for it, and archived items had no way to be found again anyway.
- **"Match Mac" as the default theme:** it follows your Mac's appearance setting, which is why the app was dark before.

- **No more guessed link titles:** a ScienceDirect paper showed "COVID-19 Vaccine Efficacy Study", which the AI invented from the URL because ScienceDirect blocks page reads. Now:
  - A link only shows its page's real title. If the page can't be read, the URL shows and the read is retried after an hour.
  - Papers with a DOI or a ScienceDirect ID get their real title, journal, and year from Crossref's free API.
  - Old guessed titles are cleared once.

**Why no AI titles for links:** with only a URL, the model makes up something plausible and wrong. A wrong title is worse than showing the URL.

**Notes**
- Images added before the vision model was installed (like the first screenshot) were marked as sorted by AI, so they won't be redone. Delete and re-add them.
- Known gap: there's no undo after deleting.


### 2026-10-24 · Feedback round 1 (PR #1)

**Summary:** Mehvish's first feedback on the running app. All changes are in https://github.com/m3v113/calhacks13/pull/1.

**What changed**
- **Routes and nav:** the Hub is now the home page (`/`) and the Smart Inbox moved to `/inbox`. The nav shows the Hub icon first.
- **Heading:** a small "Smart Inbox" heading on the inbox page and in the Hub panel.
- **The + menu:** Note, Link, Image, Document. Typing in the box makes a note. Files can also be dragged in or pasted.
- **Uploads:**
  - Files are saved in `data/uploads/`.
  - PDFs and text files have their text pulled out (`unpdf`), so the AI sorts them by content.
  - Images are read by `llama3.2-vision` if it's installed. Otherwise they're sorted by file name.
- **Titles:**
  - The AI writes a short title for every item, and a real page title wins when one is found.
  - YouTube and Vimeo titles come from oEmbed, because their pages hide titles from simple fetches. This was the bug in the YouTube screenshot.
  - Older items without a title get one in the background.
- **Database updates itself:** `npm run dev` now updates the database first, so pulling new code needs no extra step.
- **README:** rewritten for a first-time setup.

**Why**
- **Hub at the root:** the Hub becomes the project home, so it should be the first thing you see.
- **The + menu:** "Add anything" didn't say what you could add. The menu shows the options, and typing still makes a note, so the common case stays one step.
- **Page titles over AI titles:** a page's own title is accurate. The AI's title is a guess, used when there's nothing better.
- **Vision only when installed:** the vision model is about 8 GB. The inbox still works without it.

**Mehvish asked:** "What is the green dot?" It shows whether local AI (Ollama) is running: green is on, yellow is off.

**Notes**
- The repo on GitHub is now the source of truth for the code. `project_manager/app/` on the Mac is the old copy from before git.


### 2026-10-24 · GitHub repo

- **Repo:** https://github.com/m3v113/calhacks13
- **What goes there:** only the `app/` folder (git lives inside `app/`). `plans/` and `pre/` stay on the Mac and are never pushed.
- **Why:** Mehvish wants the plans kept private and local; the repo is just the code.
- **Pushing:** over SSH (`git@github.com:m3v113/calhacks13.git`). GitHub doesn't accept account passwords over HTTPS.
- Claude now has access to the repo, so later changes can go in as commits instead of file copies.
- **Kept out of git by `app/.gitignore`:** `node_modules`, `.next`, `.env`, and `data/` (the SQLite database).

### 2026-10-24 · Smart Inbox and Hub built

**Summary:** First working version of both pages, in `app/`.

**What was built**
- **Inbox page (`/`):** category list with counts on the left; one box and the item list in the middle. Enter adds an item, Shift+Enter adds a new line. Each item has a color dot and, in the All view, its category name. Clicking either opens a menu to move it or make a new category. A circle on hover archives it.
- **Hub page (`/hub`):** dot-grid canvas. Drag or two-finger scroll to pan, pinch or Ctrl+scroll to zoom around the cursor. The view and the panel's open or closed state are remembered. The inbox panel on the right is the same component as the Inbox page, with categories as chips.
- **Sorting (`lib/sort.ts`):**
  1. The item is saved and shown at once with a pulsing gray dot.
  2. A link's title and description are read and cached (`PageCache`).
  3. A Wordle score goes straight to Wordle without asking the AI.
  4. Otherwise Ollama picks an existing category or names a new one, using a JSON schema.
  5. If Ollama is off or fails, keyword rules pick Recipes, Wordle, Events, or Other.
  6. A sweep runs at most every 10 seconds and re-sorts rule-sorted items with AI once Ollama is back. Anything you set yourself is never changed.
- **Status dot:** green when local AI is on, yellow when it's off.

**Tested in the cloud sandbox (no real Ollama):**
- With no AI, rules sorted Wordle, a recipe, and an event correctly; the rest went to Other.
- With a stand-in Ollama, the sweep re-sorted all of them, and a new "Health" category was created and colored.
- Moving an item to an existing or new category works, and so do archiving and the 404 case.
- Both pages render in light, dark, and phone width with no console errors.
- Not tested yet: the real model's accuracy and speed, and link reading (the sandbox blocks the app's own web requests).

**Why these choices**
- **Plain CSS instead of Tailwind:** the design is a handful of colors and shapes, so one small stylesheet is easier to keep simple than a framework.
- **Custom canvas instead of tldraw:** we only need pan, zoom, and later draggable cards. A custom canvas is about 100 lines, easy to keep minimal, and has no license question.
- **Prisma 6, not 7:** version 7 changes how SQLite is set up. Version 6 is stable and needs no extra adapter.
- **Rules first when AI is off, then re-sort:** an item should never sit unsorted. The AI corrects rule guesses later, without you doing anything.
- **Wordle skips the AI:** the score format is exact, so a rule is faster and never wrong.
- **Project links hidden for now:** `Item.projectId` exists in the database, but there's no UI until projects exist (F3). It keeps the inbox simple today.
- **A smaller live schema:** `app/prisma/schema.prisma` has only what the app uses today and grows feature by feature. (The old full target model was deleted on 2026-10-24. F3 and F4 in the plan now say what to add.)
- **Display names in one file:** names may change, so `lib/names.ts` holds them.

**Notes**
- Only sponsor tech that the current feature needs is used. None of it is needed for the inbox; the plan's section 1.5 lists when each one comes in (Cartesia for read-aloud, Factory Droid or Fetch.ai for the Scouts, and so on).
- context.dev isn't wired in yet. A plain fetch gets titles and descriptions with no key. Add context.dev if sorting needs the page text.

### 2026-10-24 · Plans reworked for 24 hours, solo

**Summary:** The event is 24 hours and Mehvish is building alone, so the plan was cut and reordered around the Smart Inbox.

- **Removed:** the partner split and the "Who" lines.
- **Added:**
  - Design rules: as simple as possible, no extra text or buttons, simple shapes and colors.
  - A note that names may change.
  - A sponsor tech table marking each one as now or later.
  - A status field on every feature.
- **Order:**
  - P0: F1 Smart Inbox, F2 Hub, F3 Projects, F4 Project space, F5 Service Scout, F6 Status.
  - P1: Research Scout, Draft editor, Assistant actions, Screenshots, Read aloud with Cartesia, Backup.
- **Why Research Scout moved to P1:** Service Scout was marked required, and one Scout fits in 24 hours alone. Both use the same pipeline, so Research Scout is cheap to add after.
- **Why the inbox comes first:** Mehvish asked for it to be fully working before any project parts, and it's the feature that works fully offline in the demo.

### Earlier (before 2026-10-24)

- 48-hour plan with a partner, offline-first architecture with Ollama, context.dev chosen for reading links. These docs are now in `pre/`.
