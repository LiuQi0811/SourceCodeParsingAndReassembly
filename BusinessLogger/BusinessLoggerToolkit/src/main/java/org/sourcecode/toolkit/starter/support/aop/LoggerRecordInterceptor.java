package org.sourcecode.toolkit.starter.support.aop;


import org.aopalliance.intercept.MethodInterceptor;
import org.aopalliance.intercept.MethodInvocation;
import org.springframework.beans.factory.SmartInitializingSingleton;

import java.io.Serializable;

/**
 * @ClassName LoggerRecordInterceptor
 * @Description LoggerRecordInterceptor
 * @Author LiuQi
 */
public class LoggerRecordInterceptor implements MethodInterceptor, Serializable, SmartInitializingSingleton {
    private LoggerRecordOperationSource loggerRecordOperationSource;

    public LoggerRecordOperationSource getLoggerRecordOperationSource() {
        return loggerRecordOperationSource;
    }

    public void setLoggerRecordOperationSource(LoggerRecordOperationSource loggerRecordOperationSource) {
        this.loggerRecordOperationSource = loggerRecordOperationSource;
    }

    @Override
    public Object invoke(MethodInvocation invocation) throws Throwable {
        System.out.println(" LOGGER INTERCEPTOR INVOKE ");
        return new Object();
    }

    @Override
    public void afterSingletonsInstantiated() {

    }
}
