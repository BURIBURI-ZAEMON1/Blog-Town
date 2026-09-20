import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  integrations: [react()],
  vite: {
    plugins: [{
      name: 'astro-routes-hmr-compat',
      enforce: 'post',
      transform(code, id) {
        if (!id.includes('virtual:astro:routes')) return null;
        // Astro 7.2.4 emits this virtual module with `astro/app` during a
        // content HMR rebuild. That barrel can be invalidated to an export
        // without deserializeRouteInfo; the stable manifest entrypoint keeps
        // route refreshes working without touching node_modules.
        return code.replace(
          "import { deserializeRouteInfo } from 'astro/app';",
          "import { deserializeRouteInfo } from 'astro/app/manifest';",
        );
      },
    }],
  },
});
