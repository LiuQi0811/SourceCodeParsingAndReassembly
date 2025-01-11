package org.chino.tool.core.text;

import org.chino.tool.core.array.ArrayTool;

/**
 * @ClassName StrFormatter
 * @Description StrFormatter 字符串格式化处理
 * @Author LiuQi
 * @Date 2025/1/8 13:03
 * @Version 1.0
 */
public class StrFormatter {

    /**
     * StrFormatter 构造方法
     *
     * @author LiuQi
     */
    public StrFormatter() {

    }

    /**
     * format 格式化处理
     *
     * @param strPattern {@link String} 字符串模式
     * @param params     {@link Object} 参数
     * @return {@link String} 格式化处理后字符串
     * @author LiuQi
     */
    public static String format(String strPattern, Object... params) {
        // formatWith 格式化方式处理
        return formatWith(strPattern, "{}", params);
    }

    /**
     * formatWith 格式化方式
     *
     * @param strPattern  {@link String} 字符串模式
     * @param placeHolder {@link String} 占位符
     * @param params      {@link Object} 参数
     * @return {@link String} 格式化处理后字符串
     * @author LiuQi
     */
    public static String formatWith(String strPattern, String placeHolder, Object... params) {
        if (!StrTool.isBlank(strPattern) && !StrTool.isBlank(placeHolder) && !ArrayTool.isEmpty(params)) { // 字符串模式不为空 并且 占位符不为空 并且数组参数不为空
            // 字符串长度
            int strPatternLength = strPattern.length();
            // 占位符长度
            int placeHolderLength = placeHolder.length();
            // 创建StringBuilder对象
            StringBuilder builder = new StringBuilder(strPatternLength + 50);
            // 声明处理位置
            int handledPosition = 0;
            for (int i = 0; i < params.length; ++i) { // 参数遍历
                // 占位符索引位置
                int delimIndex = strPattern.indexOf(placeHolder, handledPosition);
                if (delimIndex == -1) { // 没有找到占位符
                    if (handledPosition == 0) {
                        // 没有找到占位符 直接返回
                        return strPattern;
                    }
                    // 根据处理位置 到字符串长度位置 字符串拼接
                    builder.append(strPattern, handledPosition, strPatternLength);
                    // 返回拼接后的字符串
                    return builder.toString();
                }
                if (delimIndex > 0 && strPattern.charAt(delimIndex - 1) == '\\') { // 占位符前面有转义字符 直接拼接 转义字符和占位符 -  含有一个转义字符
                    if (delimIndex > 1 && strPattern.charAt(delimIndex - 2) == '\\') {
                        // 根据处理位置 到占位符索引位置 - 1 字符串拼接
                        builder.append(strPattern, handledPosition, delimIndex - 1);
                        // 转utf8字符串拼接
                        builder.append(StrTool.utf8Str(params[i]));
                        // 处理位置索引更新 占位符索引位置 + 占位符长度
                        handledPosition = delimIndex + placeHolderLength;
                    } else {
                        // 索引递减
                        --i;
                        // 根据处理位置 到占位符索引位置 - 1 字符串拼接 - }
                        builder.append(strPattern, handledPosition, delimIndex - 1);
                        // 占位符第一个字符拼接 - {
                        builder.append(placeHolder.charAt(0));
                        // 处理位置索引更新 占位符索引位置 + 1
                        handledPosition = delimIndex + 1;
                    }
                } else { // 占位符前面没有转义字符 拼接处理
                    // 根据处理位置 到占位符索引位置 字符串拼接
                    builder.append(strPattern, handledPosition, delimIndex);
                    // 转utf8字符串拼接
                    builder.append(StrTool.utf8Str(params[i]));
                    // 处理位置索引更新 占位符索引位置 + 占位符长度
                    handledPosition = delimIndex + placeHolderLength;
                }
            }
            // 根据占位符索引位置 到字符串长度位置 字符串拼接
            builder.append(strPattern, handledPosition, strPatternLength);
            // 返回拼接后的字符串
            return builder.toString();
        } else { // 字符串模式为空 或者 占位符为空 或者数组参数为空
            // 直接返回原字符串
            return strPattern;
        }
    }
}
