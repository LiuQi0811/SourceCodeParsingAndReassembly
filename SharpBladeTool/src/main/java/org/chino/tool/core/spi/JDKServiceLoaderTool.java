package org.chino.tool.core.spi;

import org.chino.tool.core.classloader.ClassLoaderTool;
import org.chino.tool.core.tool.ObjTool;

import java.util.ServiceLoader;

/**
 * @ClassName JDKServiceLoaderTool
 * @Description JDKServiceLoaderTool 服务加载处理工具
 * @Author LiuQi
 * @Date 2025/1/9 15:58
 * @Version 1.0
 */
public class JDKServiceLoaderTool {

    /**
     * JDKServiceLoaderTool 构造方法
     *
     * @author LiuQi
     */
    public JDKServiceLoaderTool() {

    }

    /**
     * loader 加载处理
     *
     * @param clazz {@link Class} 类对象
     * @param <T>   泛型
     * @return {@link ServiceLoader} 服务加载器对象
     */
    public static <T> ServiceLoader<T> loader(Class<T> clazz) {
        // loader 加载处理
        return loader(clazz, null);
    }

    /**
     * loader 加载处理
     *
     * @param clazz  {@link Class} 类对象
     * @param loader {@link ClassLoader} 类加载器对象
     * @param <T>    泛型
     * @return {@link ServiceLoader} 服务加载器对象
     */
    public static <T> ServiceLoader<T> loader(Class<T> clazz, ClassLoader loader) {
        // load 加载处理
        return ServiceLoader.load(clazz, ObjTool.defaultIfNull(loader, ClassLoaderTool::getClassLoader));
    }
}
