package org.sourcecode.toolkit.context;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

/**
 * @ClassName LoggerRecordContext
 * @Description LoggerRecordContext 用于在日志记录时管理上下文变量
 * @Author LiuQi
 */
public class LoggerRecordContext {

    // 定义一个静态的、final 的 InheritableThreadLocal 变量，
    // 用于存储一个双端队列（Deque），队列中每个元素是一个 Map<String, Object>
    // 作用：为每个线程（包括子线程，因为是 InheritableThreadLocal）维护一个变量栈，
    // 每个栈帧是一个 Map，用于存放当前上下文的键值对变量
    // 这种设计可以支持嵌套的上下文（比如方法调用链中的多级上下文）
    private static final InheritableThreadLocal<Deque<Map<String, Object>>> VARIABLE_MAP_STACK = new InheritableThreadLocal<>();

    private static final InheritableThreadLocal<Map<String, Object>> GLOBAL_VARIABLE_MAP = new InheritableThreadLocal<>();

    /**
     * putVariable 向当前线程的上下文变量栈顶的 Map 中添加一个键值对变量
     *
     * @param name  变量的名称（key）
     * @param value 变量的值（value）
     */
    public static void putVariable(String name, Object value) {
        // 检查当前线程是否已经有一个变量栈（Deque）
        if (VARIABLE_MAP_STACK.get() == null) {
            // 如果还没有，则创建一个新的双端队列（栈），并设置到 ThreadLocal 中
            Deque<Map<String, Object>> stack = new ArrayDeque<>();
            VARIABLE_MAP_STACK.set(stack);
        }
        // 获取当前线程的变量栈
        Deque<Map<String, Object>> mapStack = VARIABLE_MAP_STACK.get();
        // 如果栈是空的，说明还没有任何上下文 Map，需要先塞入一个新的空 Map 作为第一个栈帧
        if (mapStack.isEmpty()) {
            VARIABLE_MAP_STACK
                    .get()
                    .push(new HashMap<>());
        }
        // 获取当前栈顶的 Map（即当前上下文环境），并向其中放入键值对
        VARIABLE_MAP_STACK
                .get()
                .element()
                .put(name, value);
    }

    /**
     * getVariable 从当前线程的上下文栈顶的 Map 中获取指定名称的变量值
     *
     * @param name 要获取的变量名称（即 Map 中的 key）
     * @return 如果当前存在上下文栈且栈非空，并且栈顶的 Map 中存在该 key，则返回对应的 value；
     * 否则返回 null
     */
    public static Object getVariable(String name) {
        // 获取当前线程的变量栈（Deque），如果没有则返回 null
        Deque<Map<String, Object>> stack = VARIABLE_MAP_STACK.get();
        // 判断栈是否存在且不为空
        if (stack != null && !stack.isEmpty()) {
            // 获取栈顶的 Map（当前上下文环境），并尝试获取指定 name 对应的 value
            return stack.peek().get(name); // peek() 查看栈顶元素但不移除
        }
        // 如果栈不存在或为空，说明当前没有上下文，返回 null
        return null;
    }

    public static Map<String, Object> getVariables() {
        Deque<Map<String, Object>> mapStack = VARIABLE_MAP_STACK.get();
        return mapStack == null ? new HashMap<>() : mapStack.peek();
    }

    public static Map<String, Object> getGlobalVariableMap() {
        return GLOBAL_VARIABLE_MAP.get();
    }

    /**
     * pushContext 压入一个新的空上下文到栈顶，用于开始一个新的变量作用域
     * 相当于开启一个新的“上下文层级”，后续 put 的变量会放入这个新的 Map 中
     */
    public static void pushContext() {
        // 获取当前线程的变量栈
        Deque<Map<String, Object>> stack = VARIABLE_MAP_STACK.get();
        // 如果当前线程还没有初始化变量栈，则进行初始化
        if (stack == null) {
            stack = new ArrayDeque<>();
            VARIABLE_MAP_STACK.set(stack);
        }
        // 在栈顶压入一个新的空 HashMap，作为新的上下文环境
        stack.push(new HashMap<>());
    }

    /**
     * popContext 弹出（移除）当前线程上下文栈顶的 Map，即结束当前上下文作用域
     * 通常与 pushContext() 成对使用，用于清理当前层级的变量，防止内存泄漏或变量污染
     */
    public static void popContext() {
        // 获取当前线程的变量栈
        Deque<Map<String, Object>> stack = VARIABLE_MAP_STACK.get();
        // 如果栈存在并且不为空，则移除栈顶的 Map（即当前上下文）
        if (stack != null && !stack.isEmpty()) {
            stack.pop();
        }
    }

    public static void putEmptySpan() {
        Deque<Map<String, Object>> mapStack = VARIABLE_MAP_STACK.get();
        if (mapStack == null) {
            Deque<Map<String, Object>> stack = new ArrayDeque<>();
            VARIABLE_MAP_STACK.set(stack);
        }
        VARIABLE_MAP_STACK
                .get()
                .push(new HashMap<>());
        if (GLOBAL_VARIABLE_MAP.get() == null) {
            GLOBAL_VARIABLE_MAP.set(new HashMap<>());
        }
    }

    public static void clear() {
        if (VARIABLE_MAP_STACK.get() != null) {
            VARIABLE_MAP_STACK.get().pop();
        }
    }
}
