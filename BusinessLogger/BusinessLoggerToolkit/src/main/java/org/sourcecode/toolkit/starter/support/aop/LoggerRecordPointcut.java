package org.sourcecode.toolkit.starter.support.aop;


import org.springframework.aop.support.StaticMethodMatcherPointcut;
import org.springframework.util.CollectionUtils;

import java.io.Serializable;
import java.lang.reflect.Method;
import java.util.Collection;

/**
 * @ClassName LoggerRecordPointcut
 * @Description LoggerRecordPointcut
 * @Author LiuQi
 */
public class LoggerRecordPointcut extends StaticMethodMatcherPointcut implements Serializable {
    private LoggerRecordOperationSource loggerRecordOperationSource;

    @Override
    public boolean matches(Method method, Class<?> targetClass) {
        return !CollectionUtils.isEmpty(loggerRecordOperationSource.computeLoggerRecordOperations(method, targetClass));
    }
    public void setLoggerRecordOperationSource(LoggerRecordOperationSource loggerRecordOperationSource) {
        this.loggerRecordOperationSource = loggerRecordOperationSource;
    }
}
