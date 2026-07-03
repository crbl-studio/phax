# tolower

tolower is the backend server for phax, an online drawing application.

## How it works

It is relying on the DrInFo rust library (check out the library's readme to
find out more about how the drawing works).

This is just a WebSocket server that handles incoming requests, reflects the
requests on a `Drawing` struct, and then sends the update to all other
participants.
