package org.sourcecode.toolkit.starter.support.aop;


import org.sourcecode.toolkit.bean.LoggerRecordOperations;
import org.sourcecode.toolkit.starter.annotation.LoggerRecord;
import org.sourcecode.toolkit.starter.annotation.LoggerRecords;
import org.sourcecode.toolkit.starter.support.util.Util;
import org.springframework.core.BridgeMethodResolver;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.util.ClassUtils;
import org.springframework.util.ConcurrentReferenceHashMap;

import java.lang.reflect.AnnotatedElement;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.*;

/**
 * @ClassName LoggerRecordOperationSource
 * @Description LoggerRecordOperationSource
 * @Author LiuQi
 */
public class LoggerRecordOperationSource {
    private static final Map<Method, Method> INTERFACE_METHOD_CACHE = new ConcurrentReferenceHashMap<>(256);

    public Collection<LoggerRecordOperations> computeLoggerRecordOperations(Method method, Class<?> targetClass) {
        if (!Modifier.isPublic(method.getModifiers())) {
            return Collections.emptyList();
        }
        Method mostSpecificMethod = ClassUtils.getMostSpecificMethod(method, targetClass);
        mostSpecificMethod = BridgeMethodResolver.findBridgedMethod(mostSpecificMethod);
        Collection<LoggerRecordOperations> loggerRecordOperations = parseLoggerRecordAnnotations(mostSpecificMethod);
        Collection<LoggerRecordOperations> loggerRecordsOperations = parseLoggerRecordsAnnotations(mostSpecificMethod);
        Collection<LoggerRecordOperations> abstractLoggerRecordOperations = parseLoggerRecordAnnotations(getInterfaceMethodIfPossible(method));
        Collection<LoggerRecordOperations> abstractLoggerRecordsOperations = parseLoggerRecordsAnnotations(getInterfaceMethodIfPossible(method));
        HashSet<LoggerRecordOperations> result = new HashSet<>();
        result.addAll(loggerRecordOperations);
        result.addAll(abstractLoggerRecordOperations);
        result.addAll(loggerRecordsOperations);
        result.addAll(abstractLoggerRecordsOperations);
        return result;
    }

    public static Method getInterfaceMethodIfPossible(Method method) {
        if (!Modifier.isPublic(method.getModifiers()) || method.getDeclaringClass().isInterface()) {
            return method;
        }
        return INTERFACE_METHOD_CACHE.computeIfAbsent(method, KEY -> {
            Class<?> declaringClass = KEY.getDeclaringClass();
            while (declaringClass != null && declaringClass != Object.class) {
                for (Class<?> declaringClassInterface : declaringClass.getInterfaces()) {
                    try {
                        return declaringClassInterface.getMethod(KEY.getName(), KEY.getParameterTypes());
                    } catch (NoSuchMethodException e) {
                        // ignore exception
                    }
                }
                declaringClass = declaringClass.getSuperclass();
            }
            return KEY;
        });
    }

    private Collection<LoggerRecordOperations> parseLoggerRecordAnnotations(AnnotatedElement annotatedElement) {
        Collection<LoggerRecord> allMergedAnnotations = AnnotatedElementUtils.findAllMergedAnnotations(annotatedElement, LoggerRecord.class);
        Collection<LoggerRecordOperations> loggerRecordOptionsCollection = new ArrayList<>();
        if (!allMergedAnnotations.isEmpty()) {
            allMergedAnnotations.forEach(annotation -> {
                loggerRecordOptionsCollection.add(parseLoggerRecordAnnotation(annotatedElement, annotation));
            });
        }
        return loggerRecordOptionsCollection;
    }


    private Collection<LoggerRecordOperations> parseLoggerRecordsAnnotations(AnnotatedElement annotatedElement) {
        Collection<LoggerRecordOperations> loggerRecordOptionsCollection = new ArrayList<>();
        Collection<LoggerRecords> allMergedAnnotations = AnnotatedElementUtils.findAllMergedAnnotations(annotatedElement, LoggerRecords.class);
        if (!allMergedAnnotations.isEmpty()) {
            allMergedAnnotations.forEach(annotation -> {
                LoggerRecord[] value = annotation.value();
                Arrays.stream(value).forEach(loggerRecord -> {
                    loggerRecordOptionsCollection.add(parseLoggerRecordAnnotation(annotatedElement, loggerRecord));
                });
            });
        }
        return loggerRecordOptionsCollection;
    }

    private LoggerRecordOperations parseLoggerRecordAnnotation(AnnotatedElement annotatedElement, LoggerRecord loggerRecord) {
        LoggerRecordOperations loggerRecordOptions = new LoggerRecordOperations();
        loggerRecordOptions.setSuccessLoggerTemplate(loggerRecord.success());
        loggerRecordOptions.setFailLoggerTemplate(loggerRecord.fail());
        loggerRecordOptions.setType(loggerRecord.type());
        loggerRecordOptions.setBizNo(loggerRecord.bizNo());
        loggerRecordOptions.setOperatorId(loggerRecord.operator());
        loggerRecordOptions.setSubType(loggerRecord.subType());
        loggerRecordOptions.setExtra(loggerRecord.extra());
        loggerRecordOptions.setCondition(loggerRecord.condition());
        loggerRecordOptions.setIsSuccess(loggerRecord.successCondition());
        validateLoggerRecordOperation(annotatedElement, loggerRecordOptions);
        return loggerRecordOptions;
    }

    private void validateLoggerRecordOperation(AnnotatedElement annotatedElement, LoggerRecordOperations loggerRecordOptions) {
        if (!Util.hasText(loggerRecordOptions.getSuccessLoggerTemplate()) && !Util.hasText(loggerRecordOptions.getFailLoggerTemplate())) {
            throw new IllegalStateException("Invalid loggerRecord annotation configuration on '" +
                    annotatedElement.toString() + "'. 'one of successTemplate and failLoggerTemplate' attribute must be set.");
        }
    }
}
