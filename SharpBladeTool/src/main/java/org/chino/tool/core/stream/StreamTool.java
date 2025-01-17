package org.chino.tool.core.stream;

import java.util.Collection;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

/**
 * @ClassName StreamTool
 * @Description StreamTool stream处理工具
 * @Author LiuQi
 * @Date 2025/1/17 14:06
 * @Version 1.0
 */
public class StreamTool {

    /**
     * StreamTool 构造方法
     *
     * @author LiuQi
     */
    public StreamTool() {
    }

    /**
     * of 将集合转换为流 (非并行)
     *
     * @param iterable 集合
     * @param <T>      泛型
     * @return {@link Stream} 流
     * @author LiuQi
     */
    public static <T> Stream<T> of(Iterable<T> iterable) {
        // of 将集合转换为非并行流处理
        return of(iterable, false);
    }

    /**
     * of 将集合转换为流
     *
     * @param iterable 集合
     * @param parallel 是否并行流
     * @param <T>      泛型
     * @return {@link Stream} 流
     * @author LiuQi
     */
    public static <T> Stream<T> of(Iterable<T> iterable, boolean parallel) {
        if (null == iterable) { // iterable为空
            // 返回空的流
            return Stream.empty();
        } else { // iterable不为空
            // 如果类型 为 Collection 则直接转换为流 或者parallel为true 转换为并行流 否则转换为串行流
            return iterable instanceof Collection<?> ? (parallel ? ((Collection) iterable).parallelStream() : ((Collection) iterable).stream()) : StreamSupport.stream(iterable.spliterator(), parallel);
        }
    }
}
