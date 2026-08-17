# Releasing atomicassets-contract

How a version of this contract reaches GitHub Releases. A release ends at a
rendered Release carrying `atomicassets.wasm`, `atomicassets.abi` and
`SHA256SUMS` as assets, not at the pushed tag: those checksums are what a
deployer pins and what a signer of a multi-party proposal verifies against.

Tags are `vX.Y.Z` (`v2.0.0`), and a release candidate is `vX.Y.Z-rcN`
(`v2.0.0-rc5`). The release artifacts are built with the CDT version CI pins,
4.1.1, so a reader can rebuild the tag and get the hashes the notes name.

## Checklist

1. The feature PR carries the `CHANGELOG.md` entry for the version under
   `## [X.Y.Z]`, written in the section shape below with H3 headings. Its
   `### Upgrading` states the ABI compatibility with the previous stable release
   (byte-identical, additive, or breaking with the migration a consumer makes)
   and the `setversion` value, which is the core semver of the tag. The rows of
   the checksum table are left empty here, because the build in step 2 produces
   them. The entry is the editorial text of the Release, so it is written once,
   in the PR that makes the change.

2. Build the release artifacts from a clean tree and write the checksum file:

    ```sh
    make clean
    make release
    (cd build && sha256sum atomicassets.wasm atomicassets.abi) > SHA256SUMS
    ```

    `make release` compiles with the pinned CDT and patches the ABI back to the
    legacy spellings, which is what the released `.abi` carries. This
    repository has no docker build path, so the release build needs the CDT
    that CI installs (`CDT_VERSION` in `.github/workflows/contracts-ci.yaml`)
    installed natively. The checksum file uses bare asset names, so it verifies
    against the downloaded assets in step 6. Copy its two rows into the entry's
    `### Upgrading` table:

    ```
    | Asset | sha256 |
    | --- | --- |
    | `atomicassets.wasm` | `<sha256>` |
    | `atomicassets.abi` | `<sha256>` |
    ```

    Land that as a `chore(release): X.Y.Z` commit touching `CHANGELOG.md`
    alone. The wasm and the ABI do not depend on `CHANGELOG.md`, so a build of
    the tag reproduces the hashes the entry names. `SHA256SUMS` is a release
    asset rather than a committed file, and it stays out of the commit. A
    stable release that ships the last candidate's build has identical rows
    already in the entry: tag the candidate's commit and land nothing new.

3. Preview the body before anything is tagged:

    ```sh
    scripts/release-notes.sh vX.Y.Z main
    ```

    The preview composes the body from the `CHANGELOG.md` entry at that branch
    and the commits since the previous tag, and it fails when the entry is
    missing. It does not check the section names, so read the preview against
    the template below. Pass `origin/main` in a clone without a local `main`.
    The compare link is built from the `origin` remote, so cut the release from
    a clone whose `origin` is this repository, not a fork.

4. Tag the release commit and push the tag:

    ```sh
    git tag vX.Y.Z && git push origin vX.Y.Z
    ```

    A candidate is tagged `vX.Y.Z-rcN`. Push the tag before creating the
    Release, because `--verify-tag` refuses a tag the remote does not have.

5. Compose the body, read it, then create the Release with its assets:

    ```sh
    scripts/release-notes.sh vX.Y.Z > notes.md
    gh release create vX.Y.Z --verify-tag --title vX.Y.Z --notes-file notes.md \
        build/atomicassets.wasm build/atomicassets.abi SHA256SUMS
    ```

    Add `--prerelease` for a `-rcN` tag, so the candidate does not become the
    repository's latest Release. Add `--latest=false` when the Release is for a
    tag older than the current latest one, so the latest marker does not move
    backwards. With more than one release in flight, create them in ascending
    version order.

6. Verify the published Release against its own assets:

    ```sh
    gh release download vX.Y.Z --dir /tmp/vX.Y.Z
    (cd /tmp/vX.Y.Z && sha256sum -c SHA256SUMS)
    ```

    The body's table names the same two hashes. When either check fails, never
    re-attach an asset and never move the tag on a published Release: a
    consumer that pinned these hashes fails closed on any change, and a signer
    may already have verified a proposal against them. Cut the next patch
    version instead.

Deploying the contract, whether by key or by multi-party proposal, and the
`setcode`, `setabi`, `setversion` and resource steps that go with it, stays with
the deployer's own procedure. The Release is what they pin and verify against.

## Body template

