package org.chino.tool.core.tool;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

/**
 * @ClassName CharsetTool
 * @Description CharsetTool 字符编码处理工具
 * @Author LiuQi
 * @Date 2025/1/8 14:12
 * @Version 1.0
 */
public class CharsetTool {

    /**
     * UTF_8 字符串编码
     */
    public static final String UTF_8 = "UTF-8";

    /**
     * CHARSET_UTF_8 字符集编码
     */
    public static final Charset CHARSET_UTF_8;

    /**
     *  static 静态代码块 初始化静态变量
     * @author LiuQi
     */
    static {
        // UTF-8 字符集编码
        CHARSET_UTF_8 = StandardCharsets.UTF_8;
    }
}
