# IPO Analyst — standalone web app  ·  v4.0  ·  build 2026.08.18.4

A single-page web app that turns the institutional IPO research protocol into something you can
run from an icon on your phone. It works on Android and iPhone/iPad, installs to the home screen,
runs full-screen with no address bar, and works offline for everything except the AI call itself.

## What changed in v3.9

**New: the Institutional Research Report.** A 20–25 page long-form document, generated from the same
single paste as everything else. It carries the 30 research sections at full depth plus fourteen
deeper ones the shorter reports never had: unit economics, the working-capital cycle, quarterly
trend, capital-allocation history, related-party exposure, contingent liabilities, the regulatory
landscape, a competitive positioning matrix, a reverse DCF of what the issue price already assumes,
a sensitivity grid, management quality, the bull and bear cases argued in full, what would change
the view, and the questions to put to management. It opens with a contents page and paginates
itself, so Gujarati — which runs longer — never clips.

**Charts, in every document.** Before adding any, I tested which chart techniques survive the
rasteriser that produces the PDFs and PNGs. That turned up a live bug: **CSS `conic-gradient` renders
as nothing through html2canvas**, so the fresh-issue/OFS donut in the 10-page report has been a blank
circle in every exported file since it was introduced. Everything is now inline SVG or plain divs,
both verified to rasterise with real ink:

- a score gauge and a seven-axis radar on the scorecard pages
- revenue columns with the profit line over them
- peer P/E comparison bars with the subject highlighted
- a bear/base/bull ladder against the issue price
- a use-of-proceeds waterfall, a working-capital column chart and a sensitivity heat grid
- the fresh-issue donut, now drawn as SVG and actually visible

**Report page rearranged.** The Institutional Research Report sits below All Reports; the Score Card's
PDF and PNG buttons moved here from the Score Card tab, below Investment Summary. Continue, Copy Text,
Save as PDF and the raw prompt box are gone — the page was doing too much.

**The verdict card moved to the Score Card**, after the 100 points it summarises, with the tool name
and import timestamp dropped and a legend explaining what CRITICAL, HIGH, MEDIUM and LOW mean. The
Score Card now names the company selected on the Report tab automatically.

**Fixed: All Reports share did nothing but open the score card.** Sharing must happen inside a live
user gesture; building five documents takes half a minute, so by the time the files existed iOS
rejected the share, and the old download fallback opened the last PDF in a viewer instead of saving
it. The app now offers a **TAP TO SHARE** button — a fresh gesture — with a save-instead option.

**Logo:** lens moved to top centre with a longer, thicker handle drawn along a true 45° ray from the
lens centre; the previous handle was offset by half its own thickness, which read as a kink.

## What changed in v3.8

**Search sent the wrong prompt once a company was chosen.** The Search button had exactly one
meaning — fetch the list of upcoming IPOs — so after picking a company it still copied the IPO-list
question, and the AI tool received that instead of the research framework. The button now does what
its label says, and the label follows the company box: **Find IPOs** while the box is empty,
**Research** once a company is in it. A separate **Find IPOs instead** button appears when a company
is selected, so the list can still be refreshed without clearing your choice.

**Logo:** the magnifier is now a small mark in the top-right corner over the candles rather than the
centrepiece, IPO is much larger and heavier with a dark outline so it lifts off the chart, and the
candles are thicker and drawn as an ECG-style volatility trace — quiet baseline, sharp spike, deep
trough, recovery, a taller second spike, then a settle.

## What changed in v3.7

**Erase all local data was leaving your reports behind.** It deleted from a hand-maintained list of
keys that had drifted out of date — `ipo.library`, which holds every saved analysis and everything
the documents are built from, was never in it. So the reports survived, and the worksheet was then
refilled from that surviving library on the next load, which is why the Score Card looked like it
was not resetting either. One cause, both symptoms. It now removes every key the app owns **by
prefix**, so a key added in future cannot be missed the same way.

**In-app AI is opt-in.** A toggle at the top of the In-app AI card in Setup, off by default. While
it is off, the API key field, model picker and cost warnings are hidden and **RUN ANALYSIS IN APP**
does not appear on the Analyse page at all — the app works entirely through Claude, ChatGPT, Gemini
or Perplexity. Turning the toggle off also deletes any stored key rather than leaving a secret
behind.

