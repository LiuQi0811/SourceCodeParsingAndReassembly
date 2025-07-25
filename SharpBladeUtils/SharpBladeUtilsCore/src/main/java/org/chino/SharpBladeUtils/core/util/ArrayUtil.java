package org.chino.SharpBladeUtils.core.util;

import org.chino.SharpBladeUtils.core.comparator.CompareUtil;
import org.chino.SharpBladeUtils.core.lang.Assert;
import org.chino.SharpBladeUtils.core.lang.Editor;
import org.chino.SharpBladeUtils.core.lang.Filter;
import org.chino.SharpBladeUtils.core.lang.Matcher;
import org.chino.SharpBladeUtils.core.map.MapUtil;

import java.lang.reflect.Array;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Map;

/**
 * @ClassName ArrayUtil
 * @Description ArrayUtil 数组处理工具
 * @Author LiuQi
 */
public class ArrayUtil extends PrimitiveArrayUtil {

    /**
     * isEmpty 数组是否为空
     *
     * @param array {@link T[]} 数组
     * @param <T>   泛型类型
     * @return 返回 数组为空 或者 数组长度为0 的布尔值  true：数组为空 或者 数组长度为0  false：反之
     * @author LiuQi
     */
    public static <T> boolean isEmpty(final T[] array) {
        // 返回 数组为空 或者 数组长度为0 的布尔值
        return array == null || array.length == 0;
    }

    /**
     * isEmpty 判断一个 Object 类型的数组是否为空。
     * <p>
     * 此方法可以接受任意类型的数组（如 int[]、String[]、自定义对象数组等），
     * 并判断其是否为“空”状态。“空”的定义包括：
     * 1. 数组引用为 null（未指向任何数组对象）；
     * 2. 数组长度为 0（数组对象存在，但不包含任何元素）。
     * <p>
     * 注意：如果传入的对象不是数组（如普通 Object 实例），则直接返回 false，
     * 因为非数组对象无法用“空数组”的概念衡量。
     *
     * @param array {@link Object}要检查的 Object 类型对象，可能是任意类型的数组。
     * @return 如果 array 是数组且为 null 或长度为 0，返回 true（表示空）；
     * 如果 array 是数组但长度 > 0，返回 false（表示非空）；
     * 如果 array 不是数组（即使为 null），也返回 false（因为非数组对象不适用“空数组”判断）。
     * @author LiuQi
     */
    public static boolean isEmpty(Object array) {
        // 第一步：检查 array 是否为 null
        if (array != null) {
            // 第二步：检查 array 是否是数组类型（通过辅助方法 isArray 判断）
            if (isArray(array)) {
                // 如果是数组，通过 Array.getLength(array) 获取其长度，并判断是否为 0
                return 0 == Array.getLength(array);
            } else {
                // 如果 array 不是 null 但也不是数组（如普通 Object 实例），直接返回 false
                return false;
            }
        }
        // 第三步：如果 array 是 null，直接返回 true（因为 null 本身被视为“空”）
        return true;
    }


    /**
     * isNotEmpty 判断一个泛型数组是否为非空状态。
     * <p>
     * 这是一个泛型方法，可以接受任意引用类型的数组（如 String[]、自定义对象数组等），
     * 并判断其是否同时满足以下两个条件：
     * 1. 数组引用不为 null；
     * 2. 数组长度大于 0（即包含至少一个元素）。
     *
     * @param <T>   {@link T} 数组元素的类型参数，可以是任意引用类型（如 String、Integer 或自定义类）
     * @param array {@link T[]}要检查的泛型数组
     * @return 如果数组不为 null 且长度 > 0，返回 true（表示非空）；
     * 如果数组为 null 或长度为 0，返回 false（表示空）
     * @示例 String[] names = {"Alice", "Bob"};  // 非空数组 → 返回 true
     * List<?>[] emptyListArray = new List[0];  // 空数组 → 返回 false
     * Object[] nullArray = null;  // null 数组 → 返回 false
     * @author LiuQi
     */
    public static <T> boolean isNotEmpty(T[] array) {
        // 同时检查两个条件：
        // 1. array != null（排除未初始化的数组引用）
        // 2. array.length != 0（排除空数组）
        // 使用 "null != array" 而非 "array != null" 是一种防御性编码风格，
        // 可以避免因误写 "= " 导致的变量赋值错误（虽然现代IDE会警告）
        return null != array && array.length != 0;
    }

