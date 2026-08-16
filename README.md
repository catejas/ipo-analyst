# IPO Analyst — standalone web app  ·  v3.1

A single-page web app that turns the institutional IPO research protocol into something you can
run from an icon on your phone. It works on Android and iPhone/iPad, installs to the home screen,
runs full-screen with no address bar, and works offline for everything except the AI call itself.

## What changed in v3.1

**Fixed: `[object Object]` where the company name should be.** When an AI returned `company` as a
nested object instead of a plain string, the app printed the raw coercion. Both the app and the
renderer now coerce safely — pulling `name`, `legal_name` or the first string field — so saved
analyses and every document header carry the real company name.

**Gujarati is now a full translation.** Only the document title header, page numbers, proper nouns
and financial abbreviations stay in English. Section titles, table headings, row labels, chart
labels, severity pills, SWOT quadrant names and the disclaimer are all built into the app in both
languages. Payload-supplied labels — financial rows, ratios, segments, metrics, governance
parameters — translate through a new `gu.labels` dictionary the framework now requires.

**Investment Summary rebuilt.** Page 1 gains an *IPO at a glance* row (price band, issue size,
subscription, grey market premium) plus the objective of the issue, and a three-year financial table
under the score card. Page 2 gains a **SWOT grid**, three points per quadrant. Type throughout is
much larger and the image now renders at **600 DPI (4960 × 7016)** — messaging apps recompress hard,
so send it as a **Document, not a Photo**.

**Report page** is now three labelled rows, each with a small format icon and a share icon:
Company Research Report · Executive Summary Report · Investment Summary. *IMPORT RESULT* is renamed
**Import Data**.

**Score Card page** — renamed from Scoring, heading is *Score Card*, instructions removed. It gains
its own PDF and PNG icons with share buttons, producing a one-page A4 score card at 384 DPI.

**Analyse page** — the company placeholder is blank, and Search now has **Import Search Data** and
**Delete Search Data** so the upcoming-IPO list is kept entirely separate from the Report tab's saved
analyses.

**Setup page** — *Install Application* moved to the top.

Regression-tested: 30 checks covering every change above, all six documents rendering at the right
page counts in both languages, plus real PNG and PDF generation. No console errors.

## What changed in v3.0 — the app makes the documents now

The AI no longer produces PDFs or PNGs. That was the cause of the "plain text poured into a PDF"
problem: a chat model cannot control typography, page breaks or colour. **It now returns one
structured JSON payload, and the app renders every file itself** from designed templates.

**What that fixes.** The 10-page research report, the 4-page summary and the 450-DPI images are
laid out by code — navy and teal institutional palette, real charts, tables with tabular figures,
running heads and page numbers. The output looks the same every time regardless of which AI produced
the data.

**Report renamed** to *IPO Company Research Report*, with matching footers throughout.

**Ten pages, not thirty.** Cover and verdict · scorecard · the IPO · the company · industry and moat ·
financials · cash and balance sheet · valuation and peers · promoters and governance · the decision.
All 30 research areas survive, regrouped into six logical sections with the decision-relevant item
first in each.

**Gujarati edition** keeps headers, footers, page numbers, section titles and financial abbreviations
in English; only the analysis is translated. The two editions are numerically identical by
construction — they render from the same payload.

**New on the Analyse page.** A **Search** button that finds Indian IPOs opening in the next 10 days
and fills a dropdown on the company field. Investment horizon is now Both / Listing gain / 3+ Years.
A Language control — English, ગુજરાતી or Both — drives which files the Report tab generates.

**New on the Report page.** **Import Data**, then **Generate PDF**, **Generate PNG**, **Share PDF**
and **Share PNG**. Generate PDF opens the browser's print view, which produces vector text at full
quality — choose *Save as PDF* as the destination. Share PDF builds an actual file so it can go
straight into WhatsApp or email; where the browser has no share sheet it downloads instead.

Verified end to end with a full payload: 10/4/2 pages in both languages, PNG at **3720 × 5262 px
(450 DPI at A4)**, PDF at true A4, no console errors.

## What changed in v2.4

**Select AI tool.** The separate *Copy prompt* button is gone. Copying is now built into the tool
buttons themselves: tap **Claude / ChatGPT / Gemini / Perplexity** and the app copies the full prompt
to your clipboard and opens that tool in one action. Paste and send.

