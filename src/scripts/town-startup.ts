import { requestTownFonts } from '../lib/town-fonts';

// Discover the town runtime before React hydration; TownScene reuses this module.
const startsInTown = document.documentElement.dataset.initialSurface === 'town';
if (startsInTown) {
  void import('../scene/brick-town/runtime').catch(requestTownFonts);
  // WebGL is the town's renderer. Fetch its core shader modules in parallel,
  // rather than discovering them only after scene construction and first render.
  void import('../scene/brick-town/base-shaders').catch(() => { /* Babylon can retry through its own lazy shader loader. */ });
  if (window.innerWidth >= 720) {
    void import('../scene/brick-town/desktop-pipeline').catch(() => { /* Optional desktop refinement. */ });
  }
} else {
  void requestTownFonts();
}