    /**
     * isNotEmpty 判断一个 Object 类型的数组是否为非空状态。
     * <p>
     * 此方法是 {@link #isEmpty(Object)} 的逆向判断版本，用于直接检查任意类型的数组是否"非空"。
     * "非空"的定义是：数组不为 null 且是一个有效的数组对象（通过反射验证），且长度大于 0。
     *
     * @param array 要检查的对象，可能是任意类型的数组（如 int[]、String[] 等）或非数组对象
     * @return 如果 array 是数组且不为 null 且长度 > 0，返回 true（表示非空）；
     * 如果 array 是数组但为 null 或长度为 0，返回 false；
     * 如果 array 不是数组（即使不为 null），也返回 false（因为非数组对象不适用"空数组"概念）
     * @示例 String[] strArray = {"a", "b"};  // 非空数组 → 返回 true
     * int[] emptyIntArray = new int[0]; // 空数组 → 返回 false
     * Object nonArrayObj = new Object(); // 非数组对象 → 返回 false
     * Object nullObj = null;           // null 对象 → 返回 false
     * @author LiuQi
     * @see #isEmpty(Object)  依赖的 isEmpty 方法说明
     */
    public static boolean isNotEmpty(Object array) {
        // 直接对 isEmpty(array) 的结果取反：
        // - 若 isEmpty 返回 true（数组为空或非数组），则 isNotEmpty 返回 false
        // - 若 isEmpty 返回 false（数组非空），则 isNotEmpty 返回 true
        return !isEmpty(array);
    }

    /**
     * filter 数组过滤器 - 基于条件过滤数组元素
     * <p>
     * 核心功能：
     * 1. 遍历输入数组，对每个元素应用过滤条件
     * 2. 保留满足条件的元素（filter.accept()返回true）
     * 3. 过滤掉不满足条件的元素（返回false）
     * 4. 返回包含所有满足条件元素的新数组
     * <p>
     * 设计特点：
     * - 零修改原数组（纯函数式操作）
     * - 自动处理null输入（防御性编程）
     * - 复用edit()方法实现核心逻辑
     *
     * @param <T>    数组元素类型参数
     * @param array  {@link T[]}待过滤的原始数组（允许为null）
     * @param filter {@link Filter<T>}元素过滤器（允许为null）
     * @return 过滤后的新数组（仅包含满足条件的元素）
     * @示例 基础用法
     * Integer[] numbers = {1, 2, 3, 4, 5};
     * Integer[] evens = filter(numbers, n -> n % 2 == 0);
     * // 结果: [2, 4]
     * @示例 null处理
     * String[] texts = null;
     * String[] result = filter(texts, s -> s != null); // 安全返回null
     * @警告 注意事项
     * 1. 原始数组不会被修改（符合不可变原则）
     * 2. 过滤器返回false的元素会被移除
     * 3. 结果数组长度可能小于输入数组
     * @author LiuQi
     */
    @SuppressWarnings("unchecked") // 安全注解：组件类型转换保证安全
    public static <T> T[] filter(T[] array, Filter<T> filter) {
        // --------------------------
        // 第一阶段：参数校验
        // --------------------------
        // 显式处理null输入（防御性编程）：
        // 1. 如果array为null，直接返回null（避免NPE）
        // 2. 如果filter为null，直接返回原数组（视为无过滤条件）
        // 这种设计选择优于抛出异常，因为：
        // - 提供"宽容输入"语义
        // - 符合工具类方法的常见模式
        if (null == array || null == filter) {
            return array;
        }

        // --------------------------
        // 第二阶段：复用edit()实现过滤
        // --------------------------
        // 核心逻辑：将过滤条件转换为编辑器逻辑
        // 1. 满足条件的元素(R -> R)保持原样
        // 2. 不满足条件的元素(R -> null)会被edit()自动过滤
        // 这种设计体现了：
        // - 代码复用（避免重复实现遍历逻辑）
        // - 函数式组合思想（filter是edit的特例）
        return edit(array, R -> filter.accept(R) ? R : null);
    }