**The app no longer zooms.** It is a fixed-width phone layout, so pinching only ever pushed the
cards off-screen. The viewport is constrained, pinch and ctrl+wheel gestures are cancelled directly
because iOS ignores the meta tag, and every input is 16px so iOS does not zoom the page when a field
is focused. The document preview and the generated files are unaffected.

**The author's footnote now appears on every page of every document**, in both languages:

> Report is Generated by an AI research tool developed by CA Tejas Desai, who is not a SEBI-registered
> investment adviser. Reports are prepared for solely for the academic purposes and private circulation
> only and it is not investment advice, not a recommendation and not an offer to buy or sell. Verify
> every figure against the RHP and exchange filings before acting

It sits in the running footer above the existing document line, on all 10 pages of the research
report, all 4 of the executive summary, all 3 of the score card and both investment summary pages —
and the same in Gujarati. Page counts are unchanged.

**Logo:** the lens interior is transparent, so the N-shaped candlestick chart runs through the glass,
with a solid gold rupee over it.

## What changed in v3.6

**Search no longer dumps you on a Google results page.** Tapping Search now copies the IPO-list
question and stops there — it highlights the four AI tool buttons and tells you to pick one. Google
was never useful for this: the question is written for an AI tool, not a search engine.

**The tool buttons open the installed app first.** A web page cannot ask a phone which apps it has,
so this is done the way that actually works rather than by guessing. On Android the app is reached
through an `intent://` URL carrying the package name and the website as a declared fallback — Chrome
hands it to Claude, ChatGPT, Gemini or Perplexity when that app is installed and loads the site when
it is not, in a single hop. On iOS the app's custom scheme is tried first with a timed fallback to
the website, since a universal link opened from an installed PWA does not always hand off. On
desktop it simply opens the site. Verified for all four tools on all three platforms.

**The same four buttons now serve both jobs.** They carry the IPO-list question after you tap
Search, and the full analysis prompt otherwise — so finding an IPO and analysing one follow the same
path instead of the search flow being a dead end. Typing a company name switches back automatically.

**Logo:** the candlestick background is now an N — climb, decline, climb again — three mountain
slopes instead of a single rising run.

## What changed in v3.5

**The Gujarati Score Card was half English, and there were three separate reasons.**

*The AI was sending one basis note instead of 28.* The framework's Gujarati skeleton showed
`gu.score_basis` with a single example key, so models filled in one and moved on — and the Basis
column runs down the entire Score Card. The skeleton now lists all 28 keys explicitly, the counts
table demands all 28, and the pre-send checklist makes the model count them. A real model run went
from 1 of 28 to 28 of 28.

*Words the app itself prints were never translatable by the AI at all.* Score bands, severity pills,
evidence standards, recommendation verdicts, trend and assessment words come from the app, not the
payload. They now go through a Gujarati vocabulary built into the app, so they are right regardless
of what the model sends. The Gujarati disclaimer no longer contains "Official, Derived or Estimated"
either.

*The `gu` block was a partial mirror of the payload.* Note fields on moat sources, operating
metrics, balance-sheet lines, ratios, governance parameters, due-diligence checks, monitoring
metrics and objects of the issue had no Gujarati keys, so they printed in English. Block 2 gains
`gu.text` — a flat dictionary from the exact English string to its Gujarati — described as the final
sweep of Block 1. The renderer looks up every string it draws there.

Measured on a real model run, English fragments in the Gujarati Score Card fell from 97 to 11, and
the 11 that remain are the document title header, the footer and the company name, which stay
English by design along with PAT, EBITDA, ROE, ROCE, GMP, GST and the other abbreviations.

**Figures can no longer diverge between the two editions.** The app compares the numbers in each
translated string against its English source and discards a translation that has lost one, keeping
the English for that line — two editions disagreeing on a number is worse than one English sentence.
While testing this, models turned out to write Gujarati numerals (૯૨ rather than 92), which your
spec forbids and which also broke the parity check; the app now converts them to Western digits on
the way out rather than hoping the model complies.

