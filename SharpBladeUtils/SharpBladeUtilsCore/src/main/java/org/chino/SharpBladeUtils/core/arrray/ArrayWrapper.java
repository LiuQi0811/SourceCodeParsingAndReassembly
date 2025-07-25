package org.chino.SharpBladeUtils.core.arrray;

import org.chino.SharpBladeUtils.core.lang.Assert;

import java.lang.reflect.Array;

/**
 * @ClassName ArrayWrapper
 * @Description ArrayWrapper 泛型数组包装器类，用于安全地封装任意类型的数组，并提供类型安全的访问方式。
 * @Author LiuQi
 */
public class ArrayWrapper<A, E> {
    // 数组元素的具体类型（通过反射获取）
    private final Class<E> componentType;
    // 被封装的原始数组引用
    private A array;
    // 数组的长度（缓存以提高性能）
    private int length;

    /**
     * ArrayWrapper 构造方法，使用传入的数组初始化包装器
     *
     * @param array 要包装的数组对象
     * @throws IllegalArgumentException 如果传入对象不是数组
     * @throws NullPointerException     如果传入数组为null
     * @author LiuQi
     */
    public ArrayWrapper(final A array) {
        // 断言数组不能为null（使用自定义断言工具）
        Assert.notNull(array, "Array must be not null!");
        // 检查传入对象是否是数组（使用ArrayUtil工具类）
        if (!ArrayUtil.isArray(array)) {
            throw new IllegalArgumentException("Object is not a array!");
        }
        // 通过反射获取数组的组件类型（即元素类型）
        this.componentType = (Class<E>) array.getClass().getComponentType();
        // 设置新数组并初始化长度
        setNewArray(array);
    }

    /**
     * setNewArray 内部方法：设置新数组并更新长度缓存
     *
     * @param array 新的数组对象
     * @author LiuQi
     */
    private void setNewArray(final A array) {
        // 更新数组引用
        this.array = array;
        // 通过反射获取数组长度并缓存
        this.length = Array.getLength(array);
    }

    /**
     * of 静态工厂方法，创建ArrayWrapper实例
     *
     * @param <A>   数组类型
     * @param <E>   元素类型
     * @param array 要包装的数组
     * @return 新的ArrayWrapper实例
     * @author LiuQi
     */
    public static <A, E> ArrayWrapper<A, E> of(final A array) {
        // 返回创建ArrayWrapper实例
        return new ArrayWrapper<>(array);
    }

    /**
     * get 安全地获取数组中指定索引位置的元素，支持负数索引（从数组末尾开始计算），并对越界访问返回null而非抛出异常。
     * <p>
     * 设计特点：
     * 1. 支持负数索引（类似Python的列表索引方式）
     * 2. 对越界访问返回null（防御性编程）
     * 3. 缓存数组长度避免重复计算
     *
     * @param index 要获取的元素索引，支持负数（-1表示最后一个元素）
     * @return 指定索引处的元素；如果索引越界则返回null
     * @author LiuQi
     */
    public E get(int index) {
        // 缓存当前数组长度到局部变量（避免多线程环境下this.length可能的变化）
        final int length = this.length;
        // 处理负数索引：将负数索引转换为正数索引（从数组末尾开始计算）
        // 例如：length=5, index=-1 → 转换为index=4（最后一个元素）
        if (index < 0) {
            index += length;
        }
        // 检查转换后的索引是否仍然越界
        // 两种越界情况：
        // 1. 原始index为负且转换后仍为负（如length=5, index=-6 → index=-1）
        // 2. 原始index超过数组最大索引（如length=5, index=5 → 越界）
        if (index < 0 || index >= length) {
            // 越界访问返回null（而不是抛出ArrayIndexOutOfBoundsException）
            return null;
        }
        // 通过Java反射API安全地获取数组元素
        // 注意：这里需要进行强制类型转换(E)，由调用方保证类型安全
        return (E) Array.get(array, index);
    }
}
