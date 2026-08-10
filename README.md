# Open Field

Build a web-based GIS publishing platform inspired by Felt and Atlas. The platform should allow authenticated users to create map projects, upload GeoJSON datasets, connect public CSV and ArcGIS REST services, style layers visually, configure labels and popups, and publish interactive public webmaps. Public maps should support layer toggles, legends, search, embedded viewing via iframe, and geolocated commenting. Use React, TypeScript, MapLibre GL JS, Tailwind, and Supabase. Prioritize usability for non-developer GIS professionals transitioning workflows from QGIS to the web. Focus on a clean, modern interface and a lightweight MVP before implementing advanced GIS editing or analysis features.

-----

Build Map Studio as an open-source GIS publishing platform optimized for taking datasets from QGIS and publishing modern interactive webmaps. Focus exclusively on the MVP requirements described in this document. Implement features phase-by-phase, beginning with authentication, project management, and data ingestion. Prioritize usability, maintainability, and clean cartographic presentation over advanced GIS analysis capabilities. The platform should feel closer to Felt or Atlas than to a traditional GIS application.

--

Here's a startup doc on google, can you read it?

https://docs.google.com/document/d/e/2PACX-1vT2vAUxM_Sipowm7KeVheIXgcYgwlgWVlI2-1JLWd5tlBnb7xDUt58OhOnIiIGftOO-WH2_3to_9U5K/pub

---

Please let's plan for some time before starting to build, ask as many clarifying questions as you need to. I'd like this to get built in steps, not all at once, we need something stable and functional, it's okay to move in steps.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://openfieldstudio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/32718663-a6d0-4df5-9653-e6ad4bfb7e0e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
