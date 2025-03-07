package org.chino.SharpBladeUtils.core.text;

/**
 * @ClassName StringValidator
 * @Description StringValidator 字符串校验处理
 * <ul>
 *     <li>empty定义：{@code null} or 空字符串：{@code ""}</li>
 *     <li>blank定义：{@code null} or 空字符串：{@code ""} or 空格、全角空格、制表符、换行符，等不可见字符</li>
 * </ul>
 * @Author LiuQi
 * @Date 2025/2/19 15:33
 * @Version 1.0
 */
public class StringValidator {
    /**
     * 字符串常量：{@code "null"} <br>
     * 注意：{@code "null" != null}
     */
    public static final String NULL = "null";
    /**
     * EMPTY 字符串常量：空字符串 {@code ""}
     */
    public static final String EMPTY = "";

    /**
     * isBlank 字符串是否为空
     *
     * @param charSequence {@link CharSequence} 字符串
     * @return 为空返回 true 否则返回false
     * @description 字符串是否为空白，空白的定义如下：
     *  <ol>
     *      <li>{@code null}</li>
     *      <li>空字符串：{@code ""}</li>
     *      <li>空格、全角空格、制表符、换行符，等不可见字符</li>
     *  </ol>
     *  <p>例：</p>
     *  <ul>
     *     <li>{@code StrUtil.isBlank(null)     // true}</li>
     *     <li>{@code StrUtil.isBlank("")       // true}</li>
     *     <li>{@code StrUtil.isBlank(" \t\n")  // true}</li>
     *     <li>{@code StrUtil.isBlank("abc")    // false}</li>
     * </ul>
     * @author LiuQi
     */
    public static boolean isBlank(final CharSequence charSequence) {
        // strLen 字符串长度
        final int strLen;
        // 字符串 或者字符串长度为0，则返回true
        if ((charSequence == null) || (strLen = charSequence.length()) == 0) return true;
        for (int i = 0; i < strLen; i++) { // 遍历字符串
            // 如果当前字符不为空白，则返回false
            if (!CharUtil.isBlankChar(charSequence.charAt(i))) return false;
        }
        // 所有字符均为空白，则返回true
        return true;
    }

    /**
     * isEmpty 字符串是否为空
     *
     * @param charSequence {@link CharSequence} 字符序列
     * @return {@code true} 是 {@code false} 否
     * @author LiuQi
     */
    public static boolean isEmpty(final CharSequence charSequence) {
        // 如果为空，则返回true
        return charSequence == null || charSequence.length() == 0;
    }
}
