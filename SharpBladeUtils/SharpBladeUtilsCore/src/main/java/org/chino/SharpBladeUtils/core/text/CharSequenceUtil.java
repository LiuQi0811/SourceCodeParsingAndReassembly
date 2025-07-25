package org.chino.SharpBladeUtils.core.text;

import org.chino.SharpBladeUtils.core.func.SerializeFunction;
import org.chino.SharpBladeUtils.core.regex.ReUtil;
import org.chino.SharpBladeUtils.core.text.placeholder.StringFormatter;
import org.chino.SharpBladeUtils.core.text.replacer.SearchReplacer;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * @ClassName CharSequenceUtil
 * @Description CharSequenceUtil CharSequence处理工具
 * <ul>
 *     <li>字符串补充前缀或后缀：addXXX</li>
 *     <li>字符串补充长度：padXXX</li>
 *     <li>字符串包含关系：containsXXX</li>
 *     <li>字符串默认值：defaultIfXXX</li>
 *     <li>字符串查找：indexOf</li>
 *     <li>字符串判断以什么结尾：endWith</li>
 *     <li>字符串判断以什么开始：startWith</li>
 *     <li>字符串匹配：equals</li>
 *     <li>字符串格式化：format</li>
 *     <li>字符串去除：removeXXX</li>
 *     <li>字符串重复：repeat</li>
 *     <li>获取子串：sub</li>
 *     <li>去除两边的指定字符串（只去除一次）：strip</li>
 *     <li>去除两边的指定所有字符：trim</li>
 *     <li>去除两边的指定所有字符包装和去除包装：wrap</li>
 * </ul>
 * <p>
 * 需要注意的是，strip、trim、wrap（unWrap）的策略不同：
 * <ul>
 *     <li>strip： 强调去除两边或某一边的指定字符串，这个字符串不会重复去除，如果一边不存在，另一边不影响去除</li>
 *     <li>trim：  强调去除两边指定字符，如果这个字符有多个，全部去除，例如去除两边所有的空白符。</li>
 *     <li>unWrap：强调去包装，要求包装的前后字符都要存在，只有一个则不做处理，如去掉双引号包装。</li>
 * </ul>
 * @Author LiuQi
 */
public class CharSequenceUtil extends StringValidator {

    /**
     * toStringOrNull 将对象转为字符串，如果为null则返回null
     *
     * @param value {@link Object} 对象
     * @return {@link String} 转换后的字符串，如果对象为null则返回null
     * @author LiuQi
     */
    public static String toStringOrNull(final Object value) {
        // 直接返回对象转为字符串的结果，如果对象为null则返回null
        return null == value ? null : value.toString();
    }

    /**
     * replace 替换所有正则匹配的文本，并使用自定义函数决定替换文本
     *
     * @param charSequence {@link  CharSequence}要替换的字符串
     * @param pattern      {@link Pattern}     用于匹配的正则表达式
     * @param replaceFunc  {@link SerializeFunction<Matcher, String>}  替换函数
     * @return {@link String} 替换后的字符串
     * @author LiuQi
     */
    public static String replace(final CharSequence charSequence, final Pattern pattern, final SerializeFunction<Matcher, String> replaceFunc) {
        // 使用ReUtil正则匹配处理工具类进行替换操作
        return ReUtil.replaceAll(charSequence, pattern, replaceFunc);
    }

    /**
     * replace 替换字符串中的指定字符串
     *
     * @param charSequence {@link CharSequence} 字符串
     * @param search       {@link CharSequence} 被查找的字符串
     * @param replacement  {@link CharSequence} 被替换的字符串
     * @return 返回替换后的字符串
     * @author LiuQi
     */
    public static String replace(final CharSequence charSequence, final CharSequence search, final CharSequence replacement) {
        // 返回 替换后的字符串  调取{@code replace(final CharSequence charSequence, final int formIndex, final CharSequence search, final CharSequence replacement, final boolean ignoreCase)} 方法
        return replace(charSequence, 0, search, replacement, false);
    }

