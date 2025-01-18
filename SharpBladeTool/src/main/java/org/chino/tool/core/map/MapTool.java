package org.chino.tool.core.map;

import java.util.Map;

/**
 * @ClassName MapTool
 * @Description MapTool Map处理工具 继承 MapGetTool
 * @Author LiuQi
 * @Date 2025/1/18 9:31
 * @Version 1.0
 */
public class MapTool extends MapGetTool {

    /**
     * MapTool 构造方法
     *
     * @author LiuQi
     */
    public MapTool() {

    }

    /**
     * isNotEmpty Map是否不为空
     *
     * @param map {@link  Map}Map
     * @return {@link Boolean}
     * @author LiuQi
     */
    public static boolean isNotEmpty(Map<?, ?> map) {
        // isEmpty Map不为空处理
        return !isEmpty(map);
    }

    /**
     * isEmpty Map是否为空
     *
     * @param map {@link Map}Map
     * @return {@link Boolean}
     * @author LiuQi
     */
    public static boolean isEmpty(Map<?, ?> map) {
        // map 为null 或者 map 为空集合
        return null == map || map.isEmpty();
    }
}