    /**
     * edit 数组编辑器 - 使用编辑器模式对数组元素进行过滤和转换
     * <p>
     * 核心功能：
     * 1. 遍历输入数组，对每个元素应用编辑器逻辑
     * 2. 过滤掉编辑结果为null的元素（实现软删除）
     * 3. 将编辑后的有效元素收集到新数组
     * 4. 保持原始数组不变（纯函数式操作）
     * <p>
     * 设计模式：
     * - 编辑器模式(Editor Pattern)：将元素处理逻辑委托给Editor接口
     * - 防御性编程：处理null编辑器和null数组元素
     *
     * @param <T>    数组元素类型参数
     * @param array  {@link T[]}  待编辑的原始数组（允许为null）
     * @param editor {@link Editor<T>}元素编辑器（允许为null）
     * @return 编辑后的新数组（元素顺序与原数组一致，但可能数量减少）
     * @示例 基础用法
     * String[] names = {"Alice", "Bob", "Charlie"};
     * String[] filtered = edit(names, new Editor<String>() {
     * public String edit(String s) {
     * return s.startsWith("A") ? s.toUpperCase() : null; // 过滤并转大写
     * }
     * });
     * // 结果: ["ALICE"] (Bob和Charlie被过滤)
     * @警告 注意事项
     * 1. 原始数组不会被修改（符合函数式编程原则）
     * 2. 编辑器返回null的元素会被自动过滤
     * 3. 结果数组长度可能小于输入数组
     * @author LiuQi
     */
    @SuppressWarnings("unchecked") // 安全注解：组件类型转换保证安全
    public static <T> T[] edit(T[] array, Editor<T> editor) {
        // --------------------------
        // 第一阶段：参数校验
        // --------------------------
        // 1. 如果编辑器为null，直接返回原数组（无操作）
        //    这种设计选择优于抛出异常，因为：
        //    - 提供"空操作"语义
        //    - 符合工具类方法的常见模式
        if (null == editor) {
            return array;
        }

        // --------------------------
        // 第二阶段：结果收集准备
        // --------------------------
        // 使用ArrayList作为中间容器，因为：
        // 1. 动态扩容特性避免预先计算有效元素数量
        // 2. 提供高效的随机访问和添加操作
        // 3. 最终可转换为任意类型数组
        final ArrayList<T> arrayList = new ArrayList<>(array.length); // 预分配初始容量

        // --------------------------
        // 第三阶段：元素编辑处理
        // --------------------------
        // 遍历原始数组（即使array为null，for-each会安全处理）
        // 注意：这里不显式检查array是否为null，因为：
        // 1. for-each循环对null数组会抛出NPE（符合快速失败原则）
        // 2. 方法文档已说明允许null输入（实际应改为显式检查）
        // 修正：应添加array null检查（见下方改进版）
        for (T data : array) {
            // 1. 应用编辑器逻辑
            T modified = editor.edit(data);

            // 2. 过滤null结果（实现软删除）
            //    这种设计模式常见于：
            //    - 数据清洗场景
            //    - 条件过滤场景
            if (null != modified) {
                arrayList.add(modified);
            }
        }

        // --------------------------
        // 第四阶段：结果数组构建
        // --------------------------
        // 1. 创建目标类型数组
        //    关键点：通过array.getClass().getComponentType()动态获取组件类型
        //    保证返回数组与原数组类型完全一致
        final T[] result = newArray(array.getClass().getComponentType(), arrayList.size());

        // 2. 将ArrayList内容复制到结果数组
        //    注意：toArray(T[])方法会精确填充数组，不会创建新数组
        return arrayList.toArray(result);
    }

    /**
     * newArray 创建一个指定类型和长度的新数组。
     * <p>
     * 此方法通过Java反射机制动态生成一个指定元素类型和长度的空数组，
     * 是泛型场景下创建数组的标准解决方案（因为Java泛型不能直接实例化数组）。
     *
     * @param <T>           {@link T}数组元素的类型参数（如 String、Integer 等引用类型）
     * @param componentType {@link Class<?>}数组元素的Class对象（如 String.class、Integer.class）
     * @param newSize       {@link Integer}   要创建的数组长度（必须 >= 0）
     * @return 新创建的T类型数组（实际类型为 Object[]，但通过强制类型转换返回T[]）
     * @throws IllegalArgumentException 如果 newSize 为负数
     * @throws NullPointerException     如果 componentType 为 null
     * @示例 // 创建一个长度为5的String数组
     * String[] stringArray = newArray(String.class, 5);
     * <p>
     * // 创建一个长度为3的Integer数组
     * Integer[] intArray = newArray(Integer.class, 3);
     * <p>
     * 注意：此方法不能直接用于基本类型（如int.class），需使用对应的包装类（Integer.class）。
     * @author LiuQi
     */
    @SuppressWarnings("unchecked")  // 抑制类型转换警告（因为反射创建的数组实际是Object[]，但保证类型安全）
    public static <T> T[] newArray(Class<?> componentType, int newSize) {
        // 参数校验：newSize不能为负数
        if (newSize < 0) {
            throw new IllegalArgumentException("数组长度不能为负数: " + newSize);
        }
        // 参数校验：componentType不能为null
        if (componentType == null) {
            throw new NullPointerException("元素类型不能为null");
        }

        // 核心逻辑：通过Array.newInstance动态创建数组
        // 1. Array.newInstance 是Java反射API，用于在运行时动态创建数组
        // 2. 返回的数组实际类型是Object[]，但通过(T[])强制转换为泛型T[]
        // 3. 这种转换在运行时是安全的，因为调用方通过componentType保证了类型一致性
        return ((T[]) Array.newInstance(componentType, newSize));
    }

