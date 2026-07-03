# phax

phax is a combination of tools that form a collaborative online photo editing and drawing platform.

phax is being actively developed and many basic photo editing and drawing
features are still missing, but they're coming.

![a drawing of a mountain](./mountain_drawing.jpg)

phax is composed of:

- DrInFo: a unique file format and data structure to store photo editing and drawing information efficiently.
- tolower: a server that allows multiple clients to work on a shared DrInFo file.
- toupper: a frontend for tolower that allows people to draw and edit photos in a familiar way.

## Features

phax has many features, including:

- real time collaboration
- participants live cursor
- layers
- per layer undo/redo
- infinite history
- editable history

Here are some unique things you can do with phax:

- Move a history element up and down.
- Move a history element from a layer to another.
- Edit history element data to change stroke brush, motion coordinates, image positioning, etc. (WIP).
- Create unique brushes and directly import them into phax (WIP).
- Move your drawing on a different layer because you accidentally drew on your sketch layer.
- Draw or edit photos in real time with other people.

## Set up

1. Run `cargo run --release`
1. Run `pnpm i && pnpm run dev`
