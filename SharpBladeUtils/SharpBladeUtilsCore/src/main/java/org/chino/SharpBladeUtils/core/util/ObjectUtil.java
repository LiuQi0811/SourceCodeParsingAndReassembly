package org.chino.SharpBladeUtils.core.util;

/**
 * @ClassName ObjectUtil
 * @Description ObjectUtil 对象处理工具
 * <pre>
 *    1. 判断对象是否为空
 *    2. 对象克隆
 *    3. 序列化
 * </pre>
 * @Author LiuQi
 * @Date 2025/2/22 11:38
 * @Version 1.0
 */
public class ObjectUtil {

    /**
     * isNull 对象是否为空
     *
     * @param value {@link Object} 对象
     * @return {@link Boolean} 对象是否为空 true:空 false:非空
     * @author LiuQi
     */
    public static boolean isNull(Object value) {
        // 返回对象是否为空 true:空 false:非空
        return null == value;
    }
}
