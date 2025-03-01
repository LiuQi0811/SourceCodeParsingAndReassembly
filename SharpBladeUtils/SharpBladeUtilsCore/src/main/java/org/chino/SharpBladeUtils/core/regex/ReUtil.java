package org.chino.SharpBladeUtils.core.regex;

import org.chino.SharpBladeUtils.core.func.SerializeFunction;
import org.chino.SharpBladeUtils.core.lang.mutable.MutableObject;
import org.chino.SharpBladeUtils.core.text.StringUtil;

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
     * @param pattern    {@link Pattern}匹配的正则
     * @param content    {@link  CharSequence}被匹配的内容
     * @param groupIndex 匹配到的内容组索引 默认 0 表示整个匹配的内容 默认 1 表示第一个括号匹配的内容 例如 (abc) 匹配 abc 则 groupIndex 为 1
     * @return {@link String}匹配到的内容
     * @author LiuQi
     */
    public static String get(final Pattern pattern, final CharSequence content, final int groupIndex) {
        // 参数为空直接返回 null
        if (null == pattern || null == content) return null;
        // 创建MutableObject 对象 用于存储匹配到的内容
        final MutableObject<String> result = new MutableObject<>();
        // 获取匹配器并处理
        get(pattern, content, (matcher) -> result.set(matcher.group(groupIndex)));
        // 返回获取结果
        return result.get();
    }

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

    /**
     * replaceAll 替换所有正则匹配的文本，并使用自定义函数决定替换文本
     *
     * @param charSequence {@link CharSequence} 被匹配的内容
     * @param pattern      {@link Pattern} 匹配的正则
     * @param replaceFunc  {@link SerializeFunction<Matcher, String>} 替换文本的函数
     * @return {@link String} 替换后的文本
     * @author LiuQi
     */
    public static String replaceAll(final CharSequence charSequence, final Pattern pattern, SerializeFunction<Matcher, String> replaceFunc) {
        // 参数为空直接返回 - 将对象转为字符串，如果为null则返回null
        if (StringUtil.isEmpty(charSequence) || null == pattern) return StringUtil.toStringOrNull(charSequence);
        // 替换文本的函数为空则使用默认的匹配内容作为替换文本
        if (null == replaceFunc) replaceFunc = Matcher::group;
        // 获取匹配器
        final Matcher matcher = pattern.matcher(charSequence);
        // 创建StringBuffer对象
        final StringBuffer buffer = new StringBuffer();
        while (matcher.find()) { // 查找匹配内容并处理
            // 替换匹配到的内容
            matcher.appendReplacement(buffer, replaceFunc.apply(matcher));
        }
        // 将最后一次匹配之后剩余的文本追加到StringBuffer对象中
        matcher.appendTail(buffer);
        // 返回替换后的文本
        return buffer.toString();
    }
}
