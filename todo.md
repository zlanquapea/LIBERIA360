
## Creators feed play icon removal

- [ ] Inspect the feed preview and full-screen viewer controls.
- [ ] Remove only the centered play icon from feed videos while preserving tap-to-open behavior.
- [ ] Run focused web validation and deploy the change to Railway.

## Live Creators play-icon investigation

- [ ] Confirm Railway is serving the pushed commit and reproduce the visible overlay.
- [ ] Trace every feed-level play icon source, including cached or alternate media components.
- [ ] Apply the smallest corrective fix, validate, and redeploy.

## Remaining live feed play icon

- [x] Trace the alternate video preview component shown in the latest live screenshot.
- [x] Remove only its feed-level centered play affordance.
- [x] Validate, deploy, and confirm the live feed no longer shows the icon.
