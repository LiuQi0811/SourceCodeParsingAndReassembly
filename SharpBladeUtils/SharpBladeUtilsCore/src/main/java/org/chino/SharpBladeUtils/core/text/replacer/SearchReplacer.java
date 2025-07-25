package org.chino.SharpBladeUtils.core.text.replacer;

import org.chino.SharpBladeUtils.core.text.StringUtil;

/**
 * @ClassName SearchReplacer
 * @Description SearchReplacer 搜索替换器
 * @Author LiuQi
 * @Date 2025/2/19 17:07
 * @Version 1.0
 */
public class SearchReplacer extends StringReplacer {
    private static final long serialVersionUID = 1L;

    /**
     * fromIndex 开始索引位置
     */
    private final int fromIndex;
    /**
     * search 要搜索的字符串
     */
    private final CharSequence search;
    /**
     * replacement 替换的字符串
     */
    private final CharSequence replacement;
    /**
     * ignoreCase 是否忽略大小写
     */
    private final boolean ignoreCase;
    /**
     * searchLength 搜索字符串的长度
     */
    private final int searchLength;

    /**
     * SearchReplacer 构造方法
     *
     * @param fromIndex   开始索引位置
     * @param search      要搜索的字符串
     * @param replacement 替换的字符串
     * @param ignoreCase  是否忽略大小写
     * @author LiuQi
     */
    public SearchReplacer(final int fromIndex, final CharSequence search, final CharSequence replacement, final boolean ignoreCase) {
        this.fromIndex = Math.max(fromIndex, 0);
        this.search = search;
        this.replacement = replacement;
        this.ignoreCase = ignoreCase;
        this.searchLength = search.length();
    }

    /**
     * apply 应用方法
     *
     * @param charSequence 要处理的字符串
     * @return {@link String} 处理后的字符串
     * @author LiuQi
     */
    @Override
    public String apply(CharSequence charSequence) {
        // 参数为空，将对象转为字符串，如果为null则返回null。
        if (StringUtil.isEmpty(charSequence)) return StringUtil.toStringOrNull(charSequence);
        // 获取字符串长度
        int length = charSequence.length();
        // 如果字符串长度小于搜索字符串的长度，将对象转为字符串，如果为null则返回null。
        if (length < searchLength) return StringUtil.toStringOrNull(charSequence);
        // 如果开始索引位置大于搜索字符串的长度，返回空字符串 - 越界处理。
        if (fromIndex > searchLength) return StringUtil.EMPTY;
        // 创建StringBuilder对象
        StringBuilder builder = new StringBuilder(length - searchLength + replacement.length());
        // 如果开始索引位置不为0，则将字符串从0到fromIndex的部分追加到builder中。
        if (0 != fromIndex) builder.append(charSequence.subSequence(0, fromIndex));
        // 位置索引
        int position = fromIndex;
        // 处理过的字符数
        int consumed;
        while ((consumed = replace(charSequence, position, builder)) > 0) { // while循环，直到没有匹配的字符串为止
            System.out.println(" consumed: " + consumed);
        }
        System.out.println("fromIndex: " + position);
        System.out.println("builder " + builder);
        // 返回处理后的字符串
        return builder.toString();
    }

    @Override
    protected int replace(CharSequence charSequence, int position, StringBuilder builder) {
        return 0;
    }
}