**New app icon.** A full-bleed candlestick chart — brighter green and red, wider bodies, a
decisively rising series — behind a centred gold magnifying lens with the rupee inside, and IPO in
gold beneath.

## What changed in v3.4

**Score Card page 2 was rendering Gujarati on top of itself.** The cause was CSS `zoom`: when a page
overflowed, the content was scaled with `zoom`, and html2canvas — which rasterises the PDF and the
PNG — measures a zoomed box with the wrong glyph advance widths. Latin text survived it; Gujarati
collapsed into overlapping words. The Score Card now paginates into as many pages as the content
genuinely needs (two or three) instead of squeezing, and the last-resort scale left in place for a
single oversized block uses `transform: scale()`, which html2canvas reproduces exactly. The same
change was applied to the Investment Summary. A test now fails the build if any rendered document
contains a CSS `zoom` at all.

**The company picker is a real dropdown.** It was a `<datalist>`, which phones render as a one-line
strip above the keyboard and — the worse half — will not reopen once a value has been chosen, so a
mis-tap could only be undone by killing the app. It is now a vertical list you can reopen any time
from the ▾ button: each row shows the company, an OPEN / CLOSED / UPCOMING chip, the dates and the
price band. Opening always shows the full list; typing filters it; tapping outside or pressing
Escape closes it.

**One paste, both languages.** The framework now asks for both data blocks — English and Gujarati —
in the same reply, and the importer reads every block it finds in a single paste and merges them.
Nothing to remember, no second prompt. They stay two blocks rather than one object because a single
combined object is long enough that models stop mid-JSON, and Add To This Analysis remains for the
occasions when a tool still runs short.

**New: All Reports.** One row at the top of the Documents list with its own ENG / GUJ switch, a PDF
button and a share button. One tap builds the research report, the executive summary, the investment
summary and the score card in the chosen language and saves or shares them together.

**A generated report no longer traps you.** The PDF preview used to open in a new window, which
inside an installed PWA has no browser chrome and no back gesture — the only way out was to close
the app. Documents now preview in a full-screen panel with a **Back** button and a **Save as PDF**
button, and the phone's own back gesture closes the preview rather than the app.

## Version display and deployment (v3.3, build 2026.08.16.2)

**Fixed: the footer said v3.0.** It was a hand-typed string that never got updated through v3.1,
v3.2 or v3.3. Every version label — the footer, the service-worker cache name, the manifest and this
README — is now written by the build step from one constant, and a test fails the build if any of
them disagree. The footer also prints a build stamp and, when a service worker is serving the page,
the name of the cache actually in use, so "which build am I looking at" is answerable at a glance.

**Fixed: a fresh upload could keep showing the previous build.** The service worker served the page
cache-first, so a new deployment only appeared on the *second* visit — indistinguishable from a
failed upload. Pages are now fetched network-first with the cache as the offline fallback, static
assets are served from cache and refreshed in the background, the app asks for an update on every
launch, and it reloads itself once when a new build takes over. Verified over real HTTP by serving
the app, replacing the files as if re-uploading to GitHub, and confirming the new version appears on
the next load with the old cache discarded — and that it still works offline afterwards.

## What changed in v3.3 — the v3.2 import regression, fixed

**What went wrong in v3.2.** I replaced the prompt built into the app with the longer framework
payload (SWOT, an exhaustive `gu.labels` dictionary, full-Gujarati rules). That pushed a single AI
reply past what a chat model can finish, so replies were arriving cut off mid-JSON. The importer
then did something unhelpful: `JSON.parse` threw, it silently fell back to scraping numbers out of
the prose, and that fallback produces no `meta` and no `verdict` — which is exactly the condition
that kept the Documents section and every PDF and share button hidden. One cause, both symptoms:
missing score lines *and* no documents.

**Three fixes, at three levels.**

*The reply now fits.* Output is split into two blocks. Block 1 is the English analysis and is all
the app needs. Block 2 is the Gujarati translation, sent only when you reply `gujarati`, and it
repeats none of the English. `score_lines` moved to the top of the payload, so even a reply that
does get cut short still carries the scoring. `gu.labels` is bounded at 25–40 entries instead of
"every label you used".

