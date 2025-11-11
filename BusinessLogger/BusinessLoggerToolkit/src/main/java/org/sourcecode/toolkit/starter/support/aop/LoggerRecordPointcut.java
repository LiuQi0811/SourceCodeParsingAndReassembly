package org.sourcecode.toolkit.starter.support.aop;


import org.sourcecode.toolkit.starter.support.util.Util;
import org.springframework.aop.support.StaticMethodMatcherPointcut;

import java.io.Serializable;
import java.lang.reflect.Method;

/**
 * @ClassName LoggerRecordPointcut
 * @Description LoggerRecordPointcut
 * @Author LiuQi
 */
public class LoggerRecordPointcut extends StaticMethodMatcherPointcut implements Serializable {
    private LoggerRecordOperationSource loggerRecordOperationSource;

    @Override
    public boolean matches(Method method, Class<?> targetClass) {
        return !Util.isEmpty(loggerRecordOperationSource.computeLoggerRecordOperations(method, targetClass));
    }
    public void setLoggerRecordOperationSource(LoggerRecordOperationSource loggerRecordOperationSource) {
        this.loggerRecordOperationSource = loggerRecordOperationSource;
    }
}
