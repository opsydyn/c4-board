import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [
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