*The importer no longer gives up.* It brace-matches the payload out of the reply without needing a
closing fence, strips `//` and `/* */` comments, trailing commas, curly quotes, `...` elisions and
`NaN`, unwraps a payload nested inside `{"result": ...}`, and completes a truncated object by
closing what the model left open. If it still cannot parse, it salvages the top-level keys that
were complete. Whatever it had to repair, it tells you. Anything the JSON did not carry is then
scraped from the prose rather than left blank.

*Nothing fails silently.* The Documents tools appear whenever anything usable survived, and the app
states exactly what is thin — "12 of the 28 score lines, the Gujarati translation". A score line the
reply never supplied is recorded as unsupplied rather than quietly scored 0.

**New: Add To This Analysis.** Paste a second block — the Gujarati block, or the rest of a reply the
tool had to cut short — and it merges into the analysis you already have. Nothing already present is
overwritten, the total is recomputed, and it reports what it gained.

**One framework, one source.** The framework file, `protocol.md` and the prompt inside the app are
now generated together by a build step. In v3.2 the in-app prompt was a whole version behind the
framework file; that class of bug is gone.

**Also fixed:** the Investment Summary exported at four different pixel widths (4960, 4772, 4540,
4284) because the auto-fit shrank the page box instead of the content — messaging apps were
stretching them. All pages are now exactly 4960 × 7016. Price-level rationales now translate in the
Gujarati edition.

**Tested.** 84 automated checks: 25 realistic model-output shapes (Claude, Gemini and ChatGPT
pathologies — truncation, prose after the block, missing fences, comments, elisions, nested
wrappers, missing whole sections), 12 merge-flow checks, 36 UI and rendering checks, and — the part
that matters — three genuine end-to-end runs where a real model was given the framework, researched
a real company on the web, and returned its reply untouched. All three imported with 28/28 score
lines and produced all eight documents. A real Gujarati Block 2 was then merged and verified to
carry identical figures to the English edition.

*Note on coverage: Claude runs were real. I could not sign in to Gemini or ChatGPT from the build
environment, so those are covered by the output-shape corpus rather than live runs.*

## What changed in v3.2

**New app icon.** The *Rupee Rise* mark — a gold breakout arrow over a rupee watermark on indigo,
with an IPO wordmark — is installed at every size Android and iOS ask for, including a maskable
version for Android's adaptive icon shapes.

**Redesigned interface, navy and gold.** Pill navigation with a gold active tab, gradient primary
buttons, rounded cards with soft shadows, gold focus rings, larger tap targets, and a light mode
that mirrors the dark one. The header now shows the real app icon.

**Search window is now the past 7 days and the next 15 days**, not the next 10. Both the framework
and the in-app search ask for every Mainboard and SME issue in that 22-day band and label each one
`Closed`, `Open` or `Upcoming`, so an issue that just closed but has not listed still shows up.

**IPO Type gains a Both option**, and it is the default. You no longer have to know whether a
company is coming to the mainboard or the SME platform before you can research it — the analysis
determines it from the RHP and states it.

**Score Card documents were losing half the marks.** The card was a single fixed A4 box with
`overflow:hidden`, so everything past Valuation was clipped out of the PDF and the PNG. It is now
adaptive: it fits on one page when it honestly can, and otherwise spills onto a second page that is
balanced against the first. All 28 line items, all seven sections and a new *Total Score By Section*
summary with share-of-maximum bars are always present. Nothing is clipped in either language.

**Gujarati Score Card** now translates the basis notes too, through a new `gu.score_basis` block.

**The prompt built into the app was a version behind the framework file** — it was missing the SWOT
block, the `gu.labels` dictionary and the full-Gujarati rule. It is now generated from the same
source, so copying from the app and using the framework file give identical results.

**Fixed a floating-point leak** that displayed a score as `72.30000000000004`.

Regression-tested: 36 automated checks plus real file generation — 10-page report PDF, 4-page
executive summary PDF, 2-page Score Card PDF, 600 DPI Investment Summary PNGs and 384 DPI Score Card
PNGs, in both languages. No console or page errors.

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
