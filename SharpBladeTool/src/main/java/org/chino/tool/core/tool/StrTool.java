package org.chino.tool.core.tool;

import org.chino.tool.core.text.CharSequenceTool;

import java.nio.charset.Charset;

/**
 * @ClassName StrTool
 * @Description StrTool 字符串处理工具 继承自 CharSequenceTool 类 提供字符串处理功能
 * @Author LiuQi
 * @Date 2025/1/8 10:23
 * @Version 1.0
 */
public class StrTool extends CharSequenceTool {

    /**
     * StrTool 构造方法
     *
     * @author LiuQi
     */
    public StrTool() {

    }

    /**
     * utf8Str UTF8编码字符串
     *
     * @param data {@link Object} 数据
     * @return {@link String} utf8编码字符串
     * @author LiuQi
     */
    public static String utf8Str(Object data) {
        //  str 字符串处理
        return str(data, CharsetTool.CHARSET_UTF_8);
    }

    /**
     * str 字符串处理
     *
     * @param data    {@link Object} 数据
     * @param charset {@link Charset} 字符编码
     * @return {@link String} 处理后字符串
     * @author LiuQi
     */
    public static String str(Object data, Charset charset) {
        if (null == data) { // 数据为空 返回null
            return null;
        } else if (data instanceof String) { // 数据为字符串 直接返回
            return (String) data;
        } else { // 数据为其他类型 转字符串处理
            // TODO 此处可以添加其他类型转字符串的处理逻辑 比如数字 转字符串等
            return data.toString();
        }
    }

}
