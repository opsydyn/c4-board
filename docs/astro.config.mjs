import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { env } from "node:process";

const docsSite = env.DOCS_SITE_URL;
const disabledSitemap = {
  name: "@astrojs/sitemap",
  hooks: {},
};

export default defineConfig({
  ...(docsSite ? { site: docsSite } : {}),
  integrations: [
    // Starlight skips its sitemap integration when no canonical deployment URL exists.
    ...(docsSite ? [] : [disabledSitemap]),
    starlight({
      title: "c4-board Docs",
      sidebar: [
        { slug: "index" },
        {
          label: "Overview",
          items: [{ autogenerate: { directory: "overview" } }],
        },
        {
          label: "Guides",
          items: [{ autogenerate: { directory: "guides" } }],
        },
        {
          label: "OPY",
          items: [{ autogenerate: { directory: "opy" } }],
        },
        {
          label: "Architecture",
          items: [{ autogenerate: { directory: "architecture" } }],
        },
        {
          label: "Postmortems",
          items: [{ autogenerate: { directory: "postmortems" } }],
        },
        {
          label: "Archive",
          items: [{ autogenerate: { directory: "archive" } }],
        },
      ],
    }),
  ],
});
