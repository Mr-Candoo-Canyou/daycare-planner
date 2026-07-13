// i18n architecture from the first line of code (SPEC.md §7.2): every
// user-facing string goes through t() with a key and an English default. The English
// translation file is generated from source by `npm run i18n:extract`;
// adding Inuktitut later means adding an iu.json file — no code changes.

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
})

export default i18n