**Honest limits on automation.** A web page cannot type into, click, or read another website. That is
not a gap in this app — every browser forbids it, and that restriction is exactly what stops a hostile
page from driving your email or your bank. So the app can hand you a loaded clipboard and open the
door; the paste is your tap. **If you want genuinely hands-off six-file output, use *Run analysis
in-app*** with an API key: that path talks to the model directly, runs the searches and streams every
file back with no copying at all. A browser extension could automate the others, but it is a different
kind of software and cannot ship inside a PWA.

**Import result — bringing outside output back in.** New button on the Report tab. Paste whatever
Gemini or ChatGPT gave you and the app will:

- archive it in a **Saved analyses** library on the device, switchable from a dropdown;
- show a result card with the recommendation, the three headline scores, the allocation band, the
  one-line verdict and the red flags with severity pills;
- **populate the scoring worksheet automatically** — all 28 line items, so the sliders, block subtotals
  and final band reflect the imported analysis instead of being re-keyed by hand.

That works because §46.6 of the framework now requires every run to end with a fenced
`json ipo-analyst-data` block carrying the company, verdict, all three scores, all 28 line items, the
snapshot figures and the red-flag register. If a tool omits the block, the app falls back to scraping
the printed scoring table and tells you how many line items it recovered. In-app runs are archived the
same way, automatically.

## What changed in v2.1 — read this if you were losing the full report

v2.0 let you pick which files you wanted, and in practice that produced a predictable failure: the
model wrote the 4-page executive summary and either skipped the full institutional report or emitted
a shortened version of it. Three things caused that. v2.1 fixes each one.

1. **No file selection any more.** The prompt now carries a fixed **six-file output contract** and the
   app has no deliverables selector. Every run demands all six:

   | # | File | Language |
   |---|------|----------|
   | 1 | Full institutional research report | English |
   | 2 | Executive summary, max 4 pages | English |
   | 3 | Visual summary, 450-DPI PNG | English |
   | 4 | Full institutional research report | ગુજરાતી |
   | 5 | Executive summary, max 4 pages | ગુજરાતી |
   | 6 | Visual summary, 450-DPI PNG | ગુજરાતી |

2. **An anti-substitution rule.** The full report must be written **first and in full**, before a word
   of the summary. The prompt names the specific evasions — "see executive summary", "details omitted
   for brevity", merged sections — and states that a run producing one document, or a report shorter
   than its own summary, has failed. It also sets a **depth floor**: 30 sections, 8,000 words minimum,
   25+ tables, and all 28 scoring line items justified individually.

3. **A continuation protocol, with a Continue button.** Six documents do not fit in one reply — that
   truncation was the real mechanism behind the missing detail. The model is now told to stop at a
   clean boundary and emit a `⟪CONTINUE⟫` marker rather than compressing. The app watches for that
   marker, keeps the conversation, and shows a **Continue** button; tapping it resumes from exactly
   that point. The per-response budget also went from 16k to 32k tokens.

Before finishing, the model must print a **delivery checklist** ticking off all six files, figure
parity between the two languages, and that no CRITICAL or HIGH red flag was dropped.

**What is inside**

```
index.html               the entire app (no build step, no dependencies)
manifest.webmanifest     makes it installable with an icon and a name
sw.js                    service worker — offline caching
icons/                   app icons (192, 512, maskable, Apple touch)
README.md                this file
```

---

## What the app does

| Tab | Purpose |
|---|---|
| **Analyse** | Enter a company name, IPO type, horizon and investor type. The app fills the v2.1 research protocol with those inputs. There is no file or language selector — the six-file contract is fixed. |
| **Report** | Where research lands — from an in-app run *or* imported from another AI tool. Holds the **Saved analyses** library, the result card, **Import result**, and the **Continue** button for resuming a paused run. |
| **Scoring** | The 100-point worksheet. Fills itself from an imported analysis, or drag the sliders yourself. |
| **Setup** | API key, model choice, install instructions, and a one-tap wipe of all local data. |

**Three ways to run an analysis**

1. **Run in-app** — needs your own Anthropic API key. The app calls the API directly from your
   phone with live web search enabled, and streams the report into the Report tab. This is the
   only mode that follows the research protocol end to end automatically.
2. **Select AI tool** — tap Claude, ChatGPT, Gemini or Perplexity. The prompt is copied and the tool
   opens; paste and send. Free, no key needed. **Turn that tool's web search / browsing mode ON before
   sending**, or the research protocol cannot be followed. Then bring the result back with
   **Import result** on the Report tab.
