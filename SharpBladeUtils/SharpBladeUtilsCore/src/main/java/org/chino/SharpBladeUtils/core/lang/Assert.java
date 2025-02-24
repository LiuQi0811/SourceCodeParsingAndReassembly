package org.chino.SharpBladeUtils.core.lang;

import org.chino.SharpBladeUtils.core.text.StrUtil;

import java.util.function.Supplier;

/**
 * @ClassName Assert
 * @Description Assert 断言
 * @Author LiuQi
 * @Date 2025/2/20 13:08
 * @Version 1.0
 */
public class Assert {

    /**
     * notNull 断言不为空
     *
     * @param data                 {@link T}   被检查的对象
     * @param errorMessageTemplate {@link String}错误消息模板，变量使用{}表示
     * @param params               {@link Object...}   模板参数
     * @param <T>                  {@link T}     泛型类型
     * @return 返回 被检查的对象
     * @throws IllegalArgumentException
     * @author LiuQi
     */
    public static <T> T notNull(final T data, final String errorMessageTemplate, final Object... params) throws IllegalArgumentException {
        // 被检查的对象为空，抛出异常
        // TODO  异常信息使用模板和参数构建，此处省略具体实现
        if (null == data) throw new IllegalArgumentException();
        // 返回被检查的对象
        return data;
    }

    /**
     * notEmpty 断言不为空
     *
     * @param text          {@link CharSequence} 被检查的字符串
     * @param errorSupplier {@link Supplier<X>} 自定义异常的提供者
     * @param <T>           {@link T} 泛型类型
     * @param <X>           {@link X} 异常类型
     * @return 返回 被检查的字符串
     * @description 检查给定字符串是否为空，为空抛出自定义异常，并使用指定的函数获取错误信息返回。
     * @author LiuQi
     */
    public static <T extends CharSequence, X extends Throwable> T notEmpty(final T text, final Supplier<X> errorSupplier) throws X {
        // 检查给定字符串是否为空，为空抛出自定义异常
        if (StrUtil.isEmpty(text)) throw errorSupplier.get();
        // 返回被检查的字符串
        return text;
    }

    /**
     * isTrue 断言是否为 true
     *
     * @param expression           表达式
     * @param errorMessageTemplate {@link String} 错误消息模板，变量使用{}表示
     * @param params               {@link Object...}模板参数
     * @throws IllegalArgumentException 如果表达式为 false，则抛出 IllegalArgumentException 异常
     * @author LiuQi
     */
    public static void isTrue(final boolean expression, final String errorMessageTemplate, final Object... params) throws IllegalArgumentException {
        // 调取{@code isTrue(expression, ()->{})} isTrue 方法，传入表达式、错误消息模板和参数
        // expression 为 false，抛出 IllegalArgumentException 异常
        // TODO 此处省略具体实现 后续参数模板格式化的实现
        isTrue(expression, () -> new IllegalArgumentException());
    }

    /**
     * isTrue 断言是否为 true
     *
     * @param expression    表达式
     * @param errorSupplier {@link Supplier<X>} 自定义异常的提供者
     * @param <X>           {@link X} 异常类型
     * @throws X 自定义异常 如果表达式为 false，则抛出异常
     * @author LiuQi
     */
    public static <X extends Throwable> void isTrue(final boolean expression, final Supplier<? extends X> errorSupplier) throws X {
        // expression 为 false，抛出自定义异常
        if (!expression) throw errorSupplier.get();
    }
}