    /**
     * clone 泛型数组克隆工具方法 - 安全高效地复制任意引用类型数组
     * <p>
     * 核心价值：
     * 1. 类型安全地解决Java数组clone()返回Object的类型转换问题
     * 2. 封装null检查逻辑，提供更友好的API
     * 3. 保持与原生clone()相同的浅拷贝语义
     * <p>
     * 技术本质：
     * 此方法是Java数组原生clone()能力的泛型包装器，通过类型参数<T>实现编译期类型检查，
     * 避免强制类型转换可能引发的ClassCastException。
     *
     * @param <T>   数组元素的类型参数，必须是引用类型（不能是基本类型）
     * @param array {@link T[]}待克隆的源数组，允许为null（符合防御性编程原则）
     * @return 克隆后的新数组（元素引用与原数组相同），若输入为null则返回null
     * @implNote 实现原理：
     * 1. 直接调用数组对象的native clone()方法
     * 2. 不进行元素级别的深拷贝（保持浅拷贝语义）
     * 3. 依赖JVM保证数组clone操作的原子性
     * @示例 基础用法
     * String[] names = {"Alice", "Bob"};
     * String[] copy = clone(names); // 创建新数组，内容相同但独立
     * @示例 null处理
     * Integer[] empty = null;
     * Integer[] result = clone(empty); // 安全返回null
     * @警告 浅拷贝风险
     * 对于对象数组，新数组与原数组会共享元素引用：
     * Person[] people = {new Person("Tom")};
     * Person[] cloned = clone(people);
     * cloned[0].setName("Jerry"); // 会影响原数组！
     * @author LiuQi
     */
    @SuppressWarnings("unchecked") // 安全注解：T[]克隆返回的确实是T[]类型
    public static <T> T[] clone(T[] array) {
        // --------------------------
        // 第一阶段：防御性参数校验
        // --------------------------
        // 显式处理null输入，与Java集合框架的约定保持一致
        // 这种设计选择优于抛出异常，因为：
        // 1. 更符合"宽容输入，严格输出"的原则
        // 2. 允许调用方灵活处理null情况
        if (array == null) {
            return null; // 明确传递null语义
        }

        // --------------------------
        // 第二阶段：执行克隆操作
        // --------------------------
        // 调用数组对象的native clone()方法，该操作：
        // 1. 在JVM层面直接操作内存进行数组复制
        // 2. 时间复杂度O(n)，空间复杂度O(n)
        // 3. 保证原子性（不会部分复制）
        //
        // 类型转换说明：
        // 虽然看起来是未经检查的转换，但实际上：
        // 1. 输入已经是T[]类型
        // 2. Array.clone()保证返回相同类型的数组
        // 3. @SuppressWarnings注解确认此操作安全
        return array.clone();
    }