3. **Send to another app** — the system share sheet, for any tool not in the list.

There is no backend. Your API key, saved analyses and scores never leave the device.

---

## Step 1 — Put the files online

The app must be served over **HTTPS**. Opening `index.html` from your phone's file manager will
not work: iOS and Android both refuse to install a home-screen app from a `file://` page, and the
Anthropic API refuses browser calls from insecure origins.

Pick whichever of these suits you. All three are free and take under five minutes.

### Option A — Netlify Drop (easiest, no account needed to start)

1. On a **computer**, unzip `ipo-analyst.zip`. You now have a folder containing `index.html`.
2. Go to **https://app.netlify.com/drop**
3. Drag the **whole unzipped folder** onto the drop area — not the individual files, and not the
   zip.
4. Wait about 20 seconds. You get a live HTTPS address such as
   `https://cheerful-pixie-1a2b3c.netlify.app`
5. Sign in with email or GitHub when prompted, otherwise the site expires. Under
   **Site settings → Change site name** you can rename it to something like `tejas-ipo`.
6. Copy that address — you need it in Step 2.

### Option B — GitHub Pages (permanent, version-controlled)

1. Create a new **public** repository at https://github.com/new — name it `ipo-analyst`.
2. Click **uploading an existing file**, drag in `index.html`, `manifest.webmanifest`, `sw.js`
   and the `icons` folder, then commit.
3. Go to **Settings → Pages**. Under *Source* pick **Deploy from a branch**, branch `main`,
   folder `/ (root)`. Save.
4. Wait two minutes. Your address is
   `https://<your-github-username>.github.io/ipo-analyst/`

### Option C — Cloudflare Pages

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** →
   **Upload assets**.
2. Name the project, drag the unzipped folder in, click **Deploy**.
3. You get `https://<project>.pages.dev`.

---

## Step 2 — Install it on your phone

### Android (Chrome)

1. Open the HTTPS address from Step 1 in **Chrome**.
2. Either tap the **Install app** button that appears on the Setup tab, or tap the **⋮** menu in
   the top right → **Add to Home screen** → **Install**.
3. The icon appears on your home screen. Opening it launches full-screen with no address bar.

### iPhone / iPad (Safari)

1. Open the HTTPS address in **Safari**. This will not work in Chrome on iOS — Apple only allows
   home-screen installs from Safari.
2. Tap the **Share** button (square with an upward arrow) at the bottom of the screen.
3. Scroll down the share sheet and tap **Add to Home Screen**.
4. Edit the name if you want, then tap **Add** in the top right.
5. The icon appears on your home screen and launches full-screen.

### Desktop (optional)

In Chrome or Edge, click the install icon at the right-hand end of the address bar. The app then
appears in your applications list and opens in its own window.

---

## Step 3 — Choose how you want to run analyses

### If you want the app to do the research itself

You need an Anthropic API key. This is separate from a Claude subscription — it is pay-per-use.

1. Go to **https://console.anthropic.com** → sign in → **API Keys** → **Create Key**.
2. Under **Billing**, add credit and — importantly — **set a monthly spend limit**. Start low,
   around $20.
3. In the app, open the **Setup** tab, paste the key into the API key field, pick a model, then
   tap **Test key**. You should see "Key works."
4. Go back to **Analyse**, type a company name and tap **Run analysis in-app**.

**Expect a run to take 3–8 minutes** — it performs 12–40 live web searches before writing
anything, which is exactly what the protocol demands. The Report tab shows a running count of
searches and elapsed time. Do not close the app mid-run.

**Rough cost per analysis:** ₹25–₹60 on Sonnet, ₹100–₹150 on Opus, under ₹15 on Haiku. Sonnet is
the sensible default. Haiku is noticeably weaker at the sceptical, cross-checking parts of the
protocol, which are the parts that matter most.

**A full six-file run is long.** Expect several Continue taps and 15–30 minutes end to end, because the
model writes six documents rather than one. Budget roughly ₹150–₹350 per complete run on Sonnet. If you
only need the decision and not the paperwork, stop after file 2 — the executive summary is the document
most people actually read — but do not edit the contract to remove files, or the substitution problem
comes back.

### If you would rather not store an API key

