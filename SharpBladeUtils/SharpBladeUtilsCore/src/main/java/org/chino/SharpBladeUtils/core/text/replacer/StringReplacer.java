package org.chino.SharpBladeUtils.core.text.replacer;

import org.chino.SharpBladeUtils.core.text.StringUtil;

import java.io.Serializable;
import java.util.function.UnaryOperator;

/**
 * @ClassName StringReplacer
 * @Description StringReplacer 字符串替换器
 * @Author LiuQi
 */
public abstract class StringReplacer implements UnaryOperator<CharSequence>, Serializable {
    private static final long serialVersionUID = 1L;

    /**
     * replace  该方法用于替换字符串中的指定字符或子串
     *
     * @param charSequence {@link CharSequence} 原字符串
     * @param position     当前位置
     * @param builder      {@link StringBuilder} StringBuilder对象，用于构建替换后的字符串
     * @return int 返回替换后的字符串长度部分
     * @description 抽象的字符串替换方法，通过传入原字符串和当前位置，执行替换逻辑，返回处理或替换的字符串长度部分。
     * @author LiuQi
     */
    protected abstract int replace(final CharSequence charSequence, final int position, final StringBuilder builder);

    /**
     * apply 应用方法
     *
     * @param charSequence 要处理的字符串
     * @return {@link CharSequence}返回处理后的字符串
     * @author LiuQi
     */
    @Override
    public CharSequence apply(final CharSequence charSequence) {
        // 字符串为空直接返回
        if (StringUtil.isEmpty(charSequence)) return charSequence;
        // 获取字符串长度
        int length = charSequence.length();
        // 创建StringBuilder对象
        StringBuilder builder = new StringBuilder(length);
        // TODO ...........
        return builder;
    }
}
