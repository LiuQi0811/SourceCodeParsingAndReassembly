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

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public Throwable getThrowable() {
        return throwable;
    }

    public void setThrowable(Throwable throwable) {
        this.throwable = throwable;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public Object getResult() {
        return result;
    }

    public void setResult(Object result) {
        this.result = result;
    }

    public Method getMethod() {
        return method;
    }

    public Object[] getArguments() {
        return arguments;
    }

    public Class<?> getTargetClass() {
        return targetClass;
    }
}
