package org.chino.SharpBladeUtils.core.text;

/**
 * @ClassName ASCIIStrCache
 * @Description ASCIIStrCache ASCII字符串缓存
 * @Author LiuQi
 */
public class ASCIIStrCache {
    /**
     * ASCII_LENGTH ASCII字符长度
     */
    private static final int ASCII_LENGTH = 128;
    /**
     * CACHE ASCII字符串缓存数组
     */
    private static final String[] CACHE = new String[ASCII_LENGTH];

    static {
        for (int i = 0; i < ASCII_LENGTH; i++) { // 遍历ASCII字符长度，将ASCII字符转换为字符串
            // 将ASCII字符转换为字符串，并存储在缓存数组中
            CACHE[i] = String.valueOf(i);
        }
    }

    /**
     * toString 将ASCII字符转换为字符串
     *
     * @param char_ ASCII字符
     * @return ASCII字符对应的字符串
     * @author LiuQi
     */
    public static String toString(final char char_) {
        // 如果ASCII字符小于ASCII长度，则从缓存数组中获取对应的字符串；否则直接将ASCII字符转换为字符串
        return char_ < ASCII_LENGTH ? CACHE[char_] : String.valueOf(char_);
    }
}