    /**
     * replace 替换字符串中的指定字符串
     *
     * @param charSequence {@link CharSequence} 字符串
     * @param formIndex    开始位置（包括）
     * @param search       {@link CharSequence} 被查找的字符串
     * @param replacement  {@link CharSequence} 被替换的字符串
     * @param ignoreCase   是否忽略大小写
     * @return 返回替换后的字符串
     * @description 如果指定字符串出现多次，则全部替换
     * @author LiuQi
     */
    public static String replace(final CharSequence charSequence, final int formIndex, final CharSequence search, final CharSequence replacement, final boolean ignoreCase) {
        // 字符串为空 或者 被查找的字符串为空 返回转换后的字符串，如果对象为null则返回null
        if (isEmpty(charSequence) || isEmpty(search)) return toStringOrNull(charSequence);
        // 返回
        return new SearchReplacer(formIndex, search, replacement, ignoreCase)
                .apply(charSequence);
    }

    /**
     * equalsIgnoreCase 比较两个 CharSequence 对象是否相等，忽略大小写。
     * <p>
     * 该方法是一个便捷方法，通过调用另一个重载的 equals 方法来实现忽略大小写的比较。
     *
     * @param first  第一个要比较的 CharSequence 对象。
     * @param second 第二个要比较的 CharSequence 对象。
     * @return 如果两个 CharSequence 对象在忽略大小写的情况下相等，则返回 true；否则返回 false。
     * @author LiuQi
     */
    public static boolean equalsIgnoreCase(final CharSequence first, final CharSequence second) {
        // 调用重载的 equals 方法，传入两个 CharSequence 对象以及一个表示是否忽略大小写的布尔值 true
        return equals(first, second, true);
    }

    /**
     * equals 比较两个字符串是否相等 大小写敏感
     *
     * @param charSequence  {@link CharSequence} 字符串
     * @param charSequence_ {@link CharSequence} 要比较的字符串
     * @return {@link boolean} 如果相等返回true，否则返回false
     * @author LiuQi
     */
    public static boolean equals(final CharSequence charSequence, final CharSequence charSequence_) {
        // 直接调用equals方法进行比较，大小写敏感
        return equals(charSequence, charSequence_, false);
    }

    /**
     * equals 比较两个字符串是否相等
     *
     * @param charSequence  {@link CharSequence} 字符串
     * @param charSequence_ {@link CharSequence} 要比较的字符串
     * @param ignoreCase    是否忽略大小写
     * @return {@link boolean} 如果相等返回true，否则返回false
     * @author LiuQi
     */
    public static boolean equals(final CharSequence charSequence, final CharSequence charSequence_, final boolean ignoreCase) {
        // 如果其中一个字符串为null，则直接比较另一个字符串是否也为null
        if (null == charSequence) return charSequence_ == null;
        // 如果另一个字符串为null，则直接返回false
        if (null == charSequence_) return false;
        if (ignoreCase) { // 忽略大小写的情况
            // 使用equalsIgnoreCase方法进行比较，忽略大小写
            return charSequence.toString().equalsIgnoreCase(charSequence_.toString());
        } else { // 大小写敏感的情况
            // 使用contentEquals方法进行比较，大小写敏感
            return charSequence.toString().contentEquals(charSequence_);
        }
    }

    /**
     * format 格式化文本, {} 表示占位符<br>
     * 此方法只是简单将占位符 {} 按照顺序替换为参数<br>
     * 如果想输出 {} 使用 \\转义 { 即可，如果想输出 {} 之前的 \ 使用双转义符 \\\\ 即可<br>
     * 例：<br>
     * 通常使用：format("this is {} for {}", "a", "b") =》 this is a for b<br>
     * 转义{}： format("this is \\{} for {}", "a", "b") =》 this is {} for a<br>
     * 转义\： format("this is \\\\{} for {}", "a", "b") =》 this is \a for b<br>
     *
     * @param template {@link CharSequence} 文本模板，被替换的部分用 {} 表示，如果模板为null，返回"null"
     * @param params   {@link Object}  参数值
     * @return 格式化后的文本，如果模板为null，返回"null"
     * @author LiuQi
     */
    public static String format(final CharSequence template, final Object... params) {
        // 文本模版为空 返回null
        if (null == template) return NULL;
        // TODO 其他类型 待优化
        // 返回 调取 {@code format(final String pattern, final Object... params)} format 格式化字符串方法
        return StringFormatter.format(template.toString(), params);
    }

}
