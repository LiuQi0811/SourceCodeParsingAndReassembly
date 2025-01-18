package org.chino.tool.core.text;

/**
 * @ClassName CharTool
 * @Description CharTool 字符处理工具
 * @Author LiuQi
 * @Date 2025/1/8 11:15
 * @Version 1.0
 */
public class CharTool {

    /**
     * CharTool 构造方法
     *
     * @author LiuQi
     */
    public CharTool() {

    }

    /**
     * isChar 是否为字符
     *
     * @param value {@link Object} 对象
     * @return {@link Boolean} 返回是否为字符 true 是 false 否
     * @author LiuQi
     */
    public static boolean isChar(Object value) {
        // 返回 是否为字符处理结果 参数是Character 或者 参数类型为Character.TYPE
        return value instanceof Character || value.getClass() == Character.TYPE;
    }

    /**
     * isBlankChar 是否为空白字符
     *
     * @param char_ {@link char} 字符
     * @return {@link Boolean} 返回是否为空白字符 true 是 false 否
     * @author LiuQi
     */
    public static boolean isBlankChar(char char_) {
        // isBlankChar 是否为空白字符处理
        return isBlankChar((int) char_);
    }

    /**
     * isBlankChar 是否为空白字符
     *
     * @param char_ {@link int} 字符
     * @return {@link Boolean} 返回是否为空白字符 true 是 false 否
     * @author LiuQi
     */
    public static boolean isBlankChar(int char_) {
        // 返回 是否为空白字符处理结果
        return Character.isWhitespace(char_)
                || Character.isSpaceChar(char_)
                || char_ == 65279
                || char_ == 8234
                || char_ == 0
                || char_ == 12644
                || char_ == 10240
                || char_ == 6158;
    }

    /**
     * toString 将字符转换为字符串
     *
     * @param char_ {@link char} 字符
     * @return {@link String} 返回字符串
     * @author LiuQi
     */
    public static String toString(char char_) {
        // 返回 ASCII字符转换为字符串处理结果
        return ASCIIStrCache.toString(char_);
    }

}
