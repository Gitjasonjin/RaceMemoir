# Internationalization

Supported languages are Simplified Chinese (`zh-CN`), English (`en`) and Japanese (`ja`). Resources are bundled for offline switching. The independent `racememoir-language` preference never travels with a board backup.

- Add copy to all three files in `locales/`. Existing `Component.NNN` keys are stable migration identifiers; do not renumber them. Prefer descriptive keys for new features.
- Use `t(key, values)` when rendering. Use complete sentences with interpolation instead of concatenating translated fragments. For English counts, pass `count` and provide `_one` / `_other` entries.
- For asynchronous notices, use `msg(key, values)` and `useNotice()`. Throw `AppError(key, values)` from application operations and catch with `errorNotice(error, fallback)`. This keeps already-visible messages translatable without restarting work.
- Catalog labels are evaluated on access. Do not call `t()` once at module initialization and store the resulting string.
- `App` subscribes to language changes; memoized `Artwork` subscribes separately. New independently memoized localized components should call `useTranslation()` too. Never use the locale as an editor key: that would discard drafts.
- User names, notes, locations, uploaded images and existing sample content are data. Do not translate them on display or rewrite them on language changes. Fresh defaults are translated once when created.
- Format structured dates and numeric presentation through runtime helpers. Storage values, IDs, file formats and units remain unchanged. Online map tile labels and required attribution remain provider-owned.
- The worker posts progress stages; UI messages are resolved in the main thread. No source image is sent to a translation service.

Run `npm run check:i18n`, unit tests and `tests/browser/i18n.spec.ts` when changing translations. The check validates resource coverage and parameters, and flags new hardcoded Chinese UI text. English/Japanese wording still needs human review.
