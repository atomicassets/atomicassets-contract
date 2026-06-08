# Authors and credits

AtomicAssets was created by [pink.network](https://pink.network) (the original v1
standard and contract).

## AtomicAssets v2

The bulk of the v2 contract work was authored by **t-break ([@on-a-t-break](https://github.com/on-a-t-break))**,
originally in the [wax-office-of-inspector-general/atomicassets-contract](https://github.com/wax-office-of-inspector-general/atomicassets-contract)
repository. The v2 features were developed there as separate pull requests:

- Feature 1: reduce max template supply (OIG PR #3)
- Feature 2: delete unused templates (OIG PR #2)
- Features 3 and 6: mutable templates, non-burnable/non-transferable (OIG PRs #4, #7, #8)
- Feature 4: media types for schemas (OIG PR #5)
- Feature 5: changing collection authors (OIG PR #6)
- Feature 7: deprecating backed assets (OIG PR #9)
- Feature 8: contract-wide CPU optimizations (OIG PR #11)
- Feature 300: renting assets, version B (OIG PR #10)
- Integrated v2 build, features 1-8 + 300 (OIG PR #12)

This canonical `atomicassets/atomicassets-contract` repository ports that work for
release and audit. The original commit history and authorship from the OIG repo are
preserved in the per-feature and integration branches, which also credit the wider
team that contributed there (Jona Wilmsmann, Dallas Johnson, Moritz do Rio Schulze,
Christoph Michel, and danielvo11).

The self-service RAM utilities (`setrampayer`, `setlastpayer`, `logrampayer`) were
contributed by **Aaron Cox ([@aaroncox](https://github.com/aaroncox), Greymass)**.
