package org.sourcecode.toolkit.bean;


import java.lang.reflect.Method;

/**
 * @ClassName MethodExecuteResult
 * @Description MethodExecuteResult
 * @Author LiuQi
 */
public class MethodExecuteResult {
    private boolean success;
    private Throwable throwable;
    private String errorMessage;

    private Object result;
    private final Method method;
    private final Object[] arguments;
    private final Class<?> targetClass;

    public MethodExecuteResult(Method method, Object[] arguments, Class<?> targetClass) {
        this.method = method;
        this.arguments = arguments;
        this.targetClass = targetClass;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }


    public void setThrowable(Throwable throwable) {
        this.throwable = throwable;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public void setResult(Object result) {
        this.result = result;
    }
}
