# The article contract

Every file in this folder is one article in the documentation site. The shell
(`docs/app.js`) imports them by exact path, validates them, and renders them into
its tab structure. This file is the whole of the agreement between an article
module and the shell.

The canonical copy of this contract lives in the comment block at the top of
`docs/app.js`. If the two ever disagree, `app.js` is right — it is the thing that
actually runs.

## The shape

```js
export const article = {
  id: 'unique-kebab-id',
  title: 'Human Title',
  group: 'Group Name',
  summary: 'One sentence.',
  sections: [
    { id: 'section-id', heading: 'Heading', html: '<p>...</p>' },
  ],
  related: ['other-article-id'],
};
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Unique across the whole site. It *is* the URL: `#/unique-kebab-id`. |
| `title` | yes | The tab label and the page heading. Keep it short enough to sit in a tab. |
| `group` | yes | Tabs are grouped by this exact string. Groups appear in the order their first article is imported. |
| `summary` | yes | One sentence. Shown under the title, on the start page, in search results and on suggestion cards. |
| `sections` | yes | At least one. Each becomes an `<h2>` plus its body. |
| `sections[].id` | yes | Unique *within* the article. It is the deep link: `#/unique-kebab-id/section-id`. |
| `sections[].heading` | yes | Rendered as the `<h2>`. Do not repeat it inside `html`. |
| `sections[].html` | yes | Ordinary HTML, inserted as the section body. |
| `related` | no | Ids of other articles to suggest at the end. Unknown ids are ignored. |

The named export must be called `article`. A default export is accepted as a
fallback, but `export const article` is the contract.

## The files the shell imports

The shell imports exactly these ten paths, in this order, and the order decides
how groups are laid out in the tab strip:

```
./content/getting-started.js
./content/farming.js
./content/crafting.js
./content/logistics.js
./content/township.js
./content/exploration.js
./content/social.js
./content/deadtime.js
./content/architecture.js
./content/changelog.js
```

A file that does not exist yet is not an error. The shell records it, keeps
going, and lists it under **Settings → Content modules** with the reason. The
same is true of a module whose `article` is malformed: it is skipped with an
explanation rather than taking the site down.

One consequence worth knowing before it worries you: a module that is not there
yet logs a `404` in the browser console, because a dynamic `import()` of a
missing file is a real failed request and no amount of guarding can stop the
browser reporting it. Those entries are the count of files still to be written,
and they disappear as the files land. There should be no other console error —
if you see one that is not a `404` under `./content/`, that is a genuine defect.

The shell also contributes three articles of its own — the start page, the
download page and the settings page. Do not duplicate those.

## Writing the HTML

- **Start your own headings at `<h3>`.** The section's `heading` is already the
  `<h2>`, so an `<h2>` inside `html` breaks the outline.
- **Use ordinary elements.** The stylesheet already handles `h3`, `h4`, `p`,
  `ul`, `ol`, `table`, `pre`, `code`, `kbd`, `blockquote`, `hr`, `img` and
  `strong`. You should not need a class for normal prose.
- **Tables are wrapped automatically** in a horizontally scrolling container, so
  a wide table scrolls inside itself and never makes the page scroll sideways.
  Write a plain `<table>` and let the shell do it.
- **Callouts:** `<div class="callout callout-info">…</div>`, and the same with
  `callout-warn`, `callout-ok` or `callout-danger`.
- **Number blocks:** a `<div class="stat-row">` containing
  `<div class="stat"><div class="stat-num">148</div><div class="stat-label">assertions</div></div>`.
- **Link between articles with ordinary anchors:** `<a href="#/farming">…</a>`
  or `<a href="#/farming/crops">…</a>`. The router handles them; no JavaScript
  needed on your side.

## Two rules that are not stylistic

**Everything lives in the site.** The only links that may leave it are the
installer and release downloads, and those already live in the shell's own
Download article. Do not link out to a code host for the plan, the handoff, the
roadmap, the changelog, source browsing or issues. If a reader would otherwise
have to go elsewhere to read something, that something belongs in an article
here.

**Nothing is fetched from another origin.** No CDN, no remote font, no remote
image, no analytics, no embed. The fonts are already vendored under
`docs/fonts/`, and the game's colourful icon sprite is at `docs/icons.svg` if you
want it (`<svg><use href="./icons.svg#i-wheat"></use></svg>`). Inline SVG you
write yourself is fine.

## `html` is not sanitised

It is inserted with `innerHTML`. These modules are first-party source in this
repository, so write trusted markup and never interpolate anything a reader
supplied. There is no reader-supplied input anywhere in this site, and there
should not be.

## Checking your work

Serve the folder and open it — there is no build step:

```
npm run serve    # then open http://localhost:8123/docs/
```

Then confirm:

- your article appears as a tab, in the group you named;
- **Settings → Content modules** reports no problem against your file;
- the search field finds text from your sections;
- <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> lists each of your sections and
  jumps to the exact heading;
- nothing in the browser's network panel points at another origin;
- the page does not scroll sideways at a 320px width.
