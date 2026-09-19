// 语言包激活入口：默认打包全部语言（与历史行为一致）。
// 构建时可用 LUCKYSHEET_LANGS=en,zh 通过 vite alias 替换本文件以裁剪体积。
import en from "./en";
import zh from "./zh";
import es from "./es";
import zh_tw from "./zh_tw";

export default { en, zh, es, zh_tw };
