package org.chino.tool.core.text;

import org.chino.tool.core.tool.ArrayTool;
import org.chino.tool.core.tool.CharTool;

/**
 * @ClassName CharSequenceTool
 * @Description CharSequenceTool 字符序列处理工具
 * @Author LiuQi
 * @Date 2025/1/8 10:28
 * @Version 1.0
 */
public class CharSequenceTool {

    /**
     * CharSequenceTool 构造方法
     *
     * @author LiuQi
     */
    public CharSequenceTool() {

    }

    /**
     * isBlank 字符序列是否为空
     *
     * @param sequence {@link CharSequence} 字符序列
     * @return {@link Boolean} 字符序列是否为空 true 是 false 否
     * @author LiuQi
     */
    public static Boolean isBlank(CharSequence sequence) {
        // 声明长度
        int length;
        if (sequence != null && (length = sequence.length()) != 0) { // 字符序列不为空 并且 字符序列长度不为0
            for (int i = 0; i < length; ++i) { // 遍历字符序列
                if (!CharTool.isBlankChar(sequence.charAt(i))) { // 字符序列不为空
                    return false;
                }
            }
            // 字符序列为空
            return true;
        } else { // 字符序列为空
            return true;
        }
    }

    /**
     * format 格式化字符串模板 替换占位符为参数值
     *
     * @param template {@link CharSequence} 模板字符串
     * @param params   {@link Object} 参数值
     * @return {@link String} 格式化后的字符串
     */
    public static String format(CharSequence template, Object... params) {
        if (template == null) { // 模板字符串为空
            // 返回null字符串
            return "null";
        } else { // 模板字符串不为空
            // 数组参数不为空 并且 模板字符串不为空
            return !ArrayTool.isEmpty(params) && !isBlank(template) ? "StrFormatter.format" : template.toString();
        }
    }
}
