# Third-party assets

## Country flag SVGs

The flag illustrations are bundled from [`svg-country-flags`](https://www.npmjs.com/package/svg-country-flags), version 1.2.10. The package identifies its flag images as public domain and says they originate from Wikipedia/Wikimedia Commons. The application uses the locally bundled SVGs and does not fetch them at runtime.

The original aspect ratios are retained in `src/renderer/src/data/quiz/flagMetadata.json`. Regenerate that metadata from the installed package with `npm run data:flag-metadata`.
