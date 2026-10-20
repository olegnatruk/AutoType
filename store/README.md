# Store release materials

The submission ZIP is `../dist/autotype-0.1.0.zip`. [LISTING.md](LISTING.md) contains reviewable listing copy and disclosure guidance. [privacy.html](privacy.html) is static policy source to host at a public HTTPS URL. Runtime icons are in `../extension/icons/`. Screenshot files belong in `screenshots/`.

## Screenshots

[01-passage.png](screenshots/01-passage.png) and [02-controls.png](screenshots/02-controls.png) are 1280×800 submission images, composed from the actual popup captures [popup-paused.png](screenshots/popup-paused.png) and [popup-ready.png](screenshots/popup-ready.png). Their reproducible local presentation source is [screenshot.html](screenshot.html). No Google Docs compatibility is implied by these images.

## Release gates

- Finish the live compatibility matrix in [VERIFICATION.md](../docs/VERIFICATION.md); don't claim untested support.
- Configure the publisher's support contact and host the reviewed privacy-policy source at a public HTTPS URL. Replace its pre-release contact instruction when the listing exists.
- Use a Chrome Web Store developer account; complete listing, permission justifications, privacy disclosures, distribution, and reviewer instructions.
- Upload the validated ZIP and screenshots. Submit only after final release approval. Store review/acceptance is external and is not guaranteed by local packaging.

## Reviewer instructions

Load the extension, open its popup, paste `Hello from AutoType.`, and wait for Saved. Close the popup, click an ordinary website textarea, and press the displayed start shortcut. Verify gradual insertion and the Chrome debugger banner. Start a longer passage, switch tabs to pause, return to the original editor, and use the shortcut to resume. Use Stop to cancel; Clear removes the draft. Browser restart must not automatically resume input. No account or test credential is needed for ordinary fields.

Publication flow: [Chrome Web Store publishing guide](https://developer.chrome.com/docs/webstore/publish). Even local processing needs privacy disclosure: [Google's privacy FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).
