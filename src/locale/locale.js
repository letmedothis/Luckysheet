import dictionaries from './active'
import Store from '../store';

export const locales = { ...dictionaries }

// 动态注册语言包（配合 slim 构建按需补充未打包语言）
export function registerLocale(name, dictionary) {
    locales[name] = dictionary;
}

const warned = new Set();

function locale(){
    let lang = Store.lang;
    if (!locales[lang]) {
        if (!warned.has(lang)) {
            warned.add(lang);
            console.warn(`[luckysheet] locale "${lang}" not registered, fallback to "en"`);
        }
        lang = "en";
    }
    return locales[lang];
}

export default locale;
