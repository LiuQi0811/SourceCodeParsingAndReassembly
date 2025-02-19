package org.chino.SharpBladeUtils.core.text;

/**
 * @ClassName StrValidator
 * @Description StrValidator 字符串校验处理
 * <ul>
 *     <li>empty定义：{@code null} or 空字符串：{@code ""}</li>
 *     <li>blank定义：{@code null} or 空字符串：{@code ""} or 空格、全角空格、制表符、换行符，等不可见字符</li>
 * </ul>
 * @Author LiuQi
 * @Date 2025/2/19 15:33
 * @Version 1.0
 */
public class StrValidator {

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
