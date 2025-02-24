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
}
