<!--
  README.md -- SMS blast send time and cost calculator
  Author:  Jibril Sulaiman, built with Claude
  What:    Guide to a single-file calculator that turns a pasted text message, a list size and
           an Eastern start time into segments, send duration, finish time and cost.
  Why:     Texting providers limit speed by segments per second, so message length decides how
           long a blast takes and what it costs. Nobody on a marketing team should have to do
           that math by hand before every send.
-->

# SMS blast send time and cost calculator

One HTML file. Paste the text you are about to blast, enter how many contacts and when it
starts (US Eastern), and it tells you how many segments each text uses, how long the send
takes, when it finishes, and roughly what it costs. Built for the person who schedules
class reminders and promos, not for developers.

## Why it exists

Texting platforms (Aloware, and most others that sit on Twilio) don't show you how long a
blast will take or what it will cost before you press send. The numbers that decide both
are buried in carrier rules:

1. **Speed is counted in segments, not texts.** A US short code sends about 100 segments
   per second by default. A standard toll-free number sends about 3 per second until the
   provider raises it. 300,000 one-segment texts take about 50 minutes at 100 per second,
   and about 28 hours at 3 per second.
2. **One character can double everything.** A plain text holds 160 characters in one
   segment. At 161 it becomes two segments of up to 153 characters each, so the send takes
   twice as long and costs twice as much.
3. **One emoji or curly quote does the same thing.** Any character outside the basic GSM
   set (emoji, curly quotes copied from Word or Google Docs, long dashes, ellipses) switches
   the whole text to Unicode: 70 characters in one segment, then 67 per segment.
4. **The limit is per account, not per number.** The texting vendor confirmed that every
   text on the account goes through one send queue at up to 100 per second. Two blasts at
   once, or a short code and a toll-free number at once, share that 100. They do not add
   up.
5. **Sequences can be much slower.** The vendor's sequence tool tops out at 250 texts per
   minute, about 4 per second, no matter what the line can do.
6. **Carrier fees are a separate, larger line.** Each carrier charges its own per-segment
   fee on top of the provider's price. On one real bill, carrier fees came to about 1.3x
   the short code send fee itself.

What went wrong in production: a large blast queued a few hundred thousand texts, and an AI
text agent's replies on the same account sat in line behind them until the vendor changed
how replies are scheduled. Knowing that a blast takes about an hour, not a few minutes,
would have shown the risk in advance.

## How it works

Everything runs in the browser. Nothing is sent anywhere.

```
pasted message ──► segment counter ──► segments per text
                    (GSM-7 or Unicode,     │
                     160/153 or 70/67)     ▼
list size × segments ÷ segments per second = send time
start time (Eastern) + send time = finish time (Eastern, daylight saving handled)
segments × (send rate + carrier fee) + new contacts × lookup fee = cost
```

## What's in this repo

| Path | What it is | Where it goes |
|---|---|---|
| [`index.html`](index.html) | The whole calculator: page, styles and script | Open it in a browser, or host it anywhere that serves static files |
| [`tests/`](tests/) | Checks for the segment counter, the Eastern-time math and the cost math | Run with `npm test` |
| [`package.json`](package.json) | Only holds the test command | Not needed to use the page |

## Table of contents

