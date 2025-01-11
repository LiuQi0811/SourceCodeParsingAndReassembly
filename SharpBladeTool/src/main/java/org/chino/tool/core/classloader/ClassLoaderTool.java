package org.chino.tool.core.classloader;

import org.chino.tool.core.lang.caller.CallerTool;

/**
 * @ClassName ClassLoaderTool
 * @Description ClassLoaderTool 类加载处理工具
 * @Author LiuQi
 * @Date 2025/1/9 16:32
 * @Version 1.0
 */
public class ClassLoaderTool {

    /**
     * ClassLoaderTool 构造方法
     *
     * @author LiuQi
     */
    public ClassLoaderTool() {
    }

    /**
     * getClassLoader 获取类加载器
     *
     * @return {@link ClassLoader} 类加载器
     * @author LiuQi
     */
    public static ClassLoader getClassLoader() {
        // 获取当前类调用者的类加载器
        ClassLoader classLoader = CallerTool.getCallerCaller().getClassLoader();
        if (null == classLoader) { // 当前类调用者的类加载器为空
            // 获取当前线程的上下文类加载器
            classLoader = getContextClassLoader();
        }
        if (classLoader == null) { // 当前线程的上下文类加载器为空
            // 获取当前类的类加载器
            classLoader = ClassLoaderTool.class.getClassLoader();
            if (null == classLoader) { // 当前类的类加载器为空
                // 获取系统类加载器
                classLoader = getSystemClassLoader();
            }
        }
        // 返回类加载器
        return classLoader;
    }

    /**
     * getSystemClassLoader 获取系统类加载器
     *
     * @return {@link ClassLoader} 类加载器
     * @author LiuQi
     */
    public static ClassLoader getSystemClassLoader() {
        // 获取系统类加载器并返回
        return ClassLoader.getSystemClassLoader();
    }

    /**
     * getContextClassLoader 获取上下文类加载器
     *
     * @return {@link ClassLoader} 类加载器
     * @author LiuQi
     */
    public static ClassLoader getContextClassLoader() {

        System.out.println("getContextClassLoader 获取上下文类加载器 ");
        return null;
    }
}
