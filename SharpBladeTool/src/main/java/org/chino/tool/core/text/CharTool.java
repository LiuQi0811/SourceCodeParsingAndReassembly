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
     * isBlankChar 是否为空白字符
     *
     * @param char_ {@link char} 字符
     * @return {@link Boolean} 返回是否为空白字符 true 是 false 否
     * @author LiuQi
     */
    public static Boolean isBlankChar(char char_) {
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
    public static Boolean isBlankChar(int char_) {
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

}