    /**
     * clone 通用克隆方法 - 支持基本类型数组和对象数组的深度克隆（浅拷贝）
     * <p>
     * 核心功能：
     * 1. 处理任意类型T的克隆请求
     * 2. 自动识别输入是否为数组
     * 3. 区分基本类型数组和对象数组进行不同处理
     * 4. 对非数组类型返回null（明确不支持）
     * <p>
     * 设计约束：
     * - 仅支持数组类型的克隆（包括基本类型数组）
     * - 对对象数组执行浅拷贝（元素引用复制）
     * - 对基本类型数组执行值复制
     *
     * @param <T>  待克隆数据的类型参数（实际运行时会被擦除）
     * @param data 待克隆的数据，可为任意类型（但只有数组会被处理）
     * @return 克隆后的数据（如果是数组），非数组返回null
     * @示例 基本类型数组克隆
     * int[] intArray = {1, 2, 3};
     * int[] clonedInts = clone(intArray); // 创建全新的int数组
     * @示例 对象数组克隆
     * String[] strArray = {"a", "b"};
     * String[] clonedStrs = clone(strArray); // 元素引用复制
     * @警告 非数组类型
     * Object obj = new Object();
     * Object clonedObj = clone(obj); // 返回null（明确不支持）
     * @author LiuQi
     */
    @SuppressWarnings("unchecked") // 安全注解：类型转换在可控范围内
    public static <T> T clone(T data) {
        // --------------------------
        // 第一阶段：空值处理
        // --------------------------
        // 显式null检查，遵循防御性编程原则
        // 使用null == data而非data == null，某些编码规范认为这样更安全
        if (null == data) {
            return null; // 明确传递null语义
        }

        // --------------------------
        // 第二阶段：数组类型识别
        // --------------------------
        // 关键方法：isArray()判断是否为数组（需确保已正确定义）
        // 此处假设isArray()是通过反射实现的类型检查
        if (isArray(data)) {
            final Object result; // 存储克隆结果
            final Class<?> componentType = data.getClass().getComponentType(); // 获取数组元素类型

            // --------------------------
            // 第三阶段：基本类型数组处理
            // --------------------------
            if (componentType.isPrimitive()) {
                // 基本类型数组需要特殊处理（无法直接使用Object.clone()）

                // 1. 创建目标数组实例
                int length = Array.getLength(data); // 获取原数组长度
                result = Array.newInstance(componentType, length); // 创建同类型新数组

                // 2. 逐个元素复制（值拷贝）
                while (length-- > 0) {
                    // 从原数组读取值
                    Object value = Array.get(data, length);
                    // 写入新数组（基本类型会自动拆箱/装箱）
                    Array.set(result, length, value);
                }
            }
            // --------------------------
            // 第四阶段：对象数组处理
            // --------------------------
            else {
                // 对象数组直接使用原生clone()方法（浅拷贝）
                // 注意：这里强制转换为Object[]是安全的，因为：
                // 1. 已经通过isArray()确认是数组
                // 2. 非基本类型数组必然是对象数组
                result = ((Object[]) data).clone();
            }

            // 类型转换返回（@SuppressWarnings确保安全）
            return ((T) result);
        }

        // --------------------------
        // 第五阶段：非数组类型处理
        // --------------------------
        // 明确不支持非数组类型的克隆
        // 这种设计选择优于抛出异常，因为：
        // 1. 保持API简洁性
        // 2. 允许调用方灵活扩展
        return null;
    }

    /**
     * isArray 是否为数组
     *
     * @param data {@link Object} 对象
     * @return 返回  true：data不为空 且 data是数组的布尔值  false：data为空 或者 data不是数组的布尔值
     * @author LiuQi
     */
    public static boolean isArray(final Object data) {
        // 返回  data不为空 且 data是数组的布尔值
        return null != data && data.getClass().isArray();
    }

    /**
     * indexOf 在数组中查找指定值的索引位置
     *
     * @param <T>   数组元素的类型
     * @param array {@link T[]}要搜索的数组
     * @param value {@link Object}要查找的值(可以是任意Object类型，会进行类型转换比较)
     * @return 如果找到值则返回其索引，否则返回INDEX_NOT_FOUND(通常定义为-1)
     * @author LiuQi
     */
    public static <T> int indexOf(T[] array, Object value) {
        // 使用matchIndex方法，传入一个匹配器(比较value和数组元素是否相等)来查找索引
        return matchIndex(R -> ObjectUtil.equal(value, R), array);
    }

    /**
     * indexOf 在long类型基本数据类型的数组中查找指定值的索引位置
     *
     * @param array {@link  Long[]}要搜索的long类型数组
     * @param value {@link Long}要查找的long类型值
     * @return 如果找到值则返回其索引(从0开始)，否则返回INDEX_NOT_FOUND(通常定义为-1)
     * <p>
     * 这个方法是专门为基本数据类型long数组设计的，与泛型版本的indexOf方法不同，
     * 它直接处理基本数据类型，避免了自动装箱/拆箱操作，提高了性能。
     * @author LiuQi
     */
    public static <T> int indexOf(long[] array, long value) {
        // 检查数组是否非空
        if (isNotEmpty(array)) {
            // 遍历数组
            for (int i = 0; i < array.length; i++) {
                // 直接使用==比较基本数据类型的值
                if (value == array[i]) {
                    // 如果找到匹配的值，返回当前索引
                    return i;
                }
            }
        }
        // 如果没有找到匹配的值，返回INDEX_NOT_FOUND(通常定义为-1)
        return INDEX_NOT_FOUND;
    }

