package org.chino.SharpBladeUtils.core.regex;

import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * @ClassName ReUtil
 * @Description ReUtil 正则处理工具
 * @Author LiuQi
 * @Date 2025/2/18 15:13
 * @Version 1.0
 * @see <a href="https://any86.github.io/any-rule/">any86.github.io</a>
 */
public class ReUtil {
    /**
     * get 获取匹配器
     *
     * @param pattern  {@link Pattern}匹配的正则
     * @param content  {@link  CharSequence}被匹配的内容
     * @param consumer {@link Consumer}匹配到的内容处理器
     * @author LiuQi
     */
    public static void get(final Pattern pattern, final CharSequence content, final Consumer<Matcher> consumer) {
        // 参数为空直接返回
        if (null == pattern || null == content || null == consumer) return;
        // 获取匹配器
        Matcher matcher = pattern.matcher(content);
        // 查找匹配内容并处理
        if (matcher.find()) consumer.accept(matcher);
    }
}
