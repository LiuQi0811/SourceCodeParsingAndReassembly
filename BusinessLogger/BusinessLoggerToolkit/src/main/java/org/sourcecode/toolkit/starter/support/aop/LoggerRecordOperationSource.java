package org.sourcecode.toolkit.starter.support.aop;


import org.sourcecode.toolkit.bean.LoggerRecordOptions;
import org.sourcecode.toolkit.starter.annotation.LoggerRecord;
import org.sourcecode.toolkit.starter.annotation.LoggerRecords;
import org.springframework.core.BridgeMethodResolver;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.util.ClassUtils;
import org.springframework.util.StringUtils;

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

    public Collection<LoggerRecordOptions> computeLoggerRecordOperations(Method method, Class<?> targetClass) {
        if (!Modifier.isPublic(method.getModifiers())) {
            return Collections.emptyList();
        }
        Method mostSpecificMethod = ClassUtils.getMostSpecificMethod(method, targetClass);
        mostSpecificMethod = BridgeMethodResolver.findBridgedMethod(mostSpecificMethod);
        Collection<LoggerRecordOptions> loggerRecordOptions = parseLoggerRecordAnnotations(mostSpecificMethod);
        Collection<LoggerRecordOptions> loggerRecordsOptions = parseLoggerRecordsAnnotations(mostSpecificMethod);
        Set<LoggerRecordOptions> result = new HashSet<>();
        result.addAll(loggerRecordOptions);
        result.addAll(loggerRecordsOptions);
        return result;
    }

    private Collection<LoggerRecordOptions> parseLoggerRecordAnnotations(AnnotatedElement annotatedElement) {
        Set<LoggerRecord> allMergedAnnotations = AnnotatedElementUtils.findAllMergedAnnotations(annotatedElement, LoggerRecord.class);
        Collection<LoggerRecordOptions> loggerRecordOptionsCollection = new ArrayList<>();
        if (!allMergedAnnotations.isEmpty()) {
            allMergedAnnotations.forEach(annotation -> {
                loggerRecordOptionsCollection.add(parseLoggerRecordAnnotation(annotatedElement, annotation));
            });
        }
        return loggerRecordOptionsCollection;
    }


    private Collection<LoggerRecordOptions> parseLoggerRecordsAnnotations(AnnotatedElement annotatedElement) {
        Collection<LoggerRecordOptions> loggerRecordOptionsCollection = new ArrayList<>();
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

    private LoggerRecordOptions parseLoggerRecordAnnotation(AnnotatedElement annotatedElement, LoggerRecord loggerRecord) {
        LoggerRecordOptions loggerRecordOptions = new LoggerRecordOptions();
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

    private void validateLoggerRecordOperation(AnnotatedElement annotatedElement, LoggerRecordOptions loggerRecordOptions) {
        if (!StringUtils.hasText(loggerRecordOptions.getSuccessLoggerTemplate()) && !StringUtils.hasText(loggerRecordOptions.getFailLoggerTemplate())) {
            throw new IllegalStateException("Invalid loggerRecord annotation configuration on '" +
                    annotatedElement.toString() + "'. 'one of successTemplate and failLoggerTemplate' attribute must be set.");
        }
    }
}
