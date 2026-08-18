# Wiki sources

These pages are the source of truth for the GitHub wiki. They are kept in the main repo so
documentation changes are reviewed alongside code changes.

To publish to the GitHub wiki of the hosting repo (the wiki git repo exists once the wiki
has at least one page created through the UI):

```sh
git clone https://github.com/<owner>/atomicassets-contract.wiki.git /tmp/contract-wiki
cp docs/wiki/*.md /tmp/contract-wiki/      # README.md is harmless to include
cd /tmp/contract-wiki
git add -A && git commit -m "Sync wiki from docs/wiki" && git push
```

The copy step never deletes: when a page is removed from docs/wiki, `git rm` it in the wiki
clone during the same sync, or the wiki keeps serving the removed page.

Page links between the files use wiki-style page names (e.g. `[Home](Home)`), which resolve
on the GitHub wiki. When viewing these files inside the repo, append `.md` mentally.
