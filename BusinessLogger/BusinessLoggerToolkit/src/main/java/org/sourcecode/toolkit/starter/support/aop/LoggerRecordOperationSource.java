package org.sourcecode.toolkit.starter.support.aop;


import org.sourcecode.toolkit.bean.LoggerRecordOptions;

import java.lang.reflect.Method;
import java.util.Collection;
import java.util.Collections;

/**
 * @ClassName LoggerRecordOperationSource
 * @Description LoggerRecordOperationSource
 * @Author LiuQi
 */
public class LoggerRecordOperationSource {
    public Collection<LoggerRecordOptions> computeLoggerRecordOperations(Method method, Class<?> targetClass) {
        System.out.println("  COMPUTE_LOGGER_RECORD_OPERATIONS ");
        return Collections.emptyList();
    }
}
