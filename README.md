# Śrīyantra — Certified Plane Atlas (viewer)

An interactive, static viewer for the certified enumeration of Rao's (1998) plane
Śrī Yantra constraint system. It presents the **128 distinct configurations** as an
atlas of specimen plates, lets you inspect any one (toggle labels / base points /
axis, pan-zoom), and export each figure as SVG or PNG.

**This is a presentation layer only.** It performs no geometry. Every coordinate it
draws is read verbatim from a precomputed *bundle* that the engine's build script
generated and re-certified vertex-by-vertex at `1e-15`. The engine is the single
source of truth; the viewer never recomputes a point.

This repository is intentionally **separate** from the constraint-engine repository.
The engine is a frozen research artifact with its own DOI; this is an interactive
tool that consumes the engine's deposited output. They cross-reference each other.

## Layout

```
sri-yantra-viewer/
  index.html            entry point
  assets/styles.css     design system
  assets/app.js         gallery, detail, pan-zoom, export (no geometry)
  bundle/               <-- the generated data bundle goes here
    manifest.json
    figures/
      figures/<id>.json
      figures/<id>.svg
```

## Wiring up the bundle

In the engine repo, generate the bundle from the frozen engine, then copy it here:

```bash
# in the constraint-engine repo, at the pinned commit:
python3 build_viewer_bundle.py --roots enumeration/campaign_results/roots.jsonl --out bundle

# then place that bundle/ directory at the root of this viewer repo
cp -r /path/to/engine/bundle ./bundle
```

The build script stamps the engine commit and dataset DOI into every artifact, so
the viewer's lineage is engine → census → bundle, closed and inspectable per figure.

## Run locally

`fetch()` needs HTTP (not `file://`), so serve the folder:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages, free)

Commit everything including `bundle/`, then enable Pages on the repository (Settings →
Pages → deploy from `main`, root). No build step — it's static. The data is tiny, so a
CDN-backed static host serves the whole atlas instantly.

## Provenance and citation

The masthead and every plate show the engine commit and the dataset DOI. Keep the
commit stamped in the bundle (`build_viewer_bundle.py` → `ENGINE_COMMIT`) **identical**
to the commit named in the engine's boundary note before publishing, so the lineage is
unambiguous.

Cite the data via its Zenodo concept DOI (resolves to the latest version); cite the
viewer separately with its own DOI once this repo is deposited.

## On the count

The atlas enumerates **128 distinct roots** — the finest, unambiguous enumeration, since
each root maps deterministically to one figure. Figure-equivalence under the §7 metric is
tolerance-dependent and only approaches 128 as τ → 0. The viewer says "distinct
configurations," never "the number of distinct Śrī Yantras." That framing is inherited
from the pre-registration and should not drift.

## License

Viewer code: MIT (see LICENSE file). The figure data in `bundle/` is derived from the certified enumeration dataset (DOI: 10.5281/zenodo.20708335) and carries that dataset's license (CC-BY-4.0). The two are separate artifacts with separate terms — the viewer is open-source software; the figures are open research data.

## Viewer DOI

Once deposited on Zenodo, the viewer gets its own DOI, separate from the dataset.
The dataset and viewer cross-reference each other:

- Version DOI: `10.5281/zenodo.20747115`
- Concept DOI: `10.5281/zenodo.20747114`
- Viewer cites dataset: `10.5281/zenodo.20708335` (concept DOI)
- Dataset cites viewer: `isSupplementedBy` → viewer DOI

## Provenance verification

Engine verification:
  git rev-parse --short tier2-freeze-2:sriyantra_plane.py  → 985c741
  git rev-parse --short 75aed90:sriyantra_plane.py         → 985c741
  git diff tier2-freeze-2 75aed90 -- sriyantra_plane.py    → empty
  Engine byte-identical between freeze tag and viewer build commit.
