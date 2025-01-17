package org.chino.tool.core.lang;

/**
 * @ClassName Assert
 * @Description Assert 断言
 * @Author LiuQi
 * @Date 2025/1/17 13:23
 * @Version 1.0
 */
public class Assert {

    /**
     * Assert 构造方法
     *
     * @author LiuQi
     */
    public Assert() {
    }

    /**
     * notNull 断言参数不为空
     *
     * @param param 参数
     * @param <T>   泛型参数类型
     * @return 参数
     * @author LiuQi
     */
    public static <T> T notNull(T param) {
        if (null == param) { // 参数为空
            // 抛出IllegalArgumentException异常
            throw new IllegalArgumentException("[断言失败]-此参数是必需的；它不能为空");
        } else { // 参数不为空
            // 返回参数
            return param;
        }
    }
}