    /**
     * lastIndexOf 在泛型数组中查找指定值的最后一个出现位置（从后向前搜索）。
     * 如果数组为空，则返回 INDEX_NOT_FOUND（通常是一个表示未找到的常量，如 -1）。
     *
     * @param <T>   数组元素的类型，为泛型
     * @param array {@link T[]} 要搜索的泛型数组
     * @param value {@link Object}要查找的值，类型为 Object，以支持与数组元素进行比较
     * @return 指定值在数组中的最后一个索引，如果未找到则返回 INDEX_NOT_FOUND
     * @author LiuQi
     */
    public static <T> int lastIndexOf(T[] array, Object value) {
        // 检查数组是否为空
        if (isEmpty(array)) {
            // 如果未找到，返回 INDEX_NOT_FOUND
            return INDEX_NOT_FOUND;
        }
        // 调用重载方法，从数组的最后一个元素开始搜索
        return lastIndexOf(array, value, array.length - 1);
    }


    /**
     * lastIndexOf 在基本类型 long 的数组中查找指定值的最后一个出现位置（从后向前搜索）。
     * 如果数组不为空，则遍历数组从最后一个元素到第一个元素，寻找与指定值相等的元素。
     *
     * @param array {@link Long[]} 要搜索的 long 类型数组
     * @param value {@link Long[]} 要查找的 long 值
     * @return 指定值在数组中的最后一个索引，如果未找到则返回 INDEX_NOT_FOUND
     * @author LiuQi
     */
    public static int lastIndexOf(long[] array, long value) {
        // 检查数组是否不为空
        if (isNotEmpty(array)) {
            // 从数组的最后一个元素开始，向前遍历
            for (int i = array.length - 1; i >= 0; i--) {
                // 如果当前元素等于要查找的值
                if (value == array[i]) {
                    // 返回当前索引
                    return i;
                }
            }
        }
        // 如果未找到，返回 INDEX_NOT_FOUND
        return INDEX_NOT_FOUND;
    }

    /**
     * lastIndexOf 在泛型数组中查找指定值的最后一个出现位置（从后向前搜索），并指定搜索的结束索引（包含）。
     * 使用 ObjectUtil.equal 方法进行元素的比较，以支持更灵活的相等性判断（如处理 null 值）。
     *
     * @param <T>        数组元素的类型，为泛型
     * @param array      {@link T[]}  要搜索的泛型数组
     * @param value      {@link Object} 要查找的值，类型为 Object，以支持与数组元素进行比较
     * @param endInclude {@link Integer} 搜索的结束索引（包含），即从该索引开始向前搜索
     * @return 指定值在数组中的最后一个索引，如果未找到则返回 INDEX_NOT_FOUND
     * @author LiuQi
     */
    public static <T> int lastIndexOf(T[] array, Object value, int endInclude) {
        // 检查数组是否不为空
        if (isNotEmpty(array)) {
            // 从指定的结束索引开始，向前遍历到数组的第一个元素
            for (int i = endInclude; i >= 0; i--) {
                // 使用 ObjectUtil.equal 方法比较当前元素与要查找的值
                // 这种方法可以正确处理 null 值的比较
                if (ObjectUtil.equal(value, array[i])) {
                    // 如果相等，返回当前索引
                    return i;
                }
            }
        }
        // 如果未找到，返回 INDEX_NOT_FOUND
        return INDEX_NOT_FOUND;
    }

    /**
     * matchIndex 在数组中查找满足匹配器条件的元素的索引位置
     *
     * @param <T>     {@link T}数组元素的类型
     * @param matcher {@link Matcher}匹配器接口，用于定义匹配条件
     * @param array   {@link T...} 要搜索的数组
     * @return 如果找到满足条件的元素则返回其索引，否则返回INDEX_NOT_FOUND
     * @author LiuQi
     */
    public static <T> int matchIndex(Matcher<T> matcher, T... array) {
        // 调用matcherIndex方法，从数组起始位置(0)开始搜索
        return matcherIndex(matcher, 0, array);
    }

    /**
     * matcherIndex 在数组中从指定位置开始查找满足匹配器条件的元素的索引位置
     *
     * @param <T>               数组元素的类型
     * @param matcher           {@link Matcher<T>} 匹配器接口，用于定义匹配条件
     * @param beginIndexInclude {@link Integer} 开始搜索的起始索引(包含该索引)
     * @param array             {@link T...}要搜索的数组
     * @return 如果找到满足条件的元素则返回其索引，否则返回INDEX_NOT_FOUND
     * @author LiuQi
     */
    public static <T> int matcherIndex(Matcher<T> matcher, int beginIndexInclude, T... array) {
        // 断言检查：确保matcher不为null
        Assert.notNull(matcher, "Matcher must be not null !");
        // 检查数组是否非空
        if (isNotEmpty(array)) {
            // 从beginIndexInclude开始遍历数组
            for (int i = beginIndexInclude; i < array.length; i++) {
                // 使用matcher判断当前元素是否满足条件
                if (matcher.match(array[i])) {
                    // 如果满足条件，返回当前索引
                    return i;
                }
            }
        }
        // 如果没有找到满足条件的元素，返回INDEX_NOT_FOUND(通常定义为-1)
        return INDEX_NOT_FOUND;
    }

