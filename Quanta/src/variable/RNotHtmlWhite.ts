/**
 * RNotHtmlWhite.ts
 * @author LiuQi
 */
// Only count HTML whitespace (仅统计 HTML 空白字符)
// Other whitespace should count in values (其他空白字符应在值中被计算)
// https://infra.spec.whatwg.org/#ascii-whitespace
export var rotHtmlWhite: RegExp = /[^\x20\t\r\n\f]+/g;