Skip Step 3 entirely. Use **Copy prompt** or the chat-app buttons, and paste into whichever AI you
already pay for. You lose the automatic streaming into the Report tab, and you must remember to
enable web search in that app, but it costs nothing extra and no key is stored on the device.

---

## Keeping your prompt off the screen

Under **Setup → Prompt delivery** there are two modes.

**Full text** (default) pastes the whole protocol into the tool. Simple, works everywhere, but your
method is visible in the chat window and stored in that tool's history.

**Private link** pastes three lines instead: *fetch `protocol.md` from your own site and follow it*,
plus the company and settings. The protocol file ships inside this package and is served from your own
hosting, so the method never appears on screen or in the transcript. Set your hosted address in Setup
to enable it.

Be clear about what this is and is not. The file must be publicly readable for the AI to fetch it, so
anyone who has the URL can open it, and the AI provider still processes its contents when it browses.
This defeats over-the-shoulder reading and keeps your protocol out of chat history — it is **not**
encryption, and there is no way to make text unreadable to a model that must read it to follow it.

If you need genuine confidentiality, use **RUN ANALYSIS IN APP**: the protocol goes straight from your
device to the API and is never pasted into any chat interface at all.

## About the Gujarati output

The framework tells the model to translate the *analysis*, never the *numbers* — a figure labelled
Derived or Estimated in English must carry the same label in Gujarati, and a translation may never
upgrade an allegation to a fact, soften a red flag, or drop a caveat.

Two practical consequences worth knowing:

- **Gujarati runs 10–20% longer than English.** That is why the framework tells the model to re-verify
  the 4-page executive summary limit *after* translating and to trim narrative if it overflows. If you
  generate the documents yourself rather than in-app, build in an auto-fit or shrink step — the
  reference implementation shrinks page 2 to about 86–90% to hold the limit.
- **Fonts matter.** Gujarati needs Noto Sans Gujarati or Noto Serif Gujarati and a line-height of at
  least 1.65; at the 1.42 leading used for Latin text the matras collide. The app sets this for you,
  but a device with no Gujarati font installed will fall back to boxes. Every modern Android and iOS
  device ships one.

## Notes, limits and honest caveats

**The contract is instruction, not enforcement.** The app asks for six files, a 4-page summary cap and
an 8,000-word report floor. Nothing in a browser can force a model to comply. What v2.1 changes is that
non-compliance is now *visible*: the delivery checklist and the per-file completion banners make a short
or missing file obvious at a glance. If file 1 comes back thin, say **"File 1 is below the depth floor in
Section 46.3 — rewrite it in full"** and it will.

**The HD image spec is likewise an instruction.** If you paste the prompt into a chat app that cannot
render images, you will get a described layout rather than a PNG. To actually get the 3720 × 5262
output, either render the model's HTML yourself at a 3× device scale factor, or use a tool that can.

**Model names go stale.** Anthropic ships new model versions and retires old ones. If a run fails
with "model not found", open `index.html` in any text editor, find the `<select id="model">` block
near the bottom, and update the `value="..."` strings to current model IDs from
`console.anthropic.com`. Re-upload the file. That is the only maintenance this app needs.

**API key security.** The key sits in the browser's local storage. Anyone who can unlock your
phone and open the app can read it through developer tools. Use a dedicated key with a low cap,
and revoke it in the console if the device is lost. The Setup tab has an **Erase all local data**
button.

**The app does not verify anything.** It is a well-structured prompt plus a scoring worksheet. The
AI still hallucinates figures, misreads tables, and confidently cites documents it did not open —
which is precisely why the protocol demands a source audit and a data-conflict log. Treat every
number as unverified until you have seen it in the RHP or on the SEBI, NSE or BSE site yourself.

**Grey market premium data is unofficial and unregulated** and is capped at 5 of 100 points in the
scoring model for that reason. Do not let the app's output change that discipline.

**This is a research tool, not investment advice.** It is not a recommendation, not a substitute
for a SEBI-registered adviser, and carries no fiduciary standing whatsoever. Equity investment
carries the risk of permanent capital loss.

---

## Updating the app later

Change `index.html`, then re-upload it the same way you deployed it. The service worker cache is
versioned — bump `var CACHE = 'ipo-analyst-v6'` in `sw.js` to `v5` whenever you change
`index.html`, otherwise installed copies may keep serving the old version for a while. Users get
the update the next time they open the app twice.
