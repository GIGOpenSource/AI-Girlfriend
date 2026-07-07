import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zh from './locales/zh.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import pt from './locales/pt.json';
import es from './locales/es.json';
import id from './locales/id.json';

const resources = {
  zh: { translation: zh },
  en: { translation: en },
  ja: { translation: ja },
  ko: { translation: ko },
  pt: { translation: pt },
  es: { translation: es },
  id: { translation: id },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