The Release title is the tag name verbatim. The body is an optional
one-sentence summary, then the sections that have items, then the commit list,
then the compare link as the last line. Nothing follows the link, and a section
with no items is left out.

```
<one-sentence summary, optional>

## Breaking changes

- <what changed, and what the reader does about it>. (#N)

## Upgrading

- <what the move from the previous stable release takes: the checksums, the ABI compatibility, the setversion value>.

## Features

- <what is new>. (#N)

## Bug fixes

- <what was wrong and is not now>. (#N)

## Security

- <the advisory or the dependency lift, named>. (#N)

## Deprecations

- <what is deprecated and what replaces it>. (#N)

## Other changes

- <a change a consumer notices that fits no section above>. (#N)

## Commits

- <short sha> <subject>

Full changelog: https://github.com/atomicassets/atomicassets-contract/compare/<PREV>...<TAG>
```

The section order is breaking changes, upgrading, features, bug fixes,
security, deprecations, other changes.

A Release body carries no credits section. Contributor and lineage credit lives
in [AUTHORS.md](./AUTHORS.md) and the README, where it is maintained once
rather than restated per version.

`## Upgrading` is for the deployer and the integrator, and it is written against
the previous stable release rather than against the tag range the commit list
covers. For this contract it carries the checksum table of the released wasm and
ABI, the statement of how the ABI compares with the previous stable release
(byte-identical, additive, or breaking with the migration a consumer makes), the
`setversion` value, and any ordering or resource note the deploy depends on. A
candidate body may confine it to the change since the previous candidate that
has a Release, because that is the move a test deployment makes; the stable body
describes the whole move. One table is allowed here, and it lists the released
artifact checksums. Items elsewhere stay bullets.

`## Security` carries advisories and dependency lifts, each naming its GHSA or
CVE identifier. A release with neither section leaves both out.

## Voice

- Neutral and factual, the register of the Node.js or esbuild release notes.
- Sectioned. The heading says what kind of change it is, so the item does not
  repeat it.
- One to three plain sentences per item: what changed, and what the reader does
  about it when action is needed. Code identifiers in backticks.
- Every item ends with its PR reference `(#N)`, or with its short sha in
  backticks when the change had no PR. An `## Upgrading` item that states a
  deploy fact rather than a change, such as a checksum or an ABI that has not
  moved, carries no reference.
- No preface, no motivation essay, no clause chain explaining how the author got
  there. The why stays only where it changes what the reader does.
- Present tense for the new behavior, sentence-case headings, straight quotes,
  and no em-dash.

## The CHANGELOG entry

`CHANGELOG.md` is where the editorial text is written, and the Release body is
that entry with its headings promoted one level.

An entry heading is `## [X.Y.Z]`, optionally followed by ` - YYYY-MM-DD`. Under
it comes an optional one-line summary, then the H3 sections in the order above
(`### Breaking changes`, `### Upgrading`, and the rest). A candidate tag
`vX.Y.Z-rcN` reads the `## [X.Y.Z]` entry as it stands at that tag, so a
candidate body shows the notes for the version so far and the stable body shows
the finished entry.

## Tag ranges, candidates, and older releases

- `PREV` for a stable tag is the nearest earlier stable `v*` tag, so a stable
  release lists every commit since the last stable release and skips the
  candidates between them. `PREV` for a candidate tag is the nearest earlier tag
  of any kind, which is usually the previous candidate. A stable tag whose only
  earlier tags are candidates takes the nearest of them, so the first stable
  release after a candidate line lists what it adds to the last candidate.
- Tags from the upstream v1 line count as earlier tags, so `v2.0.0` lists the
  commits since `v1.2.3`. Those v1 tags carry no Release of their own.
- `## Commits` lists the whole `PREV..TAG` range, oldest first, including the
  release commit. Its line count equals `git rev-list --count PREV..TAG`.
- A tag with no earlier tag has no `PREV`. Its body is the summary and the
  sentence `Initial release.`, with no commit list and no compare link, and it
  is written by hand.
- A candidate tag is created with `--prerelease`, and a Release created for a
  tag older than the current latest is created with `--latest=false`.

`scripts/release-notes.sh` needs bash, git, awk and sed. Without a ref it reads
`CHANGELOG.md` at the tag rather than from the working tree, so the body
describes what the tag ships. It exits non-zero and names what is missing when
no tag is given, when the tag does not exist, when the CHANGELOG at that ref
carries no entry for the version, and when no earlier tag exists.
