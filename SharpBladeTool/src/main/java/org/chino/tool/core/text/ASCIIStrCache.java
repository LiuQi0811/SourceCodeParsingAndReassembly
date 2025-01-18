package org.chino.tool.core.text;

/**
 * @ClassName ASCIIStrCache
 * @Description ASCIIStrCache 用于缓存ASCII字符的字符串
 * @Author LiuQi
 * @Date 2025/1/18 10:21
 * @Version 1.0
 */
public class ASCIIStrCache {

    /**
     * CACHE 用于缓存ASCII字符的字符串数组
     *
     * @author LiuQi
     */
    private static final String[] CACHE = new String[128];

    /**
     * ASCIIStrCache 构造方法
     *
     * @author LiuQi
     */
    public ASCIIStrCache() {

    }

    /**
     * toString  用于将ASCII字符转换为字符串
     *
     * @param char_ {@link char} 字符
     * @return {@link String} 字符串
     * @author LiuQi
     */
    public static String toString(char char_) {
        // 如果字符在ASCII范围内 则直接返回缓存中的字符串 否则返回字符的字符串表示
        return char_ < 128 ? CACHE[char_] : String.valueOf(char_);
    }

    /**
     * static 静态代码块 用于初始化缓存数组
     */
    static {
        for (char char_ = 0; char_ < 128; ++char_) { // 遍历ASCII字符
            // 将ASCII字符转换为字符串 并存入缓存数组中
            CACHE[char_] = String.valueOf(char_);
        }
    }
}