    /**
     * contains 判断泛型数组中是否包含指定的值。
     * 如果数组为空或未找到指定值，则返回 `false`；否则返回 `true`。
     *
     * @param <T>   数组元素的类型（泛型）
     * @param array {@link T[]}要搜索的泛型数组
     * @param value {@link T}要查找的值（类型为 `T`）
     * @return 如果数组包含指定值，返回 `true`；否则返回 `false`
     * @author LiuQi
     */
    public static <T> boolean contains(T[] array, T value) {
        // 调用 `indexOf` 方法查找指定值的索引
        // 如果返回的索引大于 `INDEX_NOT_FOUND`（即找到了该值），则返回 `true`
        return indexOf(array, value) > INDEX_NOT_FOUND;
    }

    /**
     * contains 判断基本类型 `long` 数组中是否包含指定的值。
     * 如果数组为空或未找到指定值，则返回 `false`；否则返回 `true`。
     *
     * @param array {@link Long[]}要搜索的 `long` 类型数组
     * @param value {@link Long}要查找的 `long` 值
     * @return 如果数组包含指定值，返回 `true`；否则返回 `false`
     * @author LiuQi
     */
    public static boolean contains(long[] array, long value) {
        // 调用 `indexOf(array, value)` 方法查找指定值的索引
        // 如果返回的索引大于 `INDEX_NOT_FOUND`（即找到了该值），则返回 `true`
        return indexOf(array, value) > INDEX_NOT_FOUND;
    }

    /**
     * containsAny 判断泛型数组中是否包含给定值中的任意一个。
     * 如果数组或给定值数组为空，则返回 `false`。
     * 只要数组中包含任意一个给定值，立即返回 `true`；否则遍历完所有给定值后返回 `false`。
     *
     * @param <T>    数组元素的类型（泛型）
     * @param array  {@link T[]}要搜索的泛型数组
     * @param values {@link T...}要查找的一组值（可变参数，类型为 `T`）
     * @return 如果数组包含任意一个给定值，返回 `true`；否则返回 `false`
     * @author LiuQi
     */
    public static <T> boolean containsAny(T[] array, T... values) {
        // 遍历给定值数组中的每一个值
        for (T value : values) {
            // 调用 `contains` 方法检查当前值是否存在于目标数组中
            if (contains(array, value)) {
                // 如果找到任意一个匹配的值，立即返回 `true`
                return true;
            }
        }
        // 遍历完所有给定值后仍未找到匹配项，返回 `false`
        return false;
    }

    /**
     * containsAll 判断泛型数组中是否包含给定值中的所有元素。
     * 如果数组或给定值数组为空，则返回 `false`（除非 `values` 也为空，此时视为包含所有值）。
     * 只要数组中缺少任意一个给定值，立即返回 `false`；否则遍历完所有给定值后返回 `true`。
     *
     * @param <T>    数组元素的类型（泛型）
     * @param array  {@link T[]} 要搜索的泛型数组
     * @param values {@link T...} 要查找的一组值（可变参数，类型为 `T`）
     * @return 如果数组包含所有给定值，返回 `true`；否则返回 `false`
     * @author LiuQi
     */
    public static <T> boolean containsAll(T[] array, T... values) {
        // 遍历给定值数组中的每一个值
        for (T value : values) {
            // 调用 `contains` 方法检查当前值是否存在于目标数组中
            if (!contains(array, value)) {
                // 如果发现任意一个值不存在于数组中，立即返回 `false`
                return false;
            }
        }
        // 遍历完所有给定值后均未发现缺失项，返回 `true`
        return true;
    }

