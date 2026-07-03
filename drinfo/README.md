# DrInFo

DrInFo stands for Drawing Information Format. It is a format that stores a
drawing by remembering how it was drawn.

DrInFo is still actively being developed, and the file format isn't stable.
Planned changes include: migrate from CBOR to custom encoding, add versioning
to allow new instructions being added without breaking backwards compatibility,
etc. While DrInFo hasn't reached 1.0, no effort will be put into making updates
backwards compatible.

## How it works

It is based on the following mechanisms :

- Everything is an instruction
- Image is stored as an ordered list of instructions
- Rendering is done by processing all of the instructions
- Instructions are saved per layer.
