# Contributing to Leggio

Thank you for wanting to help. Leggio is a small markdown reader built for reading, and I want to keep it small. This page explains what fits the project, how to set it up, and what I check before I merge a pull request.

## Using AI tools

You can use AI tools for any part of a contribution: code, tests, issues, descriptions. You don't need to know how every line works. What I ask is that you understand the feature or fix you propose, and stand behind it:

- You know what problem it solves and how it behaves for the person reading.
- You ran it yourself in a browser, and it does what the description says.
- The description is accurate. If a tool wrote it, read it and correct it before you post.

If a pull request doesn't do what it says, or its author can't answer questions about the feature, I'll close it and say why. You can reopen it after a fix. A draft pull request is always fine if you want feedback before it's ready.

## What fits Leggio

- **Reading only.** Leggio never changes your files. I won't merge features that edit, save, rename or delete files.
- **Few dependencies.** The project has 13 packages in total, counting indirect dependencies. All are pinned to exact versions, with install scripts disabled. See "Before you start" for the rule on new dependencies.
- **Local and private.** Leggio never uploads your files, and it fetches only what you ask it to open. It has no accounts, no analytics, no server code, and nothing is stored off your device (Recent keeps copies of what you read, on the device only). Changes must keep it that way. Four things use the network: a document you open by its web address loads from that address, the fonts of some themes load from Google Fonts, images from the web that a document links to load from their own servers, and if you pick an online voice for read-aloud, the browser sends the text being read to that voice service. The voice setting says so. Share puts the document inside the link itself, never on a server, and a shared document loads web images only after the reader asks.
- **Browsers.** Leggio works best in a Chromium-based browser such as Chrome or Edge, because it reads files and folders through the File System Access API. That browser feature lets a web page read the files and folders you choose, again and again, which gives live reload, pins and restore. Other browsers, and a Chrome where a company setting blocks that feature, get a copy of the files instead. A change must keep both ways working.

## Before you start

- **Small fixes**, like a typo or a bug with an obvious cause, can go straight to a pull request.
- **Features and visual changes** are easier to accept if you open an [issue](https://github.com/arnaugiralt/leggio/issues) first, so I can say early whether the idea fits. A pull request without one is welcome too. It may need more changes, or not fit the project.
- **New dependencies** always need an issue first. Explain why a few lines of code can't do the same job.

## Report a bug

Open an [issue](https://github.com/arnaugiralt/leggio/issues) with the steps to reproduce, your browser and its version, and a sample markdown file if the problem depends on the content.

## Set up

You need Node.js 24 or newer and pnpm 10.

```sh
pnpm install   # exact versions, install scripts disabled
pnpm dev       # http://localhost:8000, rebuilds on change
pnpm test      # node --test, no browser needed
pnpm build     # writes site/, the folder that gets deployed
pnpm serve     # builds, then serves site/ on http://localhost:8765
```

`pnpm dev` doesn't update the page by itself, so reload it after each change.

## Make a change

- Match the style of the code around your change. The project has no linter and no formatter.
- Write comments that explain why: a browser behavior that isn't obvious, or an alternative you rejected. Don't comment on what a line does.
- Keep each pull request to one change, and don't reformat code you didn't touch.
- Read [AGENTS.md](AGENTS.md) before a larger change. It lists the rules that are easy to break by accident, such as keeping `src/render.js` pure and never letting a click on a link inside a document navigate the app window to another page.

## Check your change

`pnpm test` covers the modules without a user interface: rendering (with the HTML allowlist and footnotes), settings (presets' contrast and imported files), share links, recent documents, the sentence splitting for read-aloud, and the path helpers. It doesn't test anything on screen, so check every visible change in a browser, in a wide window and in a narrow one (about 390 px).

Some changes need extra checks. This applies to changes to the interface (the top bar, the panels, the settings, the notices) and to the Default theme, light and dark. These changes must also:

- work with the keyboard alone, with a visible focus ring
- give text a contrast of at least 4.5:1 against its background

New themes, and changes to the other themes, don't need to meet these rules.

## Pull requests

Describe what changed, why, and how you checked it. GitHub shows a [template](.github/pull_request_template.md) with these questions when you open the pull request. Add screenshots for every visual change. Start commit messages with `feat:`, `fix:`, `style:`, `refactor:`, `docs:` or `chore:`, followed by a short summary.

I review every pull request myself, so a review can take a few days.

## Security

Don't report security problems in a public issue. Use GitHub's private vulnerability reporting instead: open the **Security** tab of this repository and choose **Report a vulnerability**.

## License

Your contribution is licensed under the [MIT License](LICENSE), the same license as the rest of the project. There is no contributor license agreement and no sign-off requirement.