    /**
     * zip 将两个数组（键数组和值数组）组合成一个Map。
     * 如果任一数组为空，则返回null。
     * 组合时只处理两个数组中较短的长度，忽略多余的元素。
     * 可以选择生成的Map是否保持插入顺序（LinkedHashMap）或使用默认HashMap。
     *
     * @param <K>     键的类型（泛型）
     * @param <V>     值的类型（泛型）
     * @param keys    {@link K[]}    键数组
     * @param values  {@link V[]} 值数组
     * @param isOrder {@link Boolean} 是否保持插入顺序（true=LinkedHashMap，false=HashMap）
     * @return 组合后的Map，如果任一数组为空则返回null
     * @author LiuQi
     */
    public static <K, V> Map<K, V> zip(K[] keys, V[] values, boolean isOrder) {
        // 检查键数组或值数组是否为空（包括null或长度为0）
        if (isEmpty(keys) || isEmpty(values)) {
            return null;
        }
        // 计算两个数组中较短的长度，避免数组越界
        final int minSize = Math.min(keys.length, values.length);
        // 创建新的Map：
        // - 初始容量设置为 minSize / DEFAULT_LOAD_FACTOR + 1（优化哈希表性能）
        // - 根据isOrder参数决定使用HashMap还是LinkedHashMap
        final Map<K, V> kvHashMap = MapUtil.newHashMap(minSize, isOrder);
        // 遍历较短的长度，将键值对依次放入Map中
        for (int i = 0; i < minSize; i++) {
            kvHashMap.put(keys[i], values[i]);
        }
        // 返回组合后的Map
        return kvHashMap;
    }

    /**
     * cast 将Object数组强制转换为指定组件类型的数组
     *
     * @param classType  {@link Class<?>}  目标数组组件类型的Class对象
     * @param arrayValue {@link Object}待转换的Object数组
     * @return 转换后的新数组
     * @throws NullPointerException     当arrayValue为null时抛出
     * @throws IllegalArgumentException 当arrayValue不是数组时抛出
     * @author LiuQi
     */
    public static Object[] cast(Class<?> classType, Object arrayValue) throws NullPointerException, IllegalArgumentException {
        // 检查输入数组是否为null
        if (null == arrayValue) {
            throw new NullPointerException("Argument [arrayValue] is null !");
        }
        // 检查输入是否为数组类型
        if (!arrayValue.getClass().isArray()) {
            throw new IllegalArgumentException("Argument [arrayValue] is not array !");
        }
        // 如果目标类型为null，直接返回原始数组(强制转换为Object[])
        if (null == classType) {
            return ((Object[]) arrayValue);
        }
        // 确定目标数组的组件类型
        // 如果classType是数组类型，则取其组件类型；否则直接使用classType
        final Class<?> componentType = classType.isArray() ? classType.getComponentType() : classType;
        // 将输入强制转换为Object数组
        Object[] valueArray = (Object[]) arrayValue;
        // 创建目标类型的新数组
        Object[] result = ArrayUtil.newArray(componentType, valueArray.length);
        // 复制原始数组内容到新数组
        System.arraycopy(valueArray, 0, result, 0, valueArray.length);
        // 返回转换后的数组
        return result;
    }

    /**
     * max 在指定数组中找出最大值（支持自定义比较器）
     *
     * @param <T>         泛型类型参数，要求T必须实现Comparable接口（或父类实现Comparable接口）
     * @param numberArray 要查找最大值的数组，数组元素必须实现Comparable接口
     * @param comparator  自定义比较器，用于定义元素间的比较规则。如果为null，则使用元素的自然顺序（Comparable接口）
     * @return 数组中的最大值
     * @throws IllegalArgumentException 如果输入数组为空（null或长度为0）
     *                                  <p>
     *                                  方法特点：
     *                                  1. 支持泛型数组，但要求数组元素类型T必须实现Comparable接口（或父类实现Comparable接口）
     *                                  2. 支持自定义比较器，提供更灵活的比较方式
     *                                  3. 当比较器为null时，自动使用元素的自然顺序（Comparable接口）进行比较
     *                                  4. 如果数组为空，抛出IllegalArgumentException异常
     * @author LiuQi
     */
    public static <T extends Comparable<? super T>> T max(T[] numberArray, Comparator<T> comparator) {
        // 检查数组是否为空（null或长度为0）
        if (isEmpty(numberArray)) {
            // 如果数组为空，抛出IllegalArgumentException异常，提示数组不能为空
            throw new IllegalArgumentException("Number array must not empty !");
        }
        // 假设数组第一个元素为当前最大值
        T maxNumber = numberArray[0];
        // 从数组第二个元素开始遍历
        for (int i = 1; i < numberArray.length; i++) {
            // 使用CompareUtil.compare方法比较当前最大值和当前元素
            // 如果比较结果小于0，说明当前元素比当前最大值大
            if (CompareUtil.compare(maxNumber, numberArray[i], comparator) < 0) {
                // 更新最大值
                maxNumber = numberArray[i];
            }
        }
        // 返回找到的最大值
        return maxNumber;
    }


}
