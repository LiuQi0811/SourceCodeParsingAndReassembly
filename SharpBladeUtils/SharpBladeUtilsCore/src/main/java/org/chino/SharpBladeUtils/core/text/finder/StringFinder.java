package org.chino.SharpBladeUtils.core.text.finder;


/**
 * @ClassName StringFinder
 * @Description StringFinder 字符串查找器
 * @Author LiuQi
 */
public class StringFinder extends TextFinder {
    private static final long serialVersionUID = 1L;

    /**
     * charSequence 查找字符串
     */
    private final CharSequence charSequence;
    /**
     * caseInsensitive 是否忽略大小写
     */
    private final boolean caseInsensitive;

    /**
     * StrFinder 构造方法
     *
     * @param charSequence    查找字符串
     * @param caseInsensitive 是否忽略大小写
     * @author LiuQi
     */
    public StringFinder(final CharSequence charSequence, final boolean caseInsensitive) {
        this.charSequence = charSequence;
        this.caseInsensitive = caseInsensitive;
    }

    /**
     * of 创建查找器，构造后须调用 设置被查找的文本
     *
     * @param charSequence
     * @param caseInsensitive
     * @return
     */
    public static StringFinder of(final CharSequence charSequence, final boolean caseInsensitive) {
        System.out.println(" StringFinder of ");
        return new StringFinder(charSequence, caseInsensitive);
    }
}