- [1. Requirements](#1-requirements)
- [2. Setup, step by step](#2-setup-step-by-step)
  - [Step 1: Get the file](#step-1-get-the-file)
  - [Step 2: Put in your speeds and prices](#step-2-put-in-your-speeds-and-prices)
  - [Step 3: Share it with your team](#step-3-share-it-with-your-team)
  - [Step 4: Plan a send](#step-4-plan-a-send)
  - [Step 5: Run the tests (optional)](#step-5-run-the-tests-optional)
- [How segments are counted](#how-segments-are-counted)
- [Troubleshooting](#troubleshooting)
- [Limits](#limits)
- [Security](#security)

## 1. Requirements

- Any current browser (Chrome, Edge, Safari, Firefox).
- A text editor to change the prices (Notepad works).
- Your provider's per-segment prices. They are on its usage or billing screen.
- For the tests only: Node.js 18 or newer.

## 2. Setup, step by step

### Step 1: Get the file

About 2 minutes.

**1a. Download it.** On this repo's GitHub page, click **Code → Download ZIP**, then unzip
it. Or clone it:

```powershell
git clone https://github.com/carljibrilsulaimanii/sms-blast-send-time-and-cost-calculator.git
```

**1b. Open it.** Double-click [`index.html`](index.html). It opens in your browser with a
sample message already filled in.

✅ **Check:** the right-hand panel shows **Send time** *50 min* for the sample message and
300,000 contacts on **Short code: 100 per second**.

### Step 2: Put in your speeds and prices

About 10 minutes.

The page ships with **example** prices. Replace them with your own, or the cost section is
only a rough guide.

**2a. Find your prices.** In your texting platform's billing area, open the usage or charges
screen for a recent period. Note:

| What to find | Usually labeled (wording may differ) | Goes into |
|---|---|---|
| Short code text price | *ShortCode Text Messages (per segment)* | `RATES.sc.sms` |
| Short code image price | *ShortCode Multimedia Messages* | `RATES.sc.mms` |
| Toll-free text price | *Toll-free Text Messages (per segment)* | `RATES.tf.sms` |
| Toll-free image price | *Toll-free Multimedia Messages* | `RATES.tf.mms` |
| Carrier fees for texts | *Carrier fees for SMS messages (per segment)*. No rate is shown; divide the **Cost** by the **Total Usage** | `CARRIER.sms` |
| Carrier fees for images | *Carrier fees for MMS messages*, same division | `CARRIER.mms` |
| Number lookups | *LRN Lookups* | `LRN` |

> ⚠️ **Carrier fees have no rate column.** Each carrier charges its own fee, so the bill
> shows only a total. Divide that total by the number of segments it covers to get an
> average. Don't skip it: it can be bigger than the provider's own price.

**2b. Edit the prices.** Open [`index.html`](index.html) in a text editor and search for
`EXAMPLE rates`. Change the numbers in this block (US dollars):

```js
var RATES = {
  sc: { sms: 0.004, mms: 0.015, name: "short code" },
  tf: { sms: 0.008, mms: 0.025, name: "toll-free" }
};
var CARRIER = { sms: 0.004, mms: 0.010 };
var LRN = 0.002;
```

If you change `LRN`, also change the `$0.002` in the hint under **Contacts new to your
texting platform**.

**2c. Edit the speeds.** Search for `Sending through`. Each `<option>` is one choice in the
dropdown. `value` is segments per second, and `data-bill` says which prices it uses (`sc`
for short code, `tf` for toll-free):

```html
<option value="100" data-bill="sc" data-name="Short code (100 per second)">Short code: 100 per second</option>
```

Ask your provider what speed your account actually has. If your toll-free number was
raised to 100 per second, use the **Toll-free, upgraded** option and delete the standard
one. Keep the **Custom speed** option; it lets anyone try a speed the provider is quoting.

**2d. Save and reload.** Save the file, then refresh the browser tab.

✅ **Check:** with the sample message, 300,000 contacts and **Short code**, the **Estimated
cost** total equals 300,000 × (your `RATES.sc.sms` + your `CARRIER.sms`).

### Step 3: Share it with your team

About 5 minutes. Pick one.

**Option A: send the file.** Email or Slack [`index.html`](index.html). Each person opens it
from their downloads. Every copy has to be replaced when prices change.

**Option B: publish it as a Claude artifact** (this is how the original was shared). In
Claude Code or the Claude desktop app, open the folder with the file and ask Claude to
publish [`index.html`](index.html) as an artifact. Claude returns a `https://claude.ai/artifact/...`
link.
1. Open the link, click **Share**, and share it with your organization or with each person.
2. To update it later, edit the file and ask Claude to publish the same file again. The
   link stays the same.

> ⚠️ **A new artifact starts private.** Until you share it, the link opens only for you.

**Option C: any static host.** The file needs no server, so any host that serves plain HTML
works. Upload [`index.html`](index.html) as the site's home page.

✅ **Check:** someone else opens the link or file and sees the same send time you see.

### Step 4: Plan a send

About 1 minute per send.

**4a. Paste the message.** Paste into **Message** exactly what will be sent, including the
"Reply STOP" line and anything your platform adds on its own. Under the box:
- **Plain text (GSM)** or **Unicode** shows which limit applies.
- **Characters**, **Segments**, **Per segment** and **Room left in 1 segment**.
- One bar per segment shows how full each one is.

**4b. Fix Unicode characters.** If the page lists characters that *"switch the whole text to
Unicode"*, either remove them or click **Swap curly quotes, dashes and ellipses** to
replace those with plain ones. Emoji can't be swapped; delete them if you want 160
characters back.

**4c. Image texts.** Tick **Includes an image (MMS)** if the text has a picture. It is then
billed as one message up to 1,600 characters, at the image price.

**4d. List size.** Type it in **Number of contacts**, or click **50K**, **100K**, **230K**
or **300K**.

**4e. Line.** Choose it in **Sending through**. Pricing follows the line you choose. The
**Short code | Toll-free** switch next to **Estimated cost** changes only the pricing.

**4f. Start time.** Set **Start date (ET)** and **Start time (ET)**, or click **Now**,
**11 AM**, **2 PM** or **6 PM**.

**4g. New contacts.** If some numbers have never been texted from your platform, enter how
many in **Contacts new to your texting platform**. Leave 0 otherwise.

**4h. Read the results.** The right-hand panel shows:

| Result | Meaning |
|---|---|
| **Send time** | How long the whole list takes |
| **Finishes** | Finish time in Eastern (date included if it runs past midnight) |
| **Segments per text**, **Total segments**, **Texts per second** | The math behind the send time |
| **Estimated cost** | Send fee, carrier fees, lookups, total and cost per 1,000 contacts, plus what the other line would cost |
| **Progress** | When 25%, 50%, 75% and 100% of the list will have gone out |
| Warnings | More than 1 segment, Unicode, over 10 hours, starts before 11 AM ET (8 AM Pacific), finishes after 9 PM ET |

**4i. Share the plan.** Click **Copy summary** and paste it into your team chat. It lists the
contacts, segments, line, start, finish and estimated cost.

✅ **Check:** the green note *"One segment per text"* appears. If it doesn't, the warnings say
what to change.

### Step 5: Run the tests (optional)

About 1 minute.

```powershell
cd sms-blast-send-time-and-cost-calculator; npm test
```

Runs [`tests/calculator.test.mjs`](tests/calculator.test.mjs). It reads the functions straight
out of [`index.html`](index.html), so it always tests the current page. Success looks like:

```
# tests 8
# pass 8
# fail 0
```

✅ **Check:** `# fail 0`.

## How segments are counted

| Message type | 1 segment | Each segment when longer |
|---|---|---|
| Plain text (GSM-7) | 160 characters | 153 characters |
| Unicode (any emoji, curly quote, long dash...) | 70 characters | 67 characters |

- `€ [ ] { } ~ ^ | \` are plain text but take two spaces each.
- An emoji takes two spaces in Unicode.
- Neither is ever cut in half across two segments, so a segment can end a space or two
  early. The counter does the same.
- Links count as characters. A long tracking link can push a text into 2 segments.

## Troubleshooting

| You see | Cause | Fix |
|---|---|---|
| **Unicode** for a text that looks plain | A curly quote, long dash or non-breaking space copied from a doc | Step 4b: click **Swap curly quotes, dashes and ellipses** |
| 2 segments at about 150 characters | One Unicode character or several two-space characters | Read the list under the message (Step 4b) |
| Real send ran much slower than the page said | Another blast or sequence was running on the same account, or the sequence throttle applied | Pick the right line in Step 4e; don't overlap blasts |
| Cost far off from the bill | Example prices still in the file, or a free allowance on your plan | Step 2b |
| **Copy summary** says *"Selected. Press Ctrl+C to copy"* | The browser blocked clipboard access | Press **Ctrl+C**; the text is already selected |
| The message box keeps an old message | The page remembers your last message in this browser | Clear the box; nothing is stored anywhere else |

## Limits

- Times are estimates. Providers give the speed as a target, not a promise, and anything else
  in the queue slows a blast down.
- Providers usually hold queued texts for about 10 hours. A send longer than that can lose
  the end of the list; the page warns you.
- Costs are before any free allowance on your plan.
- Image (MMS) speed may be lower than plain text speed; the page uses the same speed for
  both.
- Start and finish times are always US Eastern.

## Security

- The page makes no network calls except loading fonts from Google Fonts.
- No keys, tokens or contact data. The only thing saved is your last message, in your own
  browser's local storage.

Built by [Jibril Sulaiman](https://github.com/carljibrilsulaimanii).
