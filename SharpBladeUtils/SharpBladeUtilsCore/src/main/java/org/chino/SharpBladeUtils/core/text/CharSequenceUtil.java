package org.chino.SharpBladeUtils.core.text;

import org.chino.SharpBladeUtils.core.func.SerializeFunction;
import org.chino.SharpBladeUtils.core.regex.ReUtil;

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
 * @Date 2025/2/19 14:49
 * @Version 1.0
 */
public class CharSequenceUtil extends StrValidator {

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
}
