/**
 * Intl APIs Hermes doesn't ship. ICU plural messages ("{count, plural, …}") need PluralRules
 * through intl-messageformat. Each polyfill only installs itself when the engine lacks the API,
 * so tests (Node) use the native versions. Add locale data here when a language is added.
 */
import '@formatjs/intl-getcanonicallocales/polyfill.js';
import '@formatjs/intl-locale/polyfill.js';
import '@formatjs/intl-pluralrules/polyfill.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